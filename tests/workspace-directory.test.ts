import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceDirectory,DirectoryReader} from '../shared/workspace-directory.ts';
const note=(id='a',rev=1)=>({id,path:`Writing/${id}.md`,rev,deleted:false,time:'2026-01-01T00:00:00Z'});
test('directory projection never touches bodies, histories, or attachment bytes',()=>{
 const n={...note(),get content():string{throw Error('body read at startup');},get history():never[]{throw Error('history read at startup');}};
 const state={seq:2,notes:{a:n},folders:['Writing'],attachments:[{path:'Writing/image.png',get data():string{throw Error('attachment read at startup');}}]};
 const d=workspaceDirectory(state);
 assert.deepEqual(d,{version:1,seq:2,files:[note()],folders:['Writing'],attachments:[{path:'Writing/image.png'}]});
 assert.equal(JSON.stringify(d).includes('content'),false);
});
test('opening a file loads only that body, not history or siblings; concurrent requests share a read',async()=>{
 const reads:string[]=[];const reader=new DirectoryReader(workspaceDirectory({seq:1,notes:{a:note(),b:note('b')},folders:['Writing'],attachments:[]}),{
  file:async(id:string)=>{reads.push(id);return {...note(id),content:`body ${id}`};},
  history:async()=>{throw Error('unrequested history');}
 });
 assert.deepEqual(reads,[]);
 const [a,b]=await Promise.all([reader.open('a'),reader.open('a')]);
 assert.equal(a.content,'body a');assert.deepEqual(a,b);assert.deepEqual(reads,['a']);
});
test('history is requested separately, and only for the selected file',async()=>{
 const reads:string[]=[];const reader=new DirectoryReader(workspaceDirectory({seq:1,notes:{a:note()},folders:[],attachments:[]}),{
  file:async()=>{throw Error('unrequested file');},history:async id=>{reads.push(id);return [];}
 });
 await reader.history('a');assert.deepEqual(reads,['a']);
});
test('a failed body read is retryable and never becomes an empty file',async()=>{
 let calls=0;const reader=new DirectoryReader(workspaceDirectory({seq:1,notes:{a:note()},folders:[],attachments:[]}),{
  file:async()=>{if(++calls===1)throw Error('provider offline');return {...note(),content:'actual text'};},history:async()=>[]
 });
 await assert.rejects(reader.open('a'),/offline/);assert.equal((await reader.open('a')).content,'actual text');assert.equal(calls,2);
});
test('directory replacement invalidates in-flight old-revision reads',async()=>{
 let release!:(v:any)=>void;const reader=new DirectoryReader(workspaceDirectory({seq:1,notes:{a:note()},folders:[],attachments:[]}),{
  file:()=>new Promise(resolve=>{release=resolve;}),history:async()=>[]
 });
 const pending=reader.open('a');await Promise.resolve();
 reader.replace(workspaceDirectory({seq:2,notes:{a:note('a',2)},folders:[],attachments:[]}));release({...note(),content:'stale'});
 await assert.rejects(pending,/changed/);
});
test('missing and deleted files cannot be opened; body identity and revision must match',async()=>{
 const reader=new DirectoryReader(workspaceDirectory({seq:1,notes:{a:note(),b:{...note('b'),deleted:true}},folders:[],attachments:[]}),{
  file:async()=>({...note('wrong'),content:'wrong body'}),history:async()=>[]
 });
 await assert.rejects(reader.open('missing'),/unavailable/);await assert.rejects(reader.open('b'),/unavailable/);await assert.rejects(reader.open('a'),/changed/);
});
