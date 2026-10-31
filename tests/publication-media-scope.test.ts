import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DeviceWorkspaces} from '../server/device-workspaces';
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const snapshot=(localWorkspaceId:string)=>({localWorkspaceId,seq:1,notes:[],folders:['Attachments'],styles:{},conflicts:[],attachments:[{path:'Attachments/photo.jpg',size:3}]});
test('directory switches isolate bytes and reject late writes from the previous workspace',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-media-scope-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=new DeviceWorkspaces(root),id=randomUUID(),file='Attachments/photo.jpg',a=Buffer.from('old'),b=Buffer.from('new');
 store.publish(id,0,snapshot('folder-a'));store.putAttachment(id,file,digest(a),a,'folder-a');
 store.publish(id,1,snapshot('folder-b'));
 assert.throws(()=>store.attachment(id,file),/unavailable/);
 assert.throws(()=>store.putAttachment(id,file,digest(a),a,'folder-a'),/workspace changed/i);
 store.putAttachment(id,file,digest(b),b,'folder-b');assert.deepEqual(store.attachment(id,file),b);
 store.publish(id,2,snapshot('folder-a'));assert.deepEqual(store.attachment(id,file),a);
 const reopened=new DeviceWorkspaces(root);assert.deepEqual(reopened.attachment(id,file),a);
});
test('legacy bytes migrate into only their original workspace and removed paths are unavailable',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-media-migrate-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=new DeviceWorkspaces(root),id=randomUUID(),file='Attachments/photo.jpg',bytes=Buffer.from('old');
 store.putAttachment(id,file,digest(bytes),bytes);store.publish(id,0,snapshot('folder-a'));
 assert.deepEqual(store.attachment(id,file),bytes);
 store.publish(id,1,{...snapshot('folder-a'),attachments:[]});assert.throws(()=>store.attachment(id,file),/unavailable/);
 store.publish(id,2,snapshot('folder-b'));assert.throws(()=>store.attachment(id,file),/unavailable/);
});
