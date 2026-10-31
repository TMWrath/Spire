import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeMedia,waitNativeMedia} from '../client/native-media';
test('native queue persists all attachments before waiting, excluding guarded deletions',async()=>{
 let saved:any;const bridge={enqueue:async(input:any)=>{saved=input;return {tasks:{'Attachments/a.mp4':'a','Attachments/b.mp4':'b'}};},status:async()=>({state:'ready',hash:'a'.repeat(64)})};
 const ids=await prepareNativeMedia(bridge,[{path:'Attachments/a.mp4',size:5},{path:'Attachments/b.mp4',size:6},{path:'old.mp4',size:4,remove:true}],{origin:'https://server.example',workspace:'local',device:'d',account:'a'},async p=>'base-'+p);
 assert.equal(saved.attachments.length,2);assert.equal(saved.attachments[1].base,'base-Attachments/b.mp4');assert.equal(ids.get('Attachments/b.mp4'),'b');
});
test('native ready requires a real hash receipt',async()=>{await assert.rejects(waitNativeMedia({status:async()=>({state:'ready'})} as any,'a',()=>true,()=>{}),/receipt/);});
test('native failed state remains visible, not confirmed',async()=>{await assert.rejects(waitNativeMedia({status:async()=>({state:'failed',error:'Provider unavailable'})} as any,'a',()=>true,()=>{}),/Provider unavailable/);});
test('changing workspace stops UI waiting without misreporting success',async()=>{await assert.rejects(waitNativeMedia({status:async()=>({state:'ready',hash:'a'.repeat(64)})} as any,'a',()=>false,()=>{}),/Workspace changed/);});
