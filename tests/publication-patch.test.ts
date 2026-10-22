import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {DeviceWorkspaces} from '../server/device-workspaces';
import {makePublicationPatch,applyPublicationPatch,snapshotHash} from '../shared/publication-patch';
const id=randomUUID(),file=randomUUID();
const note=(content:string)=>({id:file,path:'Writing/File.md',content,rev:1,deleted:false,history:[],time:'2026-01-01T00:00:00Z'});
const snap=(content:string)=>({seq:1,notes:[note(content)],folders:['Writing'],styles:{},attachments:[],conflicts:[]});
test('incremental publication transmits only changed hunks and retains history without resending old bodies',()=>{
 const before=snap('unchanged line\n'.repeat(1000));const after=structuredClone(before);after.notes[0].content+='new ending\n';after.notes[0].rev++;
 const patch=makePublicationPatch(before,after);assert.ok(JSON.stringify(patch).length<2000);assert.deepEqual(applyPublicationPatch(before,patch),after);
 assert.throws(()=>applyPublicationPatch(snap('other'),patch),/base/i);
});
test('server patch CAS, replay, restart and incremental download retain immutable ancestry',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-patch-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let store=new DeviceWorkspaces(root);const before=snap('a\nb\nc\n');store.publish(id,0,before);
 const after=snap('A\nb\nc\n');after.notes[0].rev=2;const patch=makePublicationPatch(before,after),operation=randomUUID();
 const first=store.publishPatch(id,{base:1,operation,patch});assert.equal(first.revision,2);assert.equal(first.hash,snapshotHash(after));
 assert.equal(store.publishPatch(id,{base:1,operation,patch}).revision,2);
 assert.throws(()=>store.publishPatch(id,{base:1,operation:randomUUID(),patch}),/changed/i);
 store=new DeviceWorkspaces(root);assert.equal(store.read(id).snapshot.notes[0].content,after.notes[0].content);
 const download=store.changes(id,1);assert.ok(download.patch);assert.equal(download.snapshot,undefined);assert.deepEqual(applyPublicationPatch(before,download.patch!),after);
 assert.equal(store.changes(id,2).unchanged,true);assert.equal(store.history(id,1).snapshot.notes[0].content,'a\nb\nc\n');
});
test('remote edits retain revision history and reject duplicate active paths',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const store=new DeviceWorkspaces(root);const before=snap('old');store.publish(id,0,before);
 const result=store.mutate(id,1,{op:randomUUID(),id:file,base:1,path:'Writing/File.md',content:'new',deleted:false});assert.ok(result.snapshot.notes[0].history.some((r:any)=>r.content==='old'));
 const bad={...result.snapshot,notes:[...result.snapshot.notes,{...note('other'),id:randomUUID(),path:'writing/file.md'}]};assert.throws(()=>store.publishPatch(id,{base:2,operation:randomUUID(),patch:makePublicationPatch(result.snapshot,bad)}),/path/i);
 assert.equal(store.read(id).revision,2);
});
