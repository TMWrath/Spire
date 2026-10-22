import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hydratePublicationNotes} from '../client/publication-hydration';
const note={id:'one',path:'Folder/A.md',rev:1,content:'baseline',deleted:false,history:[],contentLoaded:true};
test('changed deferred Local file loads only its body; unrelated files reuse the acknowledged baseline',async()=>{
 const calls:string[]=[];
 const result=await hydratePublicationNotes([{...note,rev:2,content:'',contentLoaded:false},{...note,id:'two',content:'',contentLoaded:false}],[note,{...note,id:'two'}],async id=>{calls.push(id);return {...note,rev:2,content:'saved'};});
 assert.deepEqual(calls,['one']);assert.equal(result[0].content,'saved');assert.equal(result[1].content,'baseline');
});
test('changed provider metadata aborts publication rather than acknowledging stale bytes',async()=>{
 await assert.rejects(hydratePublicationNotes([{...note,content:'',contentLoaded:false}],[],async()=>({...note,rev:2})),/changed/);
});
test('failed body read never becomes a blank upload',async()=>{
 await assert.rejects(hydratePublicationNotes([{...note,content:'',contentLoaded:false}],[],async()=>{throw Error('provider offline');}),/provider offline/);
});
