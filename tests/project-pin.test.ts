import {test} from 'node:test';
import assert from 'node:assert/strict';
import {persistOptimisticProjectPin} from '../client/project-pin';

test('pin state is applied before the server save completes',async()=>{
 const applied:string[]=[];
 let release!:()=>void;
 const save=new Promise<void>(resolve=>{release=resolve;});
 const pending=persistOptimisticProjectPin('old','new',value=>applied.push(value),()=>save);
 assert.deepEqual(applied,['new']);
 release();
 await pending;
 assert.deepEqual(applied,['new']);
});

test('pin state rolls back when the server save fails',async()=>{
 const applied:string[]=[];
 await assert.rejects(()=>persistOptimisticProjectPin('old','new',value=>applied.push(value),async()=>{throw Error('offline');}),/offline/);
 assert.deepEqual(applied,['new','old']);
});
