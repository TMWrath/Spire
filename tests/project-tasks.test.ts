import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store.ts';
import {createBackup,restoreBackup} from '../server/backup.ts';
import {emptyTaskBoard,taskProgress} from '../shared/project-tasks.ts';
test('dedicated project tasks persist, reject stale writes, rename, and survive backups without files',()=>{
 const root='.test-data/project-tasks',restored=root+'-restored',backup=root+'-backup.json';for(const p of [root,restored,backup])fs.rmSync(p,{force:true,recursive:true});
 const store=new Store(root);store.createFolder('Projects/Atlas');
 const board=store.saveProjectTasks('Atlas',{...emptyTaskBoard(),tasks:[{id:randomUUID(),title:'Build',done:true},{id:randomUUID(),title:'Test',done:false}]});
 assert.equal(taskProgress(board),50);assert.equal(Object.keys(store.state.notes).length,0);assert.equal(new Store(root).state.projectTasks?.Atlas.revision,1);
 assert.throws(()=>store.saveProjectTasks('Atlas',emptyTaskBoard()),/changed elsewhere/);
 store.moveFolder('Projects/Atlas','Projects','test','Renamed');assert.equal(store.state.projectTasks?.Renamed.tasks.length,2);assert.equal(store.state.projectTasks?.Atlas,undefined);
 createBackup(root,backup);restoreBackup(backup,restored);assert.equal(taskProgress(new Store(restored).state.projectTasks!.Renamed),50);
 for(const p of [root,restored,backup])fs.rmSync(p,{force:true,recursive:true});
});

test('task deadlines persist through save, restart, rename, and backup',()=>{
 const root='.test-data/task-deadlines',restored=root+'-restored',backup=root+'-backup.json';
 for(const p of [root,restored,backup])fs.rmSync(p,{force:true,recursive:true});
 try{
 const store=new Store(root);store.createFolder('Projects/Atlas');
 const id=randomUUID();const board=store.saveProjectTasks('Atlas',{...emptyTaskBoard(),tasks:[{id,title:'Ship',done:false,dueDate:'2026-12-15'}]} );
 assert.equal(board.tasks[0].dueDate,'2026-12-15');
 assert.equal(new Store(root).state.projectTasks!.Atlas.tasks[0].dueDate,'2026-12-15');
 store.moveFolder('Projects/Atlas','Projects','test','Renamed');
 createBackup(root,backup);restoreBackup(backup,restored);
 assert.equal(new Store(restored).state.projectTasks!.Renamed.tasks[0].dueDate,'2026-12-15');
 const next=store.state.projectTasks!.Renamed;store.saveProjectTasks('Renamed',{...next,tasks:next.tasks.map(t=>({...t,dueDate:undefined}))});
 assert.equal(new Store(root).state.projectTasks!.Renamed.tasks[0].dueDate,undefined);
 }finally{for(const p of [root,restored,backup])fs.rmSync(p,{force:true,recursive:true});}
});
test('task deadlines reject impossible dates and timestamp strings',async()=>{
 const {taskBoardSchema}=await import('../shared/project-tasks.ts');
 for(const dueDate of ['2026-02-30','2026-13-01','2026-12-15T12:00:00Z','tomorrow'])assert.equal(taskBoardSchema.safeParse({...emptyTaskBoard(),tasks:[{id:randomUUID(),title:'Ship',done:false,dueDate}]}).success,false);
});
