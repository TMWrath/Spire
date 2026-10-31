import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLocalDelta,localFileAction,type LocalDelta} from '../client/local-file-actions';
import type {Note} from '../shared/model';
const note=(id:string,path:string):Note=>({id,path,content:'writing',rev:1,time:'now',history:[],deleted:false});
test('Local deltas replace affected entries and preserve unrelated writing',()=>{
 const a=note('a','A/a.md'),b=note('b','B/b.md');
 const snapshot={seq:3,notes:[a,b],folders:['A','B'],styles:{'A/a.css':'old'},conflicts:[],attachments:[]};
 const delta:LocalDelta={base:3,seq:4,notes:[{...a,path:'New/a.md',rev:2}],removed:[],foldersAdded:['New'],foldersRemoved:['A'],styles:{'New/a.css':'old'},stylesRemoved:['A/a.css'],conflicts:[],attachments:[]};
 const next=applyLocalDelta(snapshot,delta)!;assert.equal(next.notes[1],b);assert.equal(next.notes[0].path,'New/a.md');assert.deepEqual(next.folders,['B','New']);assert.deepEqual(next.styles,{'New/a.css':'old'});assert.equal(snapshot.notes[0],a);
 assert.equal(applyLocalDelta(snapshot,{...delta,base:2}),null,'stale deltas require a snapshot, not a silent merge');
});
test('only content writes use Saving file status',()=>{
 const n=note('a','A/a.md');
 assert.equal(localFileAction({...n,rev:0}).pending,'Creating file…');
 assert.equal(localFileAction({...n,deleted:true},n).pending,'Deleting file…');
 assert.equal(localFileAction({...n,path:'B/a.md'},n).pending,'Moving file…');
 assert.equal(localFileAction({...n,content:'changed'},n).pending,'Saving file…');
});
