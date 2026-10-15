import test from 'node:test';
import assert from 'node:assert/strict';
import {attachReturnProvenance} from '../client/transfer-provenance';
import type {WireBundle} from '../server/transfer';

const target={kind:'server' as const,origin:'https://spire.example',account:'owner',workspace:'vault'};
const noteId='4c9b6573-3e30-4a95-b72d-6819dcf473f4';
const bundle:WireBundle={path:'Writing/renamed.md',version:'v',files:[{kind:'note',path:'Writing/renamed.md',data:'bG9jYWw=',id:noteId,rev:2},{kind:'attachment',path:'Attachments/p.png',data:'AQ=='}]};

test('explicit Local to original Server return attaches durable origin only to stable note identities',()=>{
 const origin={origin:target.origin,account:target.account,workspace:target.workspace,revision:7};
 const returned=attachReturnProvenance(bundle,{[noteId]:origin},target);
 assert.deepEqual(returned.files[0],{...bundle.files[0],origin});
 assert.deepEqual(returned.files[1],bundle.files[1]);
 assert.equal(bundle.files[0].origin,undefined,'input remains immutable');
});

test('return to a different Server scope fails closed and a file without provenance stays an ordinary explicit upload',()=>{
 assert.throws(()=>attachReturnProvenance(bundle,{[noteId]:{origin:target.origin,account:'someone-else',workspace:target.workspace,revision:7}},target),/different Server account\/workspace/);
 assert.deepEqual(attachReturnProvenance(bundle,undefined,target),bundle);
});