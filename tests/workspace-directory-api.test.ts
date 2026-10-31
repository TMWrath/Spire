import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';
test('directory, individual content and history are separate authenticated read-only requests',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-directory-'));const origin='http://127.0.0.1:4198';const {app,store}=createApp(root,origin);const server=app.listen(4198,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let cookie='',csrf='';
 const req=(p:string,body?:unknown)=>fetch(origin+'/api'+p,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await req('/workspace/directory')).status,401);
  const setup=await req('/setup',{username:'owner',password:'directory-test-password-long',device:'Directory test',reliquary:'Directory Workspace'});assert.equal(setup.status,200);cookie=setup.headers.get('set-cookie')!.split(';')[0];csrf=(await setup.json()).csrf;
  const id=randomUUID();for(const [base,content] of [[0,'old secret body'],[1,'new secret body']] as const)assert.equal((await req('/mutate',{op:randomUUID(),id,base,path:'Folder/A.md',content,deleted:false})).status,200);
  const seq=store.state.seq;const d=await req('/workspace/directory');assert.equal(d.status,200);const directory=await d.json();assert.equal(directory.files[0].id,id);assert.equal(directory.files[0].content,undefined);assert.equal(directory.files[0].history,undefined);assert.equal(JSON.stringify(directory).includes('secret body'),false);
  const opened=await req('/workspace/files/'+id+'/content');assert.equal(opened.status,200);const file=await opened.json();assert.equal(file.content,'new secret body');assert.equal(file.history,undefined);assert.equal(file.createdTime,directory.files[0].createdTime);assert.deepEqual(file.editTimes,directory.files[0].editTimes);
  const history=await req('/workspace/files/'+id+'/history');assert.equal(history.status,200);assert.ok((await history.json()).some((r:any)=>r.content==='old secret body'));
  assert.equal((await req('/workspace/files/'+randomUUID()+'/content')).status,404);assert.equal(store.state.seq,seq);
 }finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(root,{recursive:true,force:true});}
});
