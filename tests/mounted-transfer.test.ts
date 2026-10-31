import test from 'node:test';
import assert from 'node:assert/strict';
import {transferMountedFile,type TransferAdapter,type TransferBundle} from '../shared/mounted-transfer';
const original:TransferBundle={path:'Writing/file.md',version:'v1',pending:false,files:[{path:'Writing/file.md',bytes:new TextEncoder().encode('![picture](image.png)')},{path:'Writing/image.png',bytes:new Uint8Array([0,255,42])}]};
function harness(){let removed=false,written:TransferBundle|undefined;const events:string[]=[];
 const source:TransferAdapter={read:async()=>structuredClone(original),create:async()=>{throw Error('unused');},removeIfUnchanged:async(_path,expected)=>{events.push('remove');assert.equal(expected.version,'v1');removed=true;}};
 const destination:TransferAdapter={read:async()=>{events.push('verify');if(!written)throw Error('absent');return structuredClone(written);},create:async bundle=>{events.push('write');written=structuredClone(bundle);return {acknowledged:true};},removeIfUnchanged:async()=>{throw Error('unused');}};
 return {source,destination,events,get removed(){return removed;}};
}
test('bidirectional adapter transfer verifies all attachment bytes before conditional removal',async()=>{
 for(const direction of ['local-server','server-local']){const h=harness();await transferMountedFile(h.source,h.destination,original.path);assert.equal(h.removed,true,direction);assert.deepEqual(h.events,['write','verify','remove']);}
});
test('unacknowledged destination retains source',async()=>{const h=harness();h.destination.create=async()=>({acknowledged:false});await assert.rejects(transferMountedFile(h.source,h.destination,original.path),/acknowledged/);assert.equal(h.removed,false);});
test('corrupt attachment retains source even if document bytes match',async()=>{const h=harness();h.destination.read=async()=>({...structuredClone(original),files:[original.files[0],{...original.files[1],bytes:new Uint8Array([1])}]});await assert.rejects(transferMountedFile(h.source,h.destination,original.path),/verification/);assert.equal(h.removed,false);});
test('destination collision, permission revocation and interrupted write retain source',async()=>{
 for(const reason of ['conflict','permission revoked','interrupted']){const h=harness();h.destination.create=async()=>{throw Error(reason);};await assert.rejects(transferMountedFile(h.source,h.destination,original.path),new RegExp(reason));assert.equal(h.removed,false);}
});
test('pending source edits refuse transfer before destination write',async()=>{const h=harness();h.source.read=async()=>({...structuredClone(original),pending:true});await assert.rejects(transferMountedFile(h.source,h.destination,original.path),/pending/);assert.deepEqual(h.events,[]);});
test('changed source at conditional removal fails closed after verified copy',async()=>{const h=harness();h.source.removeIfUnchanged=async()=>{throw Error('source changed');};await assert.rejects(transferMountedFile(h.source,h.destination,original.path),/source changed/);assert.equal(h.removed,false);});
test('duplicate attachment paths and missing main file fail before writing',async()=>{for(const files of [[original.files[0],original.files[0]],[original.files[1]]]){const h=harness();h.source.read=async()=>({...structuredClone(original),files});await assert.rejects(transferMountedFile(h.source,h.destination,original.path),/bundle/);assert.deepEqual(h.events,[]);}});
