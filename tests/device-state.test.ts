import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceKey,deviceStorage,type CacheStorage,type DeviceStateBridge} from '../client/device-state';
function legacy(entries:Record<string,unknown>={}):CacheStorage{const m=new Map<string,any>(Object.entries(entries));return {get:async(_,k)=>m.get(String(k)),put:async(_,v,k)=>{m.set(String(k),structuredClone(v));return k;},delete:async(_,k)=>{m.delete(String(k));},getAllKeys:async()=>[...m.keys()]};}
function native(){const state=new Map<string,{present:boolean;value?:unknown}>();const bridge:DeviceStateBridge=async r=>{if(r.op==='import'){for(const [k,v]of Object.entries(r.entries!))if(!state.has(k))state.set(k,{present:true,value:structuredClone(v)});return {};}if(r.op==='get')return structuredClone(state.get(r.key!)??{present:false});state.set(r.key!,r.op==='delete'?{present:false}:{present:true,value:structuredClone(r.value)});return {};};return {state,bridge};}
const scope={kind:'server',origin:'https://example.com',account:'alice',workspace:'books'},cache=JSON.stringify(['server',scope.origin,scope.account,scope.workspace,'cache']);
test('Server profile, installation and pending Server drafts survive folder changes/restart; Local caches stay separate',async()=>{
 const n=native(),a=legacy({'server-profile':scope,'installation-identity':{id:'device-a',secret:'private'},[cache]:{outbox:[{content:'pending words'}]},'local-manual-v2':{content:'folder A'},'transfer:1':{phase:'interrupted'}});
 const first=await deviceStorage(a,n.bridge);const second=await deviceStorage(legacy({'local-manual-v2':{content:'folder B'}}),n.bridge);
 assert.deepEqual(await second.get('cache','server-profile'),scope);assert.deepEqual(await second.get('cache',cache),{outbox:[{content:'pending words'}]});assert.deepEqual(await second.get('cache','installation-identity'),{id:'device-a',secret:'private'});
 assert.deepEqual(await first.get('cache','local-manual-v2'),{content:'folder A'});assert.deepEqual(await second.get('cache','local-manual-v2'),{content:'folder B'});assert.equal(await second.get('cache','transfer:1'),undefined);
 const restart=await deviceStorage(legacy(),n.bridge);assert.deepEqual(await restart.get('cache',cache),await first.get('cache',cache));assert.equal(n.state.has('local-manual-v2'),false);assert.equal(n.state.has('transfer:1'),false);
});
test('migration never overwrites newer native values or resurrects signed-out profiles',async()=>{
 const n=native(),old=legacy({'server-profile':scope,[cache]:{outbox:['older']}});let store=await deviceStorage(old,n.bridge);
 await store.put('cache',{outbox:['newer']},cache);await store.delete('cache','server-profile');store=await deviceStorage(old,n.bridge);
 assert.equal(await store.get('cache','server-profile'),undefined);assert.deepEqual(await store.get('cache',cache),{outbox:['newer']});assert.deepEqual(await old.get('cache','server-profile'),scope,'legacy recovery is untouched');
});
test('different accounts and servers cannot collide; no publication consent is device-wide',async()=>{
 const n=native(),a=await deviceStorage(legacy(),n.bridge),b=await deviceStorage(legacy(),n.bridge),other=JSON.stringify(['server',scope.origin,'bob',scope.workspace,'cache']);
 await a.put('cache',{outbox:['alice']},cache);await a.put('cache',{outbox:['bob']},other);await a.put('cache',scope,'publication-consent');
 assert.deepEqual(await b.get('cache',other),{outbox:['bob']});assert.deepEqual(await b.get('cache',cache),{outbox:['alice']});assert.equal(await b.get('cache','publication-consent'),undefined);
 for(const k of ['current','local-manual-v2','publication-consent','device-publication:1','transfer:1','["local","https://example.com","a","b","cache"]','["server","http://example.com","a","b","cache"]'])assert.equal(deviceKey(k),false,k);
});
test('browser-only storage remains unchanged and native failures never silently start a fresh identity',async()=>{
 const old=legacy({'server-profile':scope});assert.equal(await deviceStorage(old),old);await assert.rejects(()=>deviceStorage(old,async()=>{throw Error('key unavailable');}),/key unavailable/);assert.deepEqual(await old.get('cache','server-profile'),scope);
});
