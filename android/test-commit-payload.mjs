import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCommit} from './local/commit-payload.js';

test('create, move and delete transmit only affected file entries without mutating snapshots',()=>{
 const before={files:{'A/old.md':'b2xk','A/keep.md':'a2VlcA==','.spire-android/state.json':'b2xk'},dirs:['A','.spire-android']};
 for(const files of [ {...before.files,'A/new.md':'bmV3'}, {'B/old.md':'b2xk','A/keep.md':'a2VlcA==','.spire-android/state.json':'bmV3'}, {'A/keep.md':'a2VlcA==','.spire-android/state.json':'bmV3'}]){
  const after={files,dirs:['A','B','.spire-android']};const copy=structuredClone({before,after});
  const payload=compactCommit(before,after);
  assert.equal(Object.hasOwn(payload.before.files,'A/keep.md'),false);
  assert.equal(Object.hasOwn(payload.after.files,'A/keep.md'),false);
  const restored={...before.files};
  for(const p of Object.keys(payload.before.files))delete restored[p];
  Object.assign(restored,payload.after.files);
  assert.deepEqual(restored,after.files);
  const changedPaths=new Set([...Object.keys(payload.before.files),...Object.keys(payload.after.files)]),context=new Set();
  for(const path of changedPaths){const parts=path.split('/');parts.pop();while(parts.length){context.add(parts.join('/'));parts.pop();}}
  assert.deepEqual(payload.before.dirs,before.dirs.filter(p=>!after.dirs.includes(p)||context.has(p)));
  assert.deepEqual(payload.after.dirs,after.dirs.filter(p=>!before.dirs.includes(p)||context.has(p)));
  assert.deepEqual({before,after},copy);
 }
});
test('opaque attachment equality uses reference fields rather than object identity',()=>{
 const ref={kind:'saf',id:'media',size:20,modified:12};
 const before={files:{'A/media.bin':ref},dirs:['A']};
 const same=compactCommit(before,structuredClone(before));assert.deepEqual(same.before.files,{});
 const moved=compactCommit(before,{files:{'B/media.bin':{...ref}},dirs:['A','B']});
 assert.deepEqual(moved.before.files, before.files);assert.deepEqual(moved.after.files,{'B/media.bin':ref});
});
test('bridge payload sends only changed directories in a 10000-folder workspace',()=>{
 const dirs=Array.from({length:10000},(_,i)=>`Folder/${i}`),before={files:{},dirs};
 const payload=compactCommit(before,{files:{},dirs:[...dirs,'New/Deep']});
 assert.deepEqual(payload.before.dirs,[]);
 assert.deepEqual(payload.after.dirs,['New/Deep']);
 assert.ok(JSON.stringify(payload).length<256);
});
test('bridge payload excludes unrelated writing in a 1000-file workspace',()=>{
 const files=Object.fromEntries(Array.from({length:1000},(_,i)=>[`A/${i}.md`,'x'.repeat(8192)]));
 const before={files,dirs:['A']},after={files:{...files,'A/new.md':'bmV3'},dirs:['A']};
 const original=JSON.stringify({before,after}).length;
 const compact=JSON.stringify(compactCommit(before,after)).length;
 assert.ok(compact<1024);assert.ok(compact<original/1000);
 console.log(JSON.stringify({originalBytes:original,compactBytes:compact}));
});
