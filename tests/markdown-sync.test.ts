import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMarkdown,makeTextPatch,applyTextPatch,resolveMerge} from '../shared/markdown-sync';
import {planPublication} from '../client/publication-isolation';
const n=(content:string,rev=1)=>({id:'A',path:'Writing/A.md',content,rev,deleted:false,history:[],time:'2026-01-01T00:00:00Z'});
const s=(content:string,rev=1)=>({seq:1,notes:[n(content,rev)],folders:['Writing'],styles:{},attachments:[],conflicts:[]});
test('three-way line merge preserves blank lines, CRLF, Unicode and final newline exactly',()=>{
 const base='one\r\n\r\n🌞\r\nthree\r\n';
 const result=mergeMarkdown(base,base.replace('one','phone'),base.replace('three','server'));
 assert.equal(result.clean,true);assert.equal(result.content,'phone\r\n\r\n🌞\r\nserver\r\n');
});
test('overlap retains only conflicting sections and preserves both independent edits',()=>{
 const result=mergeMarkdown('a\nb\nc\nd\ne\n','A\nb\nlocal\nd\ne\n','a\nb\nremote\nd\nE\n');
 assert.equal(result.clean,false);const conflicts=result.parts.filter(p=>p.kind==='conflict');
 assert.equal(conflicts.length,1);assert.equal(conflicts[0].base,'c\n');assert.equal(conflicts[0].local,'local\n');assert.equal(conflicts[0].server,'remote\n');
 assert.equal(resolveMerge(result,{0:'both'}),'A\nb\nlocal\nremote\nd\nE\n');
 assert.throws(()=>resolveMerge(result,{}),/unresolved/i);
});
test('deletions, adjacent replacements and equal inserts merge; competing inserts do not',()=>{
 assert.equal(mergeMarkdown('a\nb\nc\n','A\nb\nc\n','a\nB\nc\n').content,'A\nB\nc\n');
 assert.equal(mergeMarkdown('a\nb\nc\n','a\nc\n','a\nb\nC\n').content,'a\nC\n');
 assert.equal(mergeMarkdown('a\n','x\na\n','x\na\n').content,'x\na\n');
 assert.equal(mergeMarkdown('a\n','x\na\n','y\na\n').clean,false);
 assert.equal(mergeMarkdown('a\nb','a\nb\n','A\nb').content,'A\nb\n');
});
test('patches contain changed lines only and reject incorrect base, output, overlap and bounds',()=>{
 const base=Array.from({length:1000},(_,i)=>`Line ${i}\n`).join(''),next=base.replace('Line 500\n','changed\n');
 const patch=makeTextPatch(base,next);assert.ok(JSON.stringify(patch).length<500);assert.equal(applyTextPatch(base,patch),next);
 assert.throws(()=>applyTextPatch(base+' ',patch),/base/i);
 assert.throws(()=>applyTextPatch(base,{...patch,resultHash:'0'.repeat(64)}),/integrity/i);
 assert.throws(()=>applyTextPatch(base,{...patch,hunks:[{start:-1,end:0,lines:[]}]}));
 assert.throws(()=>applyTextPatch(base,{...patch,hunks:[...patch.hunks,...patch.hunks]}));
});
test('publication merges a file in both directions without acknowledging an unapplied provider write',()=>{
 const p=planPublication(s('A\nb\nc\n',2),s('a\nb\nc\n'),s('a\nb\nC\n',2));
 assert.deepEqual(p.conflicts,[]);assert.equal(p.outgoing.notes[0].content,'A\nb\nC\n');assert.equal(p.pulls[0].content,'A\nb\nC\n');
 assert.equal(p.baseline.notes[0].content,'a\nb\nc\n');
});
test('merge retry after committed upload and failed provider save does not duplicate changes',()=>{
 const base=s('a\nb\nc\n'),local=s('A\nb\nc\n',2),server=s('a\nb\nC\n',2);
 const first=planPublication(local,base,server);const retry=planPublication(local,first.baseline,first.outgoing);
 assert.equal(retry.upload,false);assert.equal(retry.pulls[0].content,'A\nb\nC\n');
});
