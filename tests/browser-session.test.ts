import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.ts';

test('browser login creates sessions without registering storage devices',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-session-'));
 const origin='http://127.0.0.1:4197';
 const {app}=createApp(root,origin);const server=app.listen(4197,'127.0.0.1');
 await new Promise<void>(r=>server.once('listening',r));
 let cookie='',csrf='';
 const req=async(p:string,method='GET',body?:unknown)=>{
  const response=await fetch(origin+'/api'+p,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},...(body?{body:JSON.stringify(body)}:{})});
  const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return response;
 };
 try{
  const credentials={username:'owner',password:'test-password-12345'};
  const setup=await req('/setup','POST',{...credentials,reliquary:'Writing'});
  assert.equal(setup.status,200,'browser setup must not require a device name');
  const identity=await setup.json();csrf=identity.csrf;
  assert.match(identity.server.id,/^[0-9a-f-]{36}$/);
  assert.equal(identity.device,undefined,'browser identity must not pretend to be a device');
  assert.deepEqual(await(await req('/devices')).json(),[]);
  await req('/logout','POST');
  const login=await req('/login','POST',credentials);assert.equal(login.status,200);
  csrf=(await login.json()).csrf;
  assert.deepEqual(await(await req('/devices')).json(),[]);
  assert.deepEqual(await(await req('/device-workspaces')).json(),[]);
  assert.equal((await req('/device-workspaces/self/snapshot','PUT',{base:0,snapshot:{}})).status,403,'browser cannot publish a pretend Local folder');
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));fs.rmSync(root,{recursive:true,force:true});}
});
