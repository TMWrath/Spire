import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/store';
import {readTransfer,createTransfer,removeTransfer} from '../server/transfer';

test('transfer replay survives restart and protects changed destination bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-transfer-replay-'));
 try {
  let a=new Store(path.join(root,'a')),b=new Store(path.join(root,'b'));
  a.createFolder('Writing');const n=a.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/replay.md',content:'original',deleted:false},'test');
  const bundle={...readTransfer(a,n.path),operation:crypto.randomUUID()};
  createTransfer(b,bundle,'test');b=new Store(path.join(root,'b'));
  assert.equal(createTransfer(b,bundle,'test').acknowledged,true);assert.equal(Object.values(b.state.notes).length,1);
  assert.throws(()=>createTransfer(b,{...bundle,files:bundle.files.map(f=>({...f,data:Buffer.from('changed').toString('base64')}))},'test'),/operation|receipt/i);
  removeTransfer(a,bundle,'test');a=new Store(path.join(root,'a'));assert.equal(removeTransfer(a,bundle,'test').ok,true);
  const destination=Object.values(b.state.notes)[0];b.mutate({...destination,base:destination.rev,op:crypto.randomUUID(),content:'new destination edit'},'test');
  assert.throws(()=>createTransfer(b,bundle,'test'),/changed|differ/i);assert.equal(b.state.notes[destination.id].content,'new destination edit');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('real stores: attachment-aware move acknowledges bytes and refuses changed sources',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-mounted-'));
 try{
  const a=new Store(path.join(root,'a'));let b=new Store(path.join(root,'b'));
  a.createFolder('Writing');a.attachment('Attachments/photo.png',Buffer.from([1,2,3]));
  const note=a.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/file.md',content:'![photo](../Attachments/photo.png)',deleted:false},'test');
  const bundle=readTransfer(a,note.path);assert.equal(bundle.files.find(f=>f.kind==='note')?.id,note.id);assert.equal(createTransfer(b,bundle,'test').acknowledged,true);assert.equal(Object.values(b.state.notes)[0].id,note.id);b=new Store(path.join(root,'b'));assert.equal(Object.values(b.state.notes)[0].id,note.id);assert.deepEqual(readTransfer(b,note.path).files.map(f=>[f.path,f.data]),bundle.files.map(f=>[f.path,f.data]));
  assert.throws(()=>createTransfer(b,bundle,'test'),/occupied|exists/i);
  a.mutate({...note,base:note.rev,op:crypto.randomUUID(),content:'changed'},'test');
  assert.throws(()=>removeTransfer(a,bundle,'test'),/changed/i);assert.equal(a.state.notes[note.id].deleted,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Server→Local→original Server restores stable identity after local edit, rename and destination restart',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-roundtrip-'));
 try{
  const serverPath=path.join(root,'server'),localPath=path.join(root,'local');let server=new Store(serverPath),local=new Store(localPath);
  server.createFolder('Writing');server.attachment('Attachments/photo.png',Buffer.from([5,7,9]));server.putStyle('Writing/start.css','p { color: teal; }');
  const original=server.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/start.md',content:'![photo](../Attachments/photo.png)\n\nA **styled** file.',deleted:false},'test');
  const moved={...readTransfer(server,original.path),operation:crypto.randomUUID()};
  assert.equal(createTransfer(local,moved,'test').acknowledged,true);
  removeTransfer(server,moved,'test');
  const provenance={origin:'https://spire.example',account:'owner',workspace:'vault',revision:original.rev};
  const copied=local.state.notes[original.id];local.mutate({...copied,path:'Writing/renamed.md',content:copied.content+'\nLocal addition.',base:copied.rev,op:crypto.randomUUID()},'test');
  local=new Store(localPath);
  const returned={...readTransfer(local,'Writing/renamed.md'),operation:crypto.randomUUID()};returned.files=returned.files.map(f=>f.kind==='note'?{...f,origin:provenance}:f);
  assert.equal(createTransfer(server,returned,'test').acknowledged,true);
  const result=server.state.notes[original.id];assert.equal(result.path,'Writing/renamed.md');assert.equal(result.content.includes('Local addition.'),true);assert.equal(result.history.some(r=>r.deleted),true);
  assert.deepEqual(readTransfer(local,'Writing/renamed.md').files.filter(f=>f.kind==='attachment'),moved.files.filter(f=>f.kind==='attachment'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('return fails closed if original Server identity was restored or changed; local bytes remain recoverable',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-roundtrip-conflict-'));
 try{
  const server=new Store(path.join(root,'server')),local=new Store(path.join(root,'local'));server.createFolder('Writing');
  const original=server.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/a.md',content:'base',deleted:false},'test');
  const moved={...readTransfer(server,original.path),operation:crypto.randomUUID()};createTransfer(local,moved,'test');removeTransfer(server,moved,'test');
  const tombstone=server.state.notes[original.id];server.mutate({...tombstone,base:tombstone.rev,op:crypto.randomUUID(),deleted:false,content:'independent Server restoration'},'test');
  const localNote=local.state.notes[original.id];local.mutate({...localNote,base:localNote.rev,op:crypto.randomUUID(),content:'independent Local edit'},'test');
  const returning={...readTransfer(local,localNote.path),operation:crypto.randomUUID(),files:readTransfer(local,localNote.path).files.map(f=>f.kind==='note'?{...f,origin:{origin:'https://spire.example',account:'owner',workspace:'vault',revision:original.rev}}:f)};
  assert.throws(()=>createTransfer(server,returning,'test'),/occupied|changed/i);assert.equal(local.state.notes[original.id].content,'independent Local edit');assert.equal(server.state.notes[original.id].content,'independent Server restoration');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('folder transfers include empty folders and styles; conditional removal protects external bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-mounted-'));
 try{
  const local=path.join(root,'local');fs.mkdirSync(local);const a=new Store(path.join(root,'a'),{contentDirectory:local}),b=new Store(path.join(root,'b'));
  a.createFolder('Writing');a.createFolder('Writing/Empty');a.putStyle('Writing/file.css','p { color: white; }');
  const n=a.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/file.md',content:'private',deleted:false},'test');
  const bundle=readTransfer(a,'Writing');createTransfer(b,bundle,'test');assert.ok(b.state.folders?.includes('Writing/Empty'));
  fs.writeFileSync(path.join(local,'Writing/file.md'),'external edit');assert.throws(()=>removeTransfer(a,bundle,'test'));assert.equal(a.state.notes[n.id].deleted,false);assert.equal(fs.readFileSync(path.join(local,'Writing/file.md'),'utf8'),'external edit');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
