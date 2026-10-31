import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const b64=s=>Buffer.from(s).toString('base64');
const text=s=>Buffer.from(s,'base64').toString();
const post=(r,path,body={})=>r.fetch('/api/local/'+path,{method:'POST',body:JSON.stringify(body)});
async function fixture({missing=false,warning=false}={}){
 let disk={files:{'Writing/file.md':b64('retained prose'),'Writing/good.md':b64('healthy')},dirs:['Writing']},commits=0;
 const storage={load:async()=>structuredClone(disk),commit:async(before,after)=>{assert.deepEqual(before,disk);commits++;disk=structuredClone(after);}};
 await createLocalRuntime(storage,'recovery');
 if(missing)delete disk.files['Writing/file.md'];else disk.files['Writing/file.md']=b64('external prose');
 if(warning)disk.warnings=[{path:'Writing/file.md',kind:'file',message:'Provider read failed'}];
 const runtime=await createLocalRuntime(storage,'recovery');
 return {runtime,storage,get disk(){return disk;},get commits(){return commits;}};
}
async function preview(f){const r=await f.runtime.fetch('/api/local/recovery');assert.equal(r.status,200,await r.clone().text());return (await r.json()).items.find(n=>n.path==='Writing/file.md');}
for(const action of ['adopt','restore'])test('explicit '+action+' preserves both versions and invalidates stale previews',async()=>{
 const f=await fixture(),item=await preview(f);assert.equal(item.retained,'retained prose');assert.equal(item.external,'external prose');
 const oldCommits=f.commits;assert.equal((await preview(f)).retained,'retained prose');assert.equal(f.commits,oldCommits,'preview never writes');
 const result=await post(f.runtime,'reconcile',{token:item.token,action});assert.equal(result.status,200,await result.clone().text());
 const snapshot=await(await f.runtime.fetch('/api/snapshot')).json(),n=snapshot.notes.find(n=>n.path===item.path);
 assert.equal(n.content,action==='adopt'?'external prose':'retained prose');assert.equal(text(f.disk.files[item.path]),n.content);
 const versions=[n,...n.history].map(n=>n.content);assert.ok(versions.includes('retained prose'));assert.ok(versions.includes('external prose'));
 assert.equal((await post(f.runtime,'reconcile',{token:item.token,action})).status,409);
 assert.equal(f.runtime.warnings.filter(w=>w.path===item.path).length,0);
 const reopened=await createLocalRuntime(f.storage,'recovery');assert.equal(reopened.warnings.length,0);
});
test('reconcile refuses stale source bytes, invalid choice and inaccessible files',async()=>{
 const f=await fixture(),item=await preview(f);const old=f.commits;
 assert.equal((await post(f.runtime,'reconcile',{token:item.token,action:'delete'})).status,400);
 f.disk.files[item.path]=b64('newer external prose');
 assert.equal((await post(f.runtime,'reconcile',{token:item.token,action:'adopt'})).status,409);assert.equal(f.commits,old);assert.equal(text(f.disk.files[item.path]),'newer external prose');
 const blocked=await fixture({missing:true,warning:true}),p=await preview(blocked);assert.equal(p.canRestore,false);
 assert.equal((await post(blocked.runtime,'reconcile',{token:p.token,action:'restore'})).status,409);assert.equal(blocked.disk.files[p.path],undefined);
});
test('missing file requires explicit restore, verified parent, and retains history',async()=>{
 const f=await fixture({missing:true}),p=await preview(f);assert.equal(p.external,null);assert.equal(f.disk.files[p.path],undefined);assert.equal(p.canRestore,true);
 assert.equal((await post(f.runtime,'reconcile',{token:p.token,action:'adopt'})).status,409);
 const r=await post(f.runtime,'reconcile',{token:p.token,action:'restore'});assert.equal(r.status,200,await r.clone().text());assert.equal(text(f.disk.files[p.path]),'retained prose');
 const gone=await fixture({missing:true});gone.disk.dirs=[];
 assert.equal((await post(gone.runtime,'refresh')).status,200);const q=await preview(gone);assert.equal(q.canRestore,false);
 assert.equal((await post(gone.runtime,'reconcile',{token:q.token,action:'restore'})).status,409);
});
test('manual refresh sees external changes and keeps healthy siblings without writing',async()=>{
 const f=await fixture();f.disk.files['Writing/file.md']=b64('retained prose');
 const before=structuredClone(f.disk),count=f.commits;
 const r=await post(f.runtime,'refresh');assert.equal(r.status,200,await r.clone().text());assert.deepEqual(f.disk,before);assert.equal(f.commits,count);
 assert.equal((await(await f.runtime.fetch('/api/snapshot')).json()).notes.length,2);assert.equal(f.runtime.warnings.length,0);
});
test('failed recovery commit is not acknowledged and preserves originals',async()=>{
 const f=await fixture(),r=await createLocalRuntime({...f.storage,commit:async()=>{throw Error('readback failed');}},'recovery'),p=(await(await r.fetch('/api/local/recovery')).json()).items[0];
 const before=structuredClone(f.disk);assert.equal((await post(r,'reconcile',{token:p.token,action:'restore'})).status,503);assert.deepEqual(f.disk,before);
});
