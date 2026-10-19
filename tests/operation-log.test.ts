import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traceOperation,operationEntries,clearOperations,operationRoute} from '../client/operation-log';
test('request evidence correlates start/end and excludes private URL data',async()=>{
 clearOperations();const route=operationRoute('/device-workspaces/private-id/snapshot?token=secret');
 await traceOperation('GET '+route,'Server',async()=>new Response('',{status:503}));
 const [end,start]=operationEntries();assert.equal(end.id,start.id);assert.equal(end.phase,'failed');assert.equal(end.status,503);assert.ok(end.durationMs!>=0);assert.ok(!JSON.stringify(operationEntries()).includes('private-id'));assert.ok(!JSON.stringify(operationEntries()).includes('secret'));
});
test('failure evidence never serializes exception messages or writing',async()=>{
 clearOperations();await assert.rejects(traceOperation('POST /mutate','Local',async()=>{throw new Error('private writing password=secret');}));
 assert.equal(operationEntries()[0].phase,'failed');assert.ok(!JSON.stringify(operationEntries()).includes('secret'));
});
