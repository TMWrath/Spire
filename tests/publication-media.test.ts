import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncPublicationAttachments} from '../client/publication-media';

const bytes=new Uint8Array([0xff,0xd8,0xff,1,2,3]);
test('publication media uploads missing bytes then skips unchanged content by hash',async()=>{
 const calls:{side:string;method:string;url:string}[]=[];let available=false;
 const local={raw:async(url:string)=>{calls.push({side:'local',method:'GET',url});return new Response(bytes);}};
 const remote={raw:async(url:string,options:RequestInit={})=>{const method=options.method??'GET';calls.push({side:'remote',method,url});if(method==='HEAD')return new Response(null,{status:available?204:404});assert.ok(options.body instanceof Blob);assert.deepEqual(new Uint8Array(await (options.body as Blob).arrayBuffer()),bytes);available=true;return new Response(JSON.stringify({stored:true}),{status:200,headers:{'Content-Type':'application/json'}});}};
 const snapshot={attachments:[{path:'Attachments/photo.jpg',size:bytes.length}]};
 await syncPublicationAttachments(snapshot,local as any,remote as any,'csrf');
 await syncPublicationAttachments(snapshot,local as any,remote as any,'csrf');
 assert.equal(calls.filter(c=>c.side==='remote'&&c.method==='PUT').length,1);
 assert.equal(calls.filter(c=>c.side==='local').length,2);
});

test('publication media refuses missing or size-mismatched Local bytes',async()=>{
 const remote={raw:async()=>{throw Error('must not contact remote');}};
 await assert.rejects(syncPublicationAttachments({attachments:[{path:'Attachments/missing.jpg',size:5}]},{raw:async()=>new Response(null,{status:404})} as any,remote as any,'csrf'),/unavailable/i);
 await assert.rejects(syncPublicationAttachments({attachments:[{path:'Attachments/wrong.jpg',size:5}]},{raw:async()=>new Response(new Uint8Array([1]))} as any,remote as any,'csrf'),/size differs/i);
});

test('invalidated workspace jobs cannot upload after an awaited read or hash probe',async()=>{
 for(const invalidateAt of ['before','read','probe']){
  let current=invalidateAt!=='before',reads=0,uploads=0;
  const local={raw:async()=>{reads++;if(invalidateAt==='read')current=false;return new Response(bytes);}};
  const remote={raw:async(_url:string,options:RequestInit={})=>{if(options.method==='HEAD'){if(invalidateAt==='probe')current=false;return new Response(null,{status:404});}uploads++;return new Response('{}');}};
  await assert.rejects(syncPublicationAttachments({attachments:[{path:'Attachments/test.jpg',size:bytes.length}]},local,remote,'csrf',()=>current),/workspace changed/i);
  assert.equal(uploads,0);if(invalidateAt==='before')assert.equal(reads,0);
 }
});
