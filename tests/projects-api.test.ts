import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';

test('Projects are server-owned, uniquely named, and isolated by path',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-projects-'));
 const origin='http://127.0.0.1:4211';
 const {app}=createApp(root,origin);const server=app.listen(4211,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 let cookie='',csrf='';
 const req=(url:string,method='GET',body?:unknown)=>fetch(origin+'/api'+url,{method,headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await req('/projects')).status,401);
  const setup=await req('/setup','POST',{username:'owner',password:'projects-test-password',reliquary:'Projects Test'});assert.equal(setup.status,200);cookie=setup.headers.get('set-cookie')!.split(';')[0];csrf=(await setup.json()).csrf;
  const created=await req('/projects','POST',{name:'Novel'});assert.equal(created.status,201);assert.deepEqual(await created.json(),{name:'Novel',path:'Projects/Novel'});
  assert.equal((await req('/projects','POST',{name:'novel'})).status,409);
  assert.equal((await req('/projects','POST',{name:'Bad/Name'})).status,400);
  const mutation={op:randomUUID(),id:randomUUID(),base:0,path:'Projects/Novel/Chapter 1.md',content:'# Chapter 1',deleted:false};
  assert.equal((await req('/mutate','POST',mutation)).status,200);
  assert.deepEqual(await(await req('/projects')).json(),[{name:'Novel',path:'Projects/Novel'}]);
  const directory=await(await req('/workspace/directory')).json();assert.ok(directory.files.some((file:any)=>file.path==='Projects/Novel/Chapter 1.md'));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));fs.rmSync(root,{recursive:true,force:true});}
});
