import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkspaceIndex,compareWorkspace,applyWorkspaceDelta} from '../shared/workspace-index.ts';
const snapshot=()=>({seq:1,notes:[{id:'a',path:'Folder/A.md',content:'hello  \n',rev:1,deleted:false,history:[]}],folders:['Folder'],styles:{},conflicts:[],attachments:[]});
test('workspace fingerprints are deterministic and unchanged compare transfers no file bodies',()=>{
 const s=snapshot(),index=buildWorkspaceIndex(s);const delta=compareWorkspace(s,index);assert.equal(delta.unchanged,true);assert.deepEqual(delta.notes,[]);assert.equal(index.revision,buildWorkspaceIndex(structuredClone(s)).revision);
});
test('content and structure fingerprints distinguish editing from moving',()=>{
 const a=snapshot(),b=snapshot();b.notes[0].path='Folder/B.md';const ai=buildWorkspaceIndex(a),bi=buildWorkspaceIndex(b);assert.equal(ai.files[0].contentHash,bi.files[0].contentHash);assert.notEqual(ai.structure,bi.structure);b.notes[0].content='hello\n';assert.notEqual(ai.files[0].contentHash,buildWorkspaceIndex(b).files[0].contentHash);
});
test('delta includes changed files and explicit removals and reconstructs exact target',()=>{
 const a=snapshot(),b=snapshot();b.seq=2;b.notes=[{...b.notes[0],id:'b',path:'Folder/B.md',content:'new'}];const delta=compareWorkspace(b,buildWorkspaceIndex(a));assert.deepEqual(delta.removed,['a']);assert.deepEqual(delta.notes,b.notes);assert.deepEqual(applyWorkspaceDelta(a,delta),b);
});
test('wrong-base and tampered deltas cannot replace a cached workspace',()=>{
 const a=snapshot(),b=snapshot();b.notes[0].content='next';const delta=compareWorkspace(b,buildWorkspaceIndex(a));const wrong=snapshot();wrong.notes[0].content='local draft';assert.throws(()=>applyWorkspaceDelta(wrong,delta),/base/i);delta.notes[0].content='corrupt';assert.throws(()=>applyWorkspaceDelta(a,delta),/integrity/i);assert.equal(a.notes[0].content,'hello  \n');
});
test('metadata-only sequence changes do not send unchanged file bodies',()=>{
 const a=snapshot(),b=snapshot();b.seq=2;const d=compareWorkspace(b,buildWorkspaceIndex(a));assert.equal(d.unchanged,false);assert.deepEqual(d.notes,[]);assert.deepEqual(applyWorkspaceDelta(a,d),b);
});
