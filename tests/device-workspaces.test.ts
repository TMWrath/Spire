import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';

let nextPort=4198;
async function start(t:any){
 const port=nextPort++,origin=`http://127.0.0.1:${port}`;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-device-workspaces-'));
 const {app}=createApp(root,origin),server=app.listen(port,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise<void>(resolve=>server.close(()=>{fs.rmSync(root,{recursive:true,force:true});resolve();})));
 const session=()=>{let cookie='',csrf='';return {request:async(route:string,method='GET',body?:unknown)=>fetch(origin+'/api'+route,{method,headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),adopt:async(response:Response)=>{cookie=response.headers.get('set-cookie')!.split(';')[0];csrf=(await response.clone().json()).csrf;},get cookie(){return cookie;}}};
 return {root,session};
}

test('device names are required and unique case-insensitively without creating a duplicate session',async t=>{
 const {session}=await start(t),owner=session();
 assert.equal((await owner.request('/setup','POST',{username:'owner',password:'long-enough-password',reliquary:'Vault',device:''})).status,400);
 const setup=await owner.request('/setup','POST',{username:'owner',password:'long-enough-password',reliquary:'Vault',device:'Pixel Fold'});assert.equal(setup.status,200);await owner.adopt(setup);
 const duplicate=session(),response=await duplicate.request('/login','POST',{username:'owner',password:'long-enough-password',device:'  pixel fold  '});
 assert.equal(response.status,409);assert.match((await response.json()).error,/device name.*already/i);assert.equal(response.headers.get('set-cookie'),null);
 const devices=await (await owner.request('/devices')).json();assert.equal(devices.length,1);assert.equal(devices[0].name,'Pixel Fold');
});

test('a device publishes only its own local workspace and the owner can edit it with CAS',async t=>{
 const {session}=await start(t),pixel=session();const setup=await pixel.request('/setup','POST',{username:'owner',password:'long-enough-password',reliquary:'Vault',device:'Pixel'});await pixel.adopt(setup);const pixelIdentity=await setup.clone().json();
 const laptop=session(),login=await laptop.request('/login','POST',{username:'owner',password:'long-enough-password',device:'Laptop'});assert.equal(login.status,200);await laptop.adopt(login);const laptopIdentity=await login.clone().json();
 const local={seq:0,notes:[{id:randomUUID(),path:'Writing/Local.md',content:'from phone',deleted:false,rev:1,history:[],modified:new Date().toISOString(),templateIds:[]}],folders:['Writing'],styles:{},conflicts:[],attachments:[]};
 let response=await pixel.request('/device-workspaces/self/snapshot','PUT',{base:0,snapshot:local});assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
 response=await laptop.request('/device-workspaces/'+pixelIdentity.device.id+'/snapshot');assert.equal(response.status,200);let mirror=await response.json();assert.equal(mirror.snapshot.notes[0].content,'from phone');
 const mutation={op:randomUUID(),id:local.notes[0].id,base:1,path:'Writing/Local.md',content:'edited on server',deleted:false};
 response=await laptop.request('/device-workspaces/'+pixelIdentity.device.id+'/mutate','POST',{workspaceRevision:1,mutation});assert.equal(response.status,200);assert.equal((await response.json()).workspaceRevision,2);
 response=await pixel.request('/device-workspaces/self/changes?after=1');assert.equal(response.status,200);const changes=await response.json();assert.equal(changes.revision,2);assert.equal(changes.snapshot.notes[0].content,'edited on server');
 const stale=await pixel.request('/device-workspaces/self/snapshot','PUT',{base:1,snapshot:{...local,notes:[{...local.notes[0],content:'divergent phone edit'}]}});assert.equal(stale.status,409);const conflict=await stale.json();assert.match(conflict.error,/changed on both/i);assert.equal(conflict.details.server.snapshot.notes[0].content,'edited on server');
 assert.equal((await laptop.request('/device-workspaces/'+laptopIdentity.device.id+'/snapshot')).status,404);
});

test('revoked devices cannot publish or pull their mirrored local workspace',async t=>{
 const {session}=await start(t),owner=session();const setup=await owner.request('/setup','POST',{username:'owner',password:'long-enough-password',reliquary:'Vault',device:'Phone'});await owner.adopt(setup);const identity=await setup.clone().json();
 assert.equal((await owner.request('/device-workspaces/self/snapshot','PUT',{base:0,snapshot:{seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]}})).status,200);
 assert.equal((await owner.request('/devices/'+identity.device.id,'DELETE')).status,200);
 assert.equal((await owner.request('/device-workspaces/self/changes?after=0')).status,401);
});

 test('installation proof reuses device identity after logout',async t=>{
 const {session}=await start(t),client=session();
 const body={username:'owner',password:'long-enough-password',device:'Stable phone',installation:{id:randomUUID(),secret:randomUUID()+randomUUID()}};
 const setup=await client.request('/setup','POST',{...body,reliquary:'Writing'});await client.adopt(setup);const first=await setup.clone().json();
 await client.request('/logout','POST');
 const login=await client.request('/login','POST',body);assert.equal(login.status,200);await client.adopt(login);
 assert.equal((await login.clone().json()).device.id,first.device.id);
 assert.equal((await(await client.request('/devices')).json()).length,1);
 const forged=await client.request('/login','POST',{...body,installation:{...body.installation,secret:randomUUID()+randomUUID()}});assert.equal(forged.status,403);
 });
