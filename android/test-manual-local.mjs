import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const b64=s=>Buffer.from(s).toString('base64');
async function fixture(){
 let disk={files:{'Writing/first.md':b64('Initial'),'Writing/Child/nested.md':b64('Nested')},dirs:['Writing','Writing/Child','Target']},fail=false,failAfterApply=false,writes=0;
 const storage={manual:true,load:async()=>structuredClone(disk),readText:async p=>disk.files[p],commit:async(b,a)=>{if(fail)throw Error('simulated provider failure');assert.deepEqual(b,disk);disk=structuredClone(a);writes++;if(failAfterApply)throw Error('provider reported failure after applying the operation');}};
 let runtime=await createLocalRuntime(storage,'manual-test');
 return {get diagnostics(){return runtime.diagnostics;},get disk(){return disk;},get writes(){return writes;},set fail(v){fail=v;},set failAfterApply(v){failAfterApply=v;},async reopen(){runtime=await createLocalRuntime(storage,'manual-test');},async call(path,body,method=body?'POST':'GET'){const response=await runtime.fetch('/api'+path,{method,body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}};
}
test('manual actions return affected entries without rebuilding the directory index',async()=>{
 const f=await fixture(),initial=f.diagnostics.indexBuilds;
 const n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');
 const created=await f.call('/folders?localDelta=1',{path:'New'});
 assert.equal(created.status,201);assert.deepEqual(created.data.delta.foldersAdded,['New']);
 assert.deepEqual(created.data.delta.notes,[]);
 const moved=await f.call('/mutate?localDelta=1',mutation(n,{path:'New/first.md'}));
 assert.equal(moved.status,200);assert.equal(moved.data.result.path,'New/first.md');
 assert.equal(moved.data.delta.notes.length,1);assert.equal(moved.data.delta.notes[0].history.length,1);
 assert.equal(moved.data.delta.notes[0].history[0].path,'Writing/first.md');
 const removed=await f.call('/mutate?localDelta=1',mutation(moved.data.result,{deleted:true}));
 assert.equal(removed.status,200);assert.equal(removed.data.delta.notes[0].deleted,true);
 assert.equal(f.diagnostics.indexBuilds,initial,'no per-action full index rebuilds');
 await f.reopen();assert.equal(f.disk.files['New/first.md'],undefined);
});
const mutation=(n,changes)=>({op:crypto.randomUUID(),id:n.id,base:n.rev,path:n.path,content:n.content,deleted:false,...changes});
test('manual edit persists compact active-note metadata and hydrates content on reopen',async()=>{
 const f=await fixture();let n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');const writes=f.writes;
 await f.call('/snapshot');assert.equal(f.writes,writes);
 assert.equal((await f.call('/mutate',mutation(n,{content:'Edited 🌞'}))).status,200);
 const state=JSON.parse(Buffer.from(f.disk.files['.spire-android/state.json'],'base64').toString());
 const persisted=state.notes[n.id];
 assert.equal(Object.hasOwn(persisted,'content'),false,'active file text must not be duplicated in state.json');
 assert.ok(Number.isInteger(persisted.bucket));
 const bucketPath=persisted.bucketPath;
 assert.match(bucketPath,/^\.spire-android\/notes-[0-9a-f]{2}-\d+\.json$/);
 const bucket=JSON.parse(Buffer.from(f.disk.files[bucketPath],'base64').toString());
 assert.equal(bucket.notes[n.id].content,'Edited 🌞');
 assert.equal(bucket.notes[n.id].history.length,1);
 assert.equal(bucket.notes[n.id].history[0].content,'Initial');
 const beforeSecond=structuredClone(f.disk.files);
 const current=(await f.call('/snapshot')).data.notes.find(note=>note.id===n.id);
 assert.equal((await f.call('/mutate',mutation(current,{content:'Edited twice'}))).status,200);
 const changed=Object.keys(f.disk.files).filter(path=>f.disk.files[path]!==beforeSecond[path]);
 const secondState=JSON.parse(Buffer.from(f.disk.files['.spire-android/state.json'],'base64').toString()),secondBucket=secondState.notes[n.id].bucketPath;
 assert.notEqual(secondBucket,bucketPath,'changed buckets are immutable until the index switch is confirmed');
 assert.deepEqual(changed.sort(),['.spire-android/state.json',secondBucket,'Writing/first.md'].sort(),'steady-state edit writes one bounded note bucket');
 await f.reopen();n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');
 assert.equal(n.content,'Edited twice');assert.equal(n.history.length,2);
 assert.deepEqual(n.history.map(revision=>revision.content),['Initial','Edited 🌞']);
});
test('manual create folder, move file and nest folder survive reopen',async()=>{
 const f=await fixture();assert.equal((await f.call('/folders',{path:'New'})).status,201);
 let n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');assert.equal((await f.call('/mutate',mutation(n,{path:'New/first.md'}))).status,200);
 assert.equal((await f.call('/folders/move',{path:'Writing',destination:'Target'})).status,200);
 await f.reopen();assert.equal(f.disk.files['New/first.md'],b64('Initial'));assert.equal(f.disk.files['Target/Writing/Child/nested.md'],b64('Nested'));assert.equal(f.disk.files['Writing/Child/nested.md'],undefined);
});
test('manual mutation acknowledges an operation that the provider applied before reporting failure',async()=>{
 const f=await fixture();f.failAfterApply=true;
 const created=await f.call('/folders?localDelta=1',{path:'VisibleImmediately'});
 assert.equal(created.status,201);assert.deepEqual(created.data.delta.foldersAdded,['VisibleImmediately']);
 const snapshot=await f.call('/snapshot');assert.ok(snapshot.data.folders.includes('VisibleImmediately'));
});
test('failed manual save is not replayed and unrelated files still open',async()=>{
 const f=await fixture();const notes=(await f.call('/snapshot')).data.notes;const n=notes.find(n=>n.path==='Writing/first.md');f.fail=true;
 assert.equal((await f.call('/mutate',mutation(n,{content:'Do not replay'}))).status,503);f.fail=false;
 const other=notes.find(x=>x.id!==n.id);assert.equal((await f.call('/local/open',{id:other.id})).status,200);
 await f.reopen();assert.equal(f.disk.files[n.path],b64('Initial'));
});
test('manual mode refuses legacy reconcile and does not expose recovery actions',async()=>{
 const f=await fixture();assert.deepEqual((await f.call('/local/recovery')).data,{items:[]});assert.equal((await f.call('/local/reconcile',{token:'x',action:'restore'})).status,403);
});
test('folder removal does not resurrect on a later file save',async()=>{
 const f=await fixture();assert.equal((await f.call('/folders',{path:'Disposable'})).status,201);
 assert.equal((await f.call('/folders',{path:'Disposable',mode:'empty'},'DELETE')).status,200);
 const n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');
 assert.equal((await f.call('/mutate',mutation(n,{content:'Later save'}))).status,200);
 assert.ok(!f.disk.dirs.includes('Disposable'));assert.ok(!f.disk.files['.spire-android/pending.json']);
 await f.reopen();assert.ok(!(await f.call('/snapshot')).data.folders.includes('Disposable'));
});
test('new file delta and collision rejection preserve original bytes',async()=>{
 const f=await fixture();const n={id:crypto.randomUUID(),rev:0,path:'Writing/new.md',content:'New writing'};
 const r=await f.call('/mutate?localDelta=1',mutation(n,{}));assert.equal(r.status,200);assert.equal(r.data.delta.notes.length,1);
 const before=structuredClone(f.disk);
 assert.equal((await f.call('/mutate',mutation({...n,id:crypto.randomUUID()},{}))).status,409);
 assert.deepEqual(f.disk,before);
});
test('nested folder creation includes parents in the live delta',async()=>{
 const f=await fixture();const r=await f.call('/folders?localDelta=1',{path:'New/Deep'});assert.equal(r.status,201);
 assert.deepEqual(r.data.delta.foldersAdded.sort(),['New','New/Deep']);
});
test('nested descendant move is refused without changing directory bytes',async()=>{
 const f=await fixture();const before=structuredClone(f.disk);const r=await f.call('/folders/move',{path:'Writing',destination:'Writing/Child'});assert.ok(r.status>=400);assert.deepEqual(f.disk,before);
});
test('unchanged attachment metadata is reused without base64 decoding on every delta',async()=>{
 const original=Buffer.from;let attachmentDecodes=0;
 Buffer.from=function(value,encoding){if(encoding==='base64'&&value==='YmluYXJ5')attachmentDecodes++;return original(value,encoding)};
 try{
  let disk={files:{'Writing/a.md':b64('a'),'media.bin':{kind:'saf',id:'media',size:6,modified:1},'.spire-android/state.json':b64(JSON.stringify({seq:0,notes:{},events:[],folders:['Writing'],styles:{},attachments:[{path:'media.bin',data:'YmluYXJ5'}],conflicts:[],operations:{}}))},dirs:['Writing']};
  const runtime=await createLocalRuntime({manual:true,load:async()=>structuredClone(disk),readText:async p=>disk.files[p],commit:async(b,a)=>{disk=structuredClone(a)}},'attachment-cost');
  attachmentDecodes=0;await runtime.fetch('/api/folders?localDelta=1',{method:'POST',body:JSON.stringify({path:'New'}),headers:{'Content-Type':'application/json'}});
  assert.equal(attachmentDecodes,0);
 }finally{Buffer.from=original;}
});


test('Local fingerprint index matches current files and transfers only changed records',async()=>{
 const f=await fixture(),first=await f.call('/workspace/index');assert.equal(first.status,200);
 const head=await f.call('/workspace/head');assert.equal(head.data.revision,first.data.revision);
 const unchanged=await f.call('/workspace/compare',{index:first.data});assert.equal(unchanged.status,200);assert.equal(unchanged.data.unchanged,true);assert.deepEqual(unchanged.data.notes,[]);
 const n=(await f.call('/snapshot')).data.notes.find(n=>n.path==='Writing/first.md');
 assert.equal((await f.call('/mutate',mutation(n,{content:'Changed'}))).status,200);
 const delta=await f.call('/workspace/compare',{index:first.data});assert.equal(delta.status,200);assert.equal(delta.data.notes.length,1);assert.equal(delta.data.notes[0].content,'Changed');assert.notEqual(delta.data.index.revision,first.data.revision);
 assert.equal((await f.call('/workspace/compare',{index:{}})).status,400);
 const duplicate={...first.data,files:[first.data.files[0],first.data.files[0]]};assert.equal((await f.call('/workspace/compare',{index:duplicate})).status,400);
 const beforeReopen=(await f.call('/snapshot')).data;await f.reopen();const afterReopen=(await f.call('/snapshot')).data;
 assert.deepEqual(afterReopen.notes,beforeReopen.notes);assert.deepEqual(new Set(afterReopen.folders),new Set(beforeReopen.folders));
 await f.reopen();assert.deepEqual((await f.call('/snapshot')).data,afterReopen);
 const reopened=await f.call('/workspace/index'),reopenedHead=await f.call('/workspace/head');assert.equal(reopened.data.revision,reopenedHead.data.revision);
});
