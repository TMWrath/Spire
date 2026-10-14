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
  const a=new Store(path.join(root,'a')),b=new Store(path.join(root,'b'));
  a.createFolder('Writing');a.attachment('Attachments/photo.png',Buffer.from([1,2,3]));
  const note=a.mutate({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/file.md',content:'![photo](../Attachments/photo.png)',deleted:false},'test');
  const bundle=readTransfer(a,'Writing/file.md');assert.equal(bundle.files.length,2);
  assert.equal(createTransfer(b,bundle,'test').acknowledged,true);
  assert.deepEqual(readTransfer(b,'Writing/file.md').files.map(f=>[f.path,f.data]),bundle.files.map(f=>[f.path,f.data]));
  assert.throws(()=>createTransfer(b,bundle,'test'),/occupied|exists/i);
  a.mutate({...note,base:note.rev,op:crypto.randomUUID(),content:'changed'},'test');
  assert.throws(()=>removeTransfer(a,bundle,'test'),/changed/i);assert.equal(a.state.notes[note.id].deleted,false);
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
