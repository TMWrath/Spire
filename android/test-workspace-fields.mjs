import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
test('provider applies remote quick actions and folders durably with CAS',async()=>{
 let disk={files:{},dirs:[]};const bridge={load:async()=>structuredClone(disk),commit:async(b,a)=>{assert.deepEqual(b,disk);disk=structuredClone(a);}};
 let runtime=await createLocalRuntime(bridge,'fields');
 const fields={folders:['Writing'],quickActions:[{id:crypto.randomUUID(),revision:1,label:'Daily',folder:'Writing',namePattern:'Entry',templateId:null}]};
 const send=body=>runtime.fetch('/api/workspace/fields',{method:'POST',body:JSON.stringify(body)});
 const response=await send({expected:{folders:[],quickActions:[]},changes:fields});assert.equal(response.status,200,await response.text());
 runtime=await createLocalRuntime(bridge,'fields');const snapshot=await(await runtime.fetch('/api/snapshot')).json();
 assert.deepEqual(snapshot.quickActions,fields.quickActions);assert.ok(snapshot.folders.includes('Writing'));
 const stale=await send({expected:{folders:[]},changes:{folders:['Other']}});assert.equal(stale.status,409);
});
