import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';
import {emptyTaskBoard} from '../shared/project-tasks.ts';
test('corresponding-file API enforces auth, CSRF, revisions and persistent task links',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-task-api-')),origin='http://127.0.0.1:4218';const {app,store}=createApp(root,origin),server=app.listen(4218,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));let cookie='',csrf='';
 const req=(url:string,method='GET',body?:unknown)=>fetch(origin+'/api'+url,{method,headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 try{assert.equal((await req('/project-task-file/Atlas','POST',{})).status,401);const setup=await req('/setup','POST',{username:'owner',password:'task-file-test-password',reliquary:'Tasks Test'});assert.equal(setup.status,200);cookie=setup.headers.get('set-cookie')!.split(';')[0];const token=(await setup.json()).csrf;
 assert.equal((await req('/project-task-file/Atlas','POST',{})).status,403);csrf=token;assert.equal((await req('/projects','POST',{name:'Atlas'})).status,201);const id=randomUUID();const b=await req('/project-tasks/Atlas','PUT',{...emptyTaskBoard(),tasks:[{id,title:'Task',done:false}]});assert.equal(b.status,200);const board=await b.json(),body={taskId:id,revision:board.revision,path:'Projects/Atlas/Chosen.md'};
 assert.equal((await req('/project-task-file/Atlas','POST',{...body,revision:0})).status,409);assert.equal((await req('/project-task-file/Atlas','POST',{...body,path:'../escape.md'})).status,400);assert.equal((await req('/project-task-file/Atlas','POST',{...body,taskId:randomUUID()})).status,404);
 const response=await req('/project-task-file/Atlas','POST',body);assert.equal(response.status,200);const created=await response.json();assert.equal(created.board.tasks[0].fileId,created.note.id);assert.equal(created.note.path,body.path);assert.equal(store.state.notes[created.note.id].path,body.path);const replay=await req('/project-task-file/Atlas','POST',body);assert.equal(replay.status,200);assert.equal((await replay.json()).note.id,created.note.id);assert.equal((await(await req('/project-tasks')).json()).Atlas.tasks[0].fileId,created.note.id);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));fs.rmSync(root,{recursive:true,force:true});}
});
