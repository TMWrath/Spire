import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const b64=s=>Buffer.from(s).toString('base64');
function fixture({fail=false}={}){
 const id='11111111-1111-4111-8111-111111111111';
 const note={id,path:'Writing/A.md',content:'Before',rev:1,deleted:false,history:[],time:new Date().toISOString()};
 let disk={dirs:['Writing','.spire-android'],files:{'Writing/A.md':b64('Before'),'.spire-android/state.json':b64(JSON.stringify({version:1,seq:1,notes:{[id]:note},folders:['Writing'],styles:{},conflicts:[],events:[],operations:{},attachments:[]}))}};
 const bytesByPath=new Map();let commits=0,mediaReads=0;
 const storage={manual:true,structureOnly:true,load:async()=>structuredClone(disk),readText:async path=>disk.files[path],read:async path=>{mediaReads++;return bytesByPath.get(path);},reference:async path=>disk.files[path],commit:async(before,after)=>{
  if(fail)throw Error('Provider denied write');
  assert.deepEqual(before,disk);commits++;disk=structuredClone(after);
  for(const [path,value] of Object.entries(disk.files))if(path.startsWith('Attachments/')&&typeof value==='string'){
   bytesByPath.set(path,value);disk.files[path]={kind:'saf',id:path,size:Buffer.from(value,'base64').length,modified:1};
  }
 }};
 return {id,note,storage,get disk(){return disk;},bytesByPath,get commits(){return commits;},get mediaReads(){return mediaReads;}};
}
const upload=(runtime,body,path='Attachments/test.mp4')=>runtime.fetch('/api/attachments?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body});
test('editor video upload, save and reopen preserve bytes with no binary reread or Store rebuild on upload',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'video-insert');
 const opened=await(await runtime.fetch('/api/local/open',{method:'POST',body:JSON.stringify({id:f.id})})).json();
 const bytes=new Uint8Array(2_000_001);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 let ticks=0;const interval=setInterval(()=>ticks++,0);
 const uploaded=await upload(runtime,new Blob([bytes],{type:'video/mp4'}));clearInterval(interval);
 assert.equal(uploaded.status,200,await uploaded.clone().text());assert.ok(ticks>1,'UI event loop yields between encoding chunks');
 assert.equal(runtime.diagnostics.indexBuilds,0);assert.equal(f.mediaReads,0);
 const content='Before\n<video controls src="../Attachments/test.mp4"></video>\n';
 const saved=await runtime.fetch('/api/mutate?localDelta=1',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:f.id,base:opened.rev,path:f.note.path,content,deleted:false})});
 assert.equal(saved.status,200,await saved.clone().text());assert.equal(f.mediaReads,0);
 const state=JSON.parse(Buffer.from(f.disk.files['.spire-android/state.json'],'base64'));assert.ok(state.attachments[0].data.length<256,'Only an opaque reference, never the media bytes, is retained');
 const reopened=await createLocalRuntime(f.storage,'video-insert');
 const actual=await(await reopened.fetch('/api/local/open',{method:'POST',body:JSON.stringify({id:f.id})})).json();assert.equal(actual.content,content);
 const attachment=await reopened.fetch('/api/attachment?path=Attachments%2Ftest.mp4');assert.equal(attachment.status,200);assert.deepEqual(Buffer.from(await attachment.arrayBuffer()),Buffer.from(bytes));
});
test('Local video above old 10 MB limit inserts through bounded yielding path',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'large-video');
 const bytes=new Uint8Array(10_000_001).fill(83);const response=await upload(runtime,new Blob([bytes]));
 assert.equal(response.status,200,await response.clone().text());assert.deepEqual(Buffer.from(f.bytesByPath.get('Attachments/test.mp4'),'base64'),Buffer.from(bytes));assert.equal(runtime.diagnostics.indexBuilds,0);
});
test('oversized video is rejected without reading, encoding or committing it',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'oversized-video');
 class Oversized extends Blob{get size(){return 32*1024*1024+1;}slice(){throw Error('Must reject before reading');}arrayBuffer(){throw Error('Must reject before reading');}}
 const response=await upload(runtime,new Oversized());assert.equal(response.status,413);assert.equal(f.commits,0);
});
test('failed provider write creates no phantom attachment and preserves the note',async()=>{
 const f=fixture({fail:true}),runtime=await createLocalRuntime(f.storage,'failed-video');
 const response=await upload(runtime,new Blob(['video']));assert.equal(response.status,503);
 const snapshot=await(await runtime.fetch('/api/snapshot')).json();assert.deepEqual(snapshot.attachments,[]);assert.equal(f.commits,0);assert.equal(Buffer.from(f.disk.files['Writing/A.md'],'base64').toString(),'Before');
});
test('case-insensitive duplicate attachment is never overwritten',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'duplicate-video');
 assert.equal((await upload(runtime,new Blob(['original']))).status,200);
 assert.equal((await upload(runtime,new Blob(['replacement']),'Attachments/TEST.mp4')).status,409);
 assert.equal(Buffer.from(f.bytesByPath.get('Attachments/test.mp4'),'base64').toString(),'original');assert.equal(f.commits,1);
});
