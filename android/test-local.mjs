import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const blank=()=>({files:{'Writing/existing.md':Buffer.from('Hello 🌞').toString('base64')},dirs:['Writing']});
test('binary sync hydrates SAF bytes, rejects stale replacements, persists deletion and survives reopen',async()=>{
 const {createHash}=await import('node:crypto'),hash=s=>createHash('sha256').update(s).digest('hex');
 let disk=blank(),source='one',fail=false;const target='Writing/media.bin';disk.files[target]={kind:'saf',id:'media',size:3,modified:1};
 const bridge={load:async()=>structuredClone(disk),read:async()=>Buffer.from(source).toString('base64'),commit:async(before,after)=>{assert.deepEqual(before,disk);if(fail)throw Error('Provider disconnected');disk=structuredClone(after);}};
 let runtime=await createLocalRuntime(bridge,'binary-sync');
 const update=(expected,value)=>runtime.fetch('/api/attachments/sync?path='+encodeURIComponent(target)+'&expected='+expected,{method:value===null?'DELETE':'PUT',headers:{'Content-Type':'application/octet-stream'},body:value===null?undefined:Buffer.from(value)});
 let response=await update(hash('one'),'two');assert.equal(response.status,200,await response.clone().text());assert.equal(Buffer.from(disk.files[target],'base64').toString(),'two');
 runtime=await createLocalRuntime(bridge,'binary-sync');assert.equal((await update(hash('one'),'bad')).status,409);assert.equal(Buffer.from(disk.files[target],'base64').toString(),'two');
 fail=true;assert.equal((await update(hash('two'),'six')).status,503);assert.equal(Buffer.from(disk.files[target],'base64').toString(),'two');
 fail=false;runtime=await createLocalRuntime(bridge,'binary-sync');response=await update(hash('two'),null);assert.equal(response.status,200,await response.clone().text());
 runtime=await createLocalRuntime(bridge,'binary-sync');assert.equal(disk.files[target],undefined);assert.equal((await(await runtime.fetch('/api/snapshot')).json()).attachments.length,0);
});
test('SAF runtime transfer receipts survive restart, hydrate media and fail closed on changed sources',async()=>{
 let sourceDisk={files:{'Pack/file.md':Buffer.from('![photo](photo.png)').toString('base64'),'Pack/photo.png':{kind:'saf',id:'photo',size:4,modified:1}},dirs:['Pack']},targetDisk={files:{},dirs:[]};
 const bytes=Buffer.from([1,2,3,4]);
 const sourceBridge={load:async()=>structuredClone(sourceDisk),read:async()=>bytes.toString('base64'),commit:async(before,after)=>{assert.deepEqual(before,sourceDisk);sourceDisk=structuredClone(after);}};
 const targetBridge={load:async()=>structuredClone(targetDisk),commit:async(before,after)=>{assert.deepEqual(before,targetDisk);targetDisk=structuredClone(after);}};
 let source=await createLocalRuntime(sourceBridge,'source'),target=await createLocalRuntime(targetBridge,'target');
 const bundle={...await(await source.fetch('/api/transfers?path=Pack')).json(),operation:crypto.randomUUID()};
 assert.equal(bundle.files.find(f=>f.path==='Pack/photo.png').data,bytes.toString('base64'));
 const post=async(runtime,url,body)=>runtime.fetch(url,{method:'POST',body:JSON.stringify(body)});
 let response=await post(target,'/api/transfers',bundle);assert.equal(response.status,200,await response.clone().text());
 target=await createLocalRuntime(targetBridge,'target');response=await post(target,'/api/transfers',bundle);assert.equal(response.status,200,await response.clone().text());
 assert.equal((await(await target.fetch('/api/snapshot')).json()).notes.length,1);
 assert.equal(targetDisk.files['Pack/photo.png'],bytes.toString('base64'));
 source=await createLocalRuntime(sourceBridge,'source');const n=(await(await source.fetch('/api/snapshot')).json()).notes[0];
 response=await post(source,'/api/mutate',{...n,base:n.rev,op:crypto.randomUUID(),content:'Changed before removal'});assert.equal(response.status,200);
 response=await post(source,'/api/transfers/remove',bundle);assert.equal(response.status,409,await response.clone().text());
 assert.equal(Buffer.from(sourceDisk.files['Pack/file.md'],'base64').toString(),'Changed before removal');
});
test('deferred SAF attachments never read or rewritten during startup, editing or reopen',async()=>{
 let disk=blank(),reads=0;const ref={kind:'saf',id:'opaque',size:8000000000,modified:7};disk.files['Writing/large.mp4']=ref;
 const bridge={load:async()=>structuredClone(disk),read:async()=>{reads++;throw Error('Provider stalls');},commit:async(b,a)=>{assert.deepEqual(b,disk);assert.deepEqual(a.files['Writing/large.mp4'],ref);disk=structuredClone(a);}};
 let runtime=await createLocalRuntime(bridge,'lazy');let snapshot=await(await runtime.fetch('/api/snapshot')).json();
 assert.equal(snapshot.attachments[0].size,ref.size);const n=snapshot.notes[0];
 const saved=await runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:n.id,base:n.rev,path:n.path,content:'Still editable',deleted:false})});assert.equal(saved.status,200);
 runtime=await createLocalRuntime(bridge,'lazy');snapshot=await(await runtime.fetch('/api/snapshot')).json();assert.equal(snapshot.notes[0].content,'Still editable');assert.equal(reads,0);
 const archive=await runtime.fetch('/api/export');assert.equal(archive.status,413);assert.equal(reads,0,'oversize export must fail before loading large media');
});
test('deferred attachment reads and exports contain real bytes, never reference markers',async()=>{
 let disk=blank(),reads=0;const bytes=Buffer.from([0,1,255,128,4]),ref={kind:'saf',id:'media',size:bytes.length,modified:1};disk.files['Writing/media.bin']=ref;
 const bridge={load:async()=>structuredClone(disk),read:async(p,r)=>{assert.equal(p,'Writing/media.bin');assert.deepEqual(r,ref);reads++;return bytes.toString('base64');},commit:async(b,a)=>{assert.deepEqual(b,disk);disk=structuredClone(a);}};
 const runtime=await createLocalRuntime(bridge,'read-lazy');assert.equal(reads,0);
 assert.deepEqual(Buffer.from(await(await runtime.fetch('/api/attachment?path=Writing%2Fmedia.bin')).arrayBuffer()),bytes);
 const {unzipSync}=await import('fflate');const zip=unzipSync(new Uint8Array(await(await runtime.fetch('/api/export')).arrayBuffer()));assert.deepEqual(Buffer.from(zip['Writing/media.bin']),bytes);assert.equal(reads,2);assert.deepEqual(disk.files['Writing/media.bin'],ref);
});
test('legacy inline attachment metadata migrates to SAF references without rewriting the media',async()=>{
 let disk=blank();disk.files['Writing/media.bin']=Buffer.from('real media').toString('base64');
 const bridge={load:async()=>structuredClone(disk),commit:async(b,a)=>{assert.deepEqual(b,disk);disk=structuredClone(a);}};
 await createLocalRuntime(bridge,'migration');const ref={kind:'saf',id:'legacy',size:10,modified:2};disk.files['Writing/media.bin']=ref;
 const runtime=await createLocalRuntime(bridge,'migration');assert.equal((await runtime.fetch('/api/snapshot')).status,200);assert.deepEqual(disk.files['Writing/media.bin'],ref);
});
test('local folders, template metadata and binary attachments survive reopen and portable export',async()=>{
 let disk=blank();const bridge={load:async()=>structuredClone(disk),commit:async(b,a)=>{assert.deepEqual(b,disk);disk=structuredClone(a);}};
 let runtime=await createLocalRuntime(bridge,'features');
 const call=async(url,method,body)=>{const r=await runtime.fetch(url,{method,body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;};
 await call('/api/folders','POST',{path:'Writing/Empty'});assert.ok(disk.dirs.includes('Writing/Empty'));
 await call('/api/folders','DELETE',{path:'Writing/Empty',mode:'empty'});assert.ok(!disk.dirs.includes('Writing/Empty'));
 const bytes=Uint8Array.from([0,1,2,127,128,255]);const upload=new FormData();upload.append('path','Attachments/test.bin');upload.append('file',new Blob([bytes]),'test.bin');
 const attached=await runtime.fetch('/api/attachments?path=Attachments%2Ftest.bin',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes});assert.ok(attached.ok,await attached.text());assert.deepEqual(Buffer.from(disk.files['Attachments/test.bin'],'base64'),Buffer.from(bytes));
 assert.deepEqual(new Uint8Array(await(await runtime.fetch('/api/attachment?path=Attachments%2Ftest.bin')).arrayBuffer()),bytes);
 const template=await call('/api/templates','POST',{title:'Portable',category:'full',content:'# Template 🌞',sourcePath:'Writing/existing.md'});
 runtime=await createLocalRuntime(bridge,'features');const snapshot=await(await runtime.fetch('/api/snapshot')).json();assert.ok(snapshot.templates.some(t=>t.id===template.id));assert.ok(snapshot.attachments.some(a=>a.path==='Attachments/test.bin'&&a.size===bytes.length));
 const archive=await(await runtime.fetch('/api/export')).arrayBuffer();const {unzipSync}=await import('fflate');const files=unzipSync(new Uint8Array(archive));assert.deepEqual(files['Attachments/test.bin'],bytes);assert.equal(new TextDecoder().decode(files['Writing/existing.md']),'Hello 🌞');
});
test('local folder indexes real files and durably saves full editor mutations',async()=>{
 let disk=blank(),writes=0;
 const runtime=await createLocalRuntime({load:async()=>structuredClone(disk),commit:async(before,after)=>{assert.deepEqual(before,disk);disk=structuredClone(after);writes++;}},'test-workspace');
 let snapshot=await (await runtime.fetch('/api/snapshot')).json();assert.equal(snapshot.notes[0].content,'Hello 🌞');
 const n=snapshot.notes[0];
 const result=await runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:n.id,base:n.rev,path:n.path,content:'Changed',deleted:false})});
 assert.equal(result.status,200);assert.equal(Buffer.from(disk.files[n.path],'base64').toString(),'Changed');assert.ok(writes>=2);
 const reopened=await createLocalRuntime({load:async()=>structuredClone(disk),commit:async(b,a)=>{disk=a;}},'test-workspace');
 snapshot=await(await reopened.fetch('/api/snapshot')).json();assert.equal(snapshot.notes[0].content,'Changed');assert.equal(snapshot.notes[0].history.length,1);
});
test('failed durable commit is never acknowledged and retains original bytes',async()=>{
 let disk=blank(),fail=false;const runtime=await createLocalRuntime({load:async()=>structuredClone(disk),commit:async(b,a)=>{if(fail)throw Error('Permission revoked');disk=structuredClone(a);}},'failure');fail=true;
 const n=(await(await runtime.fetch('/api/snapshot')).json()).notes[0];
 const response=await runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:n.id,base:n.rev,path:n.path,content:'Unsafe',deleted:false})});
 assert.equal(response.status,503);assert.equal(Buffer.from(disk.files[n.path],'base64').toString(),'Hello 🌞');
});
test('failed save keeps unrelated file opening available without acknowledging or retrying writes',async()=>{
 let disk=blank(),fail=false,commits=0,reads=0;
 const runtime=await createLocalRuntime({load:async()=>structuredClone(disk),readText:async p=>{reads++;return disk.files[p];},commit:async(b,a)=>{commits++;if(fail)throw Error('Provider unavailable');disk=structuredClone(a);}},'read-after-failure');
 const n=(await(await runtime.fetch('/api/snapshot')).json()).notes[0];fail=true;
 const save=()=>runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:n.id,base:n.rev,path:n.path,content:'Retained unsaved edit',deleted:false})});
 assert.equal((await save()).status,503);const attempts=commits;
 const opened=await runtime.fetch('/api/local/open',{method:'POST',body:JSON.stringify({id:n.id})});
 assert.equal(opened.status,200);assert.equal((await opened.json()).content,'Hello 🌞');assert.equal(reads,1);
 assert.equal((await save()).status,503);assert.equal(commits,attempts,'opening must not replay or retry failed commits');
 assert.equal((await(await runtime.fetch('/api/snapshot')).json()).notes[0].content,'Hello 🌞','failed mutations must not leak into the verified snapshot');
});
test('local endpoints reject traversal, keep conflicts and portable archives',async()=>{
 let disk=blank();const runtime=await createLocalRuntime({load:async()=>structuredClone(disk),commit:async(b,a)=>{disk=structuredClone(a);}},'security');
 assert.equal((await runtime.fetch('/api/folders',{method:'POST',body:JSON.stringify({path:'../escape'})})).status,400);
 const n=(await(await runtime.fetch('/api/snapshot')).json()).notes[0];
 assert.equal((await runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:n.id,base:0,path:n.path,content:'Conflict',deleted:false})})).status,409);
 assert.equal((await(await runtime.fetch('/api/snapshot')).json()).conflicts.length,1);
 const zip=await runtime.fetch('/api/export');assert.equal(zip.status,200);assert.equal(zip.headers.get('Content-Type'),'application/zip');assert.ok((await zip.arrayBuffer()).byteLength>20);
});
