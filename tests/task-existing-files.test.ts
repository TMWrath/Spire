import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store';
import {emptyTaskBoard} from '../shared/project-tasks';
test('existing task links persist without changing files; missing or trashed new targets are rejected',()=>{
 const root='.test-data/task-existing-'+randomUUID(),s=new Store(root);try{
 s.createFolder('Projects/Atlas');s.createFolder('Writing');const id=randomUUID();let b=s.saveProjectTasks('Atlas',{...emptyTaskBoard(),tasks:[{id,title:'Read',done:false}]});
 const n=s.mutate({op:randomUUID(),id:randomUUID(),base:0,path:'Writing/Original.md',content:'Keep this prose',deleted:false},'test');
 assert.throws(()=>s.saveProjectTasks('Atlas',{...b,tasks:b.tasks.map(t=>({...t,fileId:randomUUID()}))}),/unavailable|Trash/);
 b=s.saveProjectTasks('Atlas',{...b,tasks:b.tasks.map(t=>({...t,fileId:n.id}))});assert.equal(new Store(root).projectTaskBoards().Atlas.tasks[0].fileId,n.id);assert.equal(s.state.notes[n.id].rev,n.rev);assert.equal(s.state.notes[n.id].content,'Keep this prose');
 s.mutate({op:randomUUID(),id:n.id,base:n.rev,path:n.path,content:n.content,deleted:true},'test');
 b=s.saveProjectTasks('Atlas',{...b,tasks:b.tasks.map(t=>({...t,done:true}))}); // Existing dangling links must not block unrelated task edits.
 b=s.saveProjectTasks('Atlas',{...b,tasks:b.tasks.map(({fileId,...t})=>t)});
 assert.throws(()=>s.saveProjectTasks('Atlas',{...b,tasks:b.tasks.map(t=>({...t,fileId:n.id}))}),/unavailable|Trash/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
