import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {HttpError,Store} from '../server/store.ts';

const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'spire-store-lock-'));

test('Store refuses to open an active workspace owned by another process',()=>{
 const root=temporary();
 try{
  fs.writeFileSync(path.join(root,'process.lock'),'999999',{mode:0o600});
  assert.throws(()=>new Store(root),/active workspace.*running server|locked.*server/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Store opens beneath the lock owned by its current server process',()=>{
 const root=temporary();
 try{
  fs.writeFileSync(path.join(root,'process.lock'),String(process.pid),{mode:0o600});
  const store=new Store(root);
  assert.equal(store.state.seq,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('unexpected disk divergence reports recovery instead of a generic archive failure',()=>{
 const root=temporary();
 try{
  const store=new Store(root);
  store.attachment('Attachments/example.bin',Buffer.from('original'));
  fs.writeFileSync(store.vault('Attachments/example.bin'),'changed outside Spire');
  assert.throws(
   ()=>store.createFolder('Writing'),
   error=>error instanceof HttpError&&error.status===503&&/changed outside Spire.*restart/i.test(error.message)
  );
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
