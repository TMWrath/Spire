import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileTaskBoard,writeFileTaskBoard,fileTasksPath} from '../shared/file-task-board';
import type {Note} from '../shared/model';
const note=(id:string,path:string,content:string,rev=1)=>({id,path,content,rev,deleted:false} as Note);
test('file task board preserves source prose and excludes Projects while persisting exact editor fields',()=>{
 const notes=[note('ordinary','Notes/Day.md','# Day\nSome prose.\n- [ ] Existing\nTail.\n'),note('project','Projects/Test/Note.md','- [ ] Project only\n')];
 const {board}=readFileTaskBoard(notes);assert.equal(board.tasks.length,1);
 const next={...board,tasks:[{...board.tasks[0],title:'Renamed',done:true,dueDate:'2026-12-20',fileId:'linked'}],groups:[{id:'11111111-1111-4111-8111-111111111111',name:'My tasks',color:'#ff0000',members:['task:'+board.tasks[0].id]}]};
 const changes=writeFileTaskBoard(notes,next);assert.equal(changes.has('Projects/Test/Note.md'),false);assert.match(changes.get('Notes/Day.md')!,/Some prose\.\n- \[x\] Renamed/);assert.match(changes.get('Notes/Day.md')!,/Tail\./);
 const updated=notes.map(n=>({...n,content:changes.get(n.path)??n.content}));updated.push(note('store',fileTasksPath,changes.get(fileTasksPath)!));
 const restored=readFileTaskBoard(updated).board;assert.deepEqual(restored.tasks,next.tasks);assert.deepEqual(restored.groups,next.groups);
 const unlinked={...restored,tasks:restored.tasks.map(t=>({...t,fileId:undefined,dueDate:undefined}))};
 const cleared=writeFileTaskBoard(updated,unlinked);assert.ok(!cleared.get('Notes/Day.md')!.includes('fileId'));assert.ok(!cleared.get('Notes/Day.md')!.includes('dueDate'));
 const removed=writeFileTaskBoard(updated,{...restored,tasks:[],groups:[]});assert.match(removed.get('Notes/Day.md')!,/Some prose\.\nTail\./);
});
test('new file tasks remain Markdown backed and stale revisions are rejected',()=>{
 const next={revision:0,tasks:[{id:'new',title:'First task',done:false}],groups:[]};
 const changes=writeFileTaskBoard([],next);assert.match(changes.get(fileTasksPath)!,/- \[ \] First task/);
 const notes=[note('store',fileTasksPath,changes.get(fileTasksPath)!)];assert.equal(readFileTaskBoard(notes).board.tasks[0].id,'new');
 assert.throws(()=>writeFileTaskBoard(notes,next),/changed on the server/);
});
