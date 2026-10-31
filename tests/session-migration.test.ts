import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';

test('legacy native sessions bind installation proof without replacing publications; browser conversion preserves records',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-migrate-')),origin='http://127.0.0.1:4293';
 const app=createApp(root,origin).app,server=app.listen(4293,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 let cookie='',csrf='';
 const request=(route:string,method='GET',body?:unknown)=>fetch(origin+'/api'+route,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:body?JSON.stringify(body):undefined});
 try{
  const response=await request('/setup','POST',{username:'owner',password:'long-enough-password',device:'Existing phone',reliquary:'Writing'});
  cookie=response.headers.get('set-cookie')!.split(';')[0];const first=await response.json();csrf=first.csrf;
  const snapshot={seq:0,notes:[],folders:['Writing'],styles:{},conflicts:[],attachments:[]};
  assert.equal((await request('/device-workspaces/self/snapshot','PUT',{base:0,snapshot})).status,200);
  const installation={id:randomUUID(),secret:randomUUID()+randomUUID()};
  assert.equal((await request('/device-installation','POST',{installation})).status,200);
  assert.equal((await request('/device-installation','POST',{installation:{...installation,secret:randomUUID()+randomUUID()}})).status,403);
  assert.equal((await(await request('/me')).json()).device.installation,undefined);
  const before=await(await request('/device-workspaces/self/changes')).json();
  await request('/logout','POST');
  const login=await request('/login','POST',{username:'owner',password:'long-enough-password',device:'Existing phone',installation});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie')!.split(';')[0];const identity=await login.json();csrf=identity.csrf;
  assert.equal(identity.device.id,first.device.id);assert.deepEqual(await(await request('/device-workspaces/self/changes')).json(),before);
  const converted=await request('/browser-session','POST');assert.equal(converted.status,200);
  const browser=await converted.json();assert.equal(browser.browser,true);assert.equal(browser.device,undefined);
  assert.equal((await request('/device-workspaces/self/changes')).status,403);
  assert.equal((await(await request('/devices')).json()).length,1);
  assert.equal((await(await request('/device-workspaces/'+first.device.id+'/snapshot')).json()).revision,before.revision);
  const persisted=JSON.parse(fs.readFileSync(path.join(root,'server-identity.json'),'utf8'));
  createApp(root,origin);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'server-identity.json'),'utf8')),persisted);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));fs.rmSync(root,{recursive:true,force:true});}
});
