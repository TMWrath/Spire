import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const b64=s=>Buffer.from(s).toString('base64');
async function fixture(){
 let disk={files:{'Writing/a.md':b64('original')},dirs:['Writing']},commits=0;
 const storage={load:async()=>structuredClone(disk),commit:async(before,after)=>{assert.deepEqual(before,disk);disk=structuredClone(after);commits++;}};
 await createLocalRuntime(storage,'directory');
 return {storage,get disk(){return disk;},get commits(){return commits;}};
}
const snapshot=async r=>(await(await r.fetch('/api/snapshot')).json());
test('external edit is read-only on open and remains editable with both versions in durable history',async()=>{
 const f=await fixture();f.disk.files['Writing/a.md']=b64('external');const before=structuredClone(f.disk),count=f.commits;
 const r=await createLocalRuntime(f.storage,'directory'),n=(await snapshot(r)).notes[0];
 assert.equal(n.content,'external');assert.equal(r.warnings.length,0);assert.deepEqual(f.disk,before);assert.equal(f.commits,count);
 assert.ok(n.history.some(h=>h.content==='original'));
 const response=await r.fetch('/api/mutate',{method:'POST',body:JSON.stringify({...n,base:n.rev,op:crypto.randomUUID(),content:'edited in Spire'})});
 assert.equal(response.status,200,await response.clone().text());
 const reopened=await createLocalRuntime(f.storage,'directory'),saved=(await snapshot(reopened)).notes[0];
 assert.equal(saved.content,'edited in Spire');assert.ok(saved.history.some(h=>h.content==='external'));assert.ok(saved.history.some(h=>h.content==='original'));assert.equal(reopened.warnings.length,0);
});
test('complete scan removes missing paths from active view without rewriting or repeated warnings',async()=>{
 const f=await fixture();delete f.disk.files['Writing/a.md'];f.disk.dirs=[];const before=structuredClone(f.disk);
 for(let i=0;i<3;i++){const r=await createLocalRuntime(f.storage,'directory');assert.equal((await snapshot(r)).notes.length,0);assert.equal(r.warnings.length,0);assert.deepEqual(f.disk,before);assert.equal((await(await r.fetch('/api/local/recovery')).json()).items.length,1);}
});
test('provider failure remains an error, not a confirmed deletion or implicit restore',async()=>{
 const f=await fixture();delete f.disk.files['Writing/a.md'];f.disk.warnings=[{path:'Writing',kind:'folder',message:'Provider unavailable'}];
 const before=structuredClone(f.disk),r=await createLocalRuntime(f.storage,'directory');assert.ok(r.warnings.length);assert.equal((await r.fetch('/api/export')).status,409);
 const p=(await(await r.fetch('/api/local/recovery')).json()).items[0];assert.equal(p.canRestore,false);assert.deepEqual(f.disk,before);
});
