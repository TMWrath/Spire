import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';

const b64=value=>Buffer.from(value).toString('base64');
async function seeded(content){
 let disk={files:{'Writing/a.md':b64(content)},dirs:['Writing']};
 const runtime=await createLocalRuntime({manual:true,load:async()=>structuredClone(disk),commit:async(_before,after)=>{disk=structuredClone(after);}},'seed-'+content);
 const note=(await(await runtime.fetch('/api/snapshot')).json()).notes[0];
 const saved=await runtime.fetch('/api/mutate',{method:'POST',body:JSON.stringify({op:crypto.randomUUID(),id:note.id,base:note.rev,path:note.path,content:content+'!',deleted:false})});
 assert.equal(saved.status,200);
 return disk;
}

test('manual Local skips startup-wide folder verification and writes despite a legacy recovery marker',async()=>{
 const cached={...(await seeded('cached')),provisional:true,recoveryPending:true};
 const loads=[];let disk=structuredClone(cached),commits=0;
 const runtime=await createLocalRuntime({manual:true,load:async indexed=>{loads.push(indexed);assert.equal(indexed,true,'manual startup must use the cached index, not a whole-folder scan');return structuredClone(disk);},commit:async(_before,after)=>{commits++;disk=structuredClone(after);}},'startup-manual');
 await runtime.reconciled;
 assert.deepEqual(loads,[true]);
 const response=await runtime.fetch('/api/folders',{method:'POST',body:JSON.stringify({path:'New'})});
 assert.equal(response.status,201);
 assert.equal(commits,1);
 assert.ok(disk.dirs.includes('New'));
 assert.deepEqual(loads,[true],'a create must not wait for or trigger workspace-wide verification');
});

test('manual Local refresh explicitly reloads the directory without consuming legacy journal metadata',async()=>{
 const cached={...(await seeded('cached')),provisional:true,recoveryPending:true};
 const fresh={...(await seeded('provider')),recoveryPending:true};
 fresh.files['.spire-android/pending.json']=b64('{"legacy":"untouched"}');
 const loads=[];let disk=structuredClone(fresh);
 const runtime=await createLocalRuntime({manual:true,load:async indexed=>{loads.push(indexed);return structuredClone(indexed?cached:disk);},commit:async(_before,after)=>{disk=structuredClone(after);}},'explicit-refresh');
 await runtime.reconciled;
 assert.deepEqual(loads,[true],'no automatic full-folder reconciliation at startup');
 const response=await runtime.fetch('/api/local/refresh',{method:'POST'});
 assert.equal(response.status,200,await response.clone().text());
 assert.deepEqual(loads,[true,undefined]);
 const snapshot=await(await runtime.fetch('/api/snapshot')).json();
 assert.equal(snapshot.notes[0].content,'provider!');
 assert.equal(disk.files['.spire-android/pending.json'],b64('{"legacy":"untouched"}'));
});