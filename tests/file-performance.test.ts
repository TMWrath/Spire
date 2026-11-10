import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../client/sync';

const note={id:'b4ab37ee-62af-4bea-b051-55ae941861f2',path:'Notes/performance.md',rev:3,content:'# Performance\n',deleted:false,history:[],contentLoaded:true} as any;

test('repeated opens reuse loaded content and refresh preserves bodies only at the same revision',async()=>{
 const engine=new Engine();engine.cache.identity={owner:'owner',username:'owner',csrf:'test'};
 engine.cache.snapshot.notes=[{...note,content:'',contentLoaded:false}];
 let reads=0;
 engine.request=async(url:string)=>{if(url.includes('/content')){reads++;return {...note};}if(url==='/snapshot')return {...engine.cache.snapshot,notes:[{...note,content:'',contentLoaded:false}]};throw Error(url);};
 for(let i=0;i<20;i++)assert.equal((await engine.openFile(note)).content,note.content);
 assert.equal(reads,1);
 await engine.sync();assert.equal((await engine.openFile(note)).content,note.content);assert.equal(reads,1);
 engine.request=async()=>({...engine.cache.snapshot,notes:[{...note,rev:4,content:'',contentLoaded:false}]});
 await engine.sync();assert.equal(engine.cache.snapshot.notes[0].contentLoaded,false);
});

test('save waits for server acknowledgement and keeps confirmed revision without snapshot roundtrip',async()=>{
 const engine=new Engine();engine.cache.identity={owner:'owner',username:'owner',csrf:'test'};engine.cache.snapshot.notes=[note];
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);const requests:string[]=[];
 engine.request=async(url:string)=>{requests.push(url);await gate;return {...note,rev:4,content:'# Updated'};};
 const flight=engine.save({...note,content:'# Updated'});assert.equal(engine.status,'Saving…');assert.equal(engine.cache.snapshot.notes[0].rev,3);release();await flight;
 assert.equal(engine.status,'Saved on server');assert.equal(engine.cache.snapshot.notes[0].rev,4);assert.deepEqual(requests,['/mutate']);
});
