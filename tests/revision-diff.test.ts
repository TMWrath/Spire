import {test} from 'node:test';
import assert from 'node:assert/strict';
import {revisionChanges} from '../client/revision-diff';
const r={rev:1,path:'Notes/One.md',content:'one\ntwo\n',deleted:false,time:'2026-01-01'};
test('revision diff reports additions, removals and unchanged lines',()=>{const d=revisionChanges(r,{...r,rev:2,content:'one\nthree\n'});assert.equal(d.added,1);assert.equal(d.removed,1);assert.deepEqual(d.rows.map(x=>[x.kind,x.text]),[['same','one'],['removed','two'],['added','three']]);});
test('creation, rename, deletion and unchanged content remain distinguishable',()=>{assert.equal(revisionChanges(undefined,r).added,2);const d=revisionChanges(r,{...r,path:'Notes/Two.md',deleted:true});assert.equal(d.added,0);assert.equal(d.removed,0);assert.equal(d.renamed,true);assert.equal(d.status,'Moved to trash');assert.equal(revisionChanges(r,r).rows.length,2);});
test('empty files and final newline changes are explicit',()=>{assert.equal(revisionChanges(undefined,{...r,content:''}).rows.length,0);assert.equal(revisionChanges({...r,content:'one'},{...r,content:'one\n'}).newlineChanged,true);});
