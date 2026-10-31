import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {reconcilePublicationAttachment} from '../client/publication-media-two-way';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test('binary consumer downloads, uploads equal-sized edits, deduplicates, preserves conflicts and resumes from durable base',async()=>{
 let local:string|undefined,remote:string|undefined='one',base:string|undefined,uploads=0,downloads=0;
 const source={raw:async(url:string,options:RequestInit={})=>{if(options.method==='PUT'){const query=new URL(url,'https://test').searchParams;assert.equal(query.get('expected'),local===undefined?'missing':hash(local));local=await (options.body as Blob).text();return Response.json({hash:hash(local)});}return local===undefined?new Response(null,{status:404}):new Response(local);}};
 const target={raw:async(url:string,options:RequestInit={})=>{if(url.includes('attachment-info'))return Response.json(remote===undefined?{hash:'missing',size:0}:{hash:hash(remote),size:remote.length});if(options.method==='PUT'){uploads++;const query=new URL(url,'https://test').searchParams;assert.equal(query.get('base'),remote===undefined?'missing':hash(remote));remote=await (options.body as Blob).text();return Response.json({hash:hash(remote),size:remote.length});}downloads++;return new Response(remote);}};
 const run=()=>reconcilePublicationAttachment({path:'Attachments/test.bin',size:3},source,target,{workspace:'folder',csrf:'token',localCsrf:'local',current:()=>true,readBase:async()=>base,writeBase:async value=>{base=value;}});
 await run();assert.equal(local,'one');assert.equal(downloads,1);assert.equal(base,hash('one'));
 await run();assert.equal(downloads,1);assert.equal(uploads,0);
 local='two';await run();assert.equal(remote,'two');assert.equal(uploads,1);
 remote='six';await run();assert.equal(local,'six');assert.equal(downloads,2);
 local='abc';remote='xyz';await assert.rejects(run(),/conflict/i);assert.equal(local,'abc');assert.equal(remote,'xyz');assert.equal(base,hash('six'));
});
