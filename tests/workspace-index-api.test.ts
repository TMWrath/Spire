import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';
import {applyWorkspaceDelta} from '../shared/workspace-index.ts';
test('authenticated workspace index compares before transferring and rejects malformed baselines',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-index-'));const {app,store}=createApp(root,'http://127.0.0.1:4199');const server=app.listen(4199,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let cookie='',csrf='';
 const req=(p:string,body?:unknown)=>fetch('http://127.0.0.1:4199/api'+p,{method:body?'POST':'GET',headers:{Origin:'http://127.0.0.1:4199',Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await req('/workspace/index')).status,401);
  const setup=await req('/setup',{username:'owner',password:'index-test-password-long',device:'Index test',reliquary:'Index Workspace'});cookie=setup.headers.get('set-cookie')!.split(';')[0];csrf=(await setup.json()).csrf;
  const id=randomUUID();assert.equal((await req('/mutate',{op:randomUUID(),id,base:0,path:'Folder/A.md',content:'old',deleted:false})).status,200);
  const before=await(await req('/snapshot')).json(),index=await(await req('/workspace/index')).json();assert.equal(index.version,1);
  const equal=await req('/workspace/compare',{index});assert.equal(equal.status,200);const unchanged=await equal.json();assert.equal(unchanged.unchanged,true);assert.deepEqual(unchanged.notes,[]);
  assert.equal((await req('/workspace/compare',{index:{...index,files:[{id:'x'}]}})).status,400);
  await req('/mutate',{op:randomUUID(),id,base:1,path:'Folder/A.md',content:'new',deleted:false});
  const changed=await(await req('/workspace/compare',{index})).json();assert.equal(changed.notes.length,1);assert.deepEqual(applyWorkspaceDelta(before,changed),await(await req('/snapshot')).json());
  const seq=store.state.seq;fs.utimesSync(store.vault('Folder/A.md'),new Date(),new Date());store.refreshDirectory();assert.equal(store.state.seq,seq);assert.equal((await(await req('/workspace/index')).json()).revision,changed.index.revision);
 }finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(root,{recursive:true,force:true});}
});
