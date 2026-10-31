import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pullWorkspace} from '../client/workspace-pull';
import {buildWorkspaceIndex} from '../shared/workspace-index';
const note={id:'11111111-1111-4111-8111-111111111111',path:'Folder/A.md',content:'secret body',rev:1,deleted:false,time:'2026-01-01T00:00:00Z',history:[]};
const snapshot={seq:1,notes:[note],folders:['Folder'],styles:{},conflicts:[],attachments:[]};
const index=buildWorkspaceIndex(snapshot);
const manifest={index,snapshot:{...snapshot,notes:[{...note,content:'',history:[],contentLoaded:false}]}};
test('structure pulls check revision first, fetch only metadata, and reuse unchanged heads',async()=>{
 const requests:string[]=[];const request=async(p:string)=>{requests.push(p);if(p==='/workspace/head')return {revision:index.revision};if(p==='/workspace/manifest')return manifest;throw Error('unexpected body request '+p);};
 const first=await pullWorkspace(request,undefined,true);assert.deepEqual(requests,['/workspace/head','/workspace/manifest']);assert.equal(first.base.snapshot.notes[0].content,'');
 requests.length=0;const same=await pullWorkspace(request,first.base,true);assert.deepEqual(requests,['/workspace/head']);assert.equal(same.base,first.base);
});
test('changed previously opened files refresh their bodies without loading unopened siblings',async()=>{
 const before={...snapshot,notes:[{...note,contentLoaded:true}]};
 const base={index,snapshot:before,structureOnly:true};
 const changed={...note,rev:2,content:'updated on server',contentLoaded:true};
 const sibling={...note,id:'22222222-2222-4222-8222-222222222222',path:'Folder/B.md'};
 const next={...snapshot,seq:2,notes:[changed,sibling]};
 const calls:string[]=[];
 const result=await pullWorkspace(async p=>{calls.push(p);if(p==='/workspace/head')return {revision:buildWorkspaceIndex(next).revision};if(p==='/workspace/manifest')return {index:buildWorkspaceIndex(next),snapshot:{...next,notes:next.notes.map(n=>({...n,content:'',contentLoaded:false}))}};if(p==='/workspace/files/'+note.id+'/content')return changed;throw Error('Unexpected '+p);},base,true);
 assert.equal(result.base.snapshot.notes[0].content,'updated on server');
 assert.equal(result.base.snapshot.notes[1].content,'');
 assert.equal(calls.filter(p=>p.endsWith('/content')).length,1);
 assert.equal(result.received[0].content,'updated on server');
});
test('structure pull never falls back to downloading all bodies on an old server',async()=>{
 const requests:string[]=[];await assert.rejects(pullWorkspace(async p=>{requests.push(p);throw Object.assign(Error('Not found'),{status:404});},undefined,true));assert.deepEqual(requests,['/workspace/head']);
});
