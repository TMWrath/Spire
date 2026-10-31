import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store';

test('folder rename preserves nested files, assets, styles, links and restart state',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-tree-rename-'));
 try{
  const store=new Store(root);store.createFolder('Archive');store.createFolder('Archive/Nested');store.createFolder('Writing');
  const id=randomUUID();store.mutate({id,op:randomUUID(),base:0,path:'Archive/Nested/File.md',content:'Keep every word',deleted:false},'test');
  const linked=randomUUID();store.mutate({id:linked,op:randomUUID(),base:0,path:'Writing/Links.md',content:'[File](../Archive/Nested/File.md)',deleted:false},'test');
  store.attachment('Archive/Nested/image.png',Buffer.from('attachment bytes'));store.putStyle('Archive/Nested/style.css','p {color: red}');
  assert.deepEqual(store.moveFolder('Archive','','test','Library'),{path:'Library',moved:1});
  assert.equal(store.state.notes[id].path,'Library/Nested/File.md');assert.equal(store.state.notes[id].content,'Keep every word');
  assert.match(store.state.notes[linked].content,/Library\/Nested\/File.md/);
  assert.equal(store.state.attachments.find(a=>a.path==='Library/Nested/image.png')?.data,Buffer.from('attachment bytes').toString('base64'));
  assert.equal(store.state.styles?.['Library/Nested/style.css'],'p {color: red}');
  const reopened=new Store(root);assert.equal(reopened.state.notes[id].path,'Library/Nested/File.md');assert.ok(reopened.state.folders?.includes('Library/Nested'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('rename rejects traversal and occupied destinations without mutating the tree',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-tree-collision-'));
 try{
  const store=new Store(root);for(const name of ['Archive','Writing','Writing/Nested'])store.createFolder(name);
  const before=JSON.stringify(store.state);
  for(const name of ['../Outside','Nested/Path','Writing','..'])assert.throws(()=>store.moveFolder('Archive','','test',name));
  assert.equal(JSON.stringify(store.state),before);
  assert.throws(()=>store.moveFolder('Writing','Writing/Nested','test'),/itself/);assert.equal(JSON.stringify(store.state),before);
  store.moveFolder('Writing/Nested','Writing','test','Renamed');assert.ok(store.state.folders?.includes('Writing/Renamed'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
