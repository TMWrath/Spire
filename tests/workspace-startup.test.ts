import assert from 'node:assert/strict';
import test from 'node:test';
import {initializeWorkspace} from '../client/workspace-startup';

const deferred=()=>{
 let resolve!:()=>void;
 const promise=new Promise<void>(done=>{resolve=done;});
 return {promise,resolve};
};

test('cached Android Local workspace is revealed before optional mount restoration completes',async()=>{
 const restoration=deferred();
 const events:string[]=[];
 await initializeWorkspace({
  cachedLocal:true,
  initLocal:async()=>{events.push('local');},
  restoreConnections:async()=>{events.push('restore-start');await restoration.promise;events.push('restore-end');},
  refreshDevices:async()=>{events.push('devices');},
  reconcile:async()=>{events.push('reconcile');},
  refreshBootstrap:async()=>{events.push('bootstrap');},
  reveal:()=>{events.push('reveal');},
  failed:error=>{throw error;}
 });
 assert.deepEqual(events,['local','reveal','restore-start']);
 restoration.resolve();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(events,['local','reveal','restore-start','restore-end','devices','reconcile','bootstrap']);
});

test('hosted startup remains blocked until authoritative initialization completes',async()=>{
 const events:string[]=[];
 await initializeWorkspace({
  cachedLocal:false,
  initLocal:async()=>{events.push('local');},
  restoreConnections:async()=>{events.push('restore');},
  refreshDevices:async()=>{events.push('devices');},
  reconcile:async()=>{events.push('reconcile');},
  refreshBootstrap:async()=>{events.push('bootstrap');},
  reveal:()=>{events.push('reveal');},
  failed:error=>{throw error;}
 });
 assert.deepEqual(events,['local','restore','devices','reconcile','bootstrap','reveal']);
});

test('background failure after cached reveal is reported without hiding the workspace',async()=>{
 const failure=Error('server unavailable');
 const events:string[]=[];
 let reported:unknown;
 await initializeWorkspace({
  cachedLocal:true,
  initLocal:async()=>{events.push('local');},
  restoreConnections:async()=>{throw failure;},
  refreshDevices:async()=>{},
  reconcile:async()=>{},
  refreshBootstrap:async()=>{},
  reveal:()=>{events.push('reveal');},
  failed:error=>{reported=error;}
 });
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(events,['local','reveal']);
 assert.equal(reported,failure);
});
