import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFileNavigation} from '../client/file-navigation';
import type {Note} from '../shared/model';

const note=(id:string,path:string,content:string,deleted=false):Note=>({id,rev:1,path,content,deleted,history:[],time:'2026-01-01T00:00:00.000Z'});

test('empty-query navigation groups a large workspace in one file pass without reading bodies',()=>{
 let bodyReads=0;
 const notes=Array.from({length:10_000},(_,index)=>{
  const value=note(String(index),`Folder ${index%100}/File ${index}.md`,'');
  Object.defineProperty(value,'content',{enumerable:true,get(){bodyReads++;return 'large body';}});
  return value;
 });
 const projection=projectFileNavigation(notes,[],false,'');
 assert.equal(bodyReads,0,'ordinary navigation must not scan writing content');
 assert.equal(projection.filtered.length,10_000);
 assert.equal(projection.folders.length,100);
 assert.equal(projection.filesByFolder.get('Folder 7')?.length,100);
});

test('active search includes body matches and preserves explicit folder ancestors',()=>{
 const notes=[note('1','Research/Books/Match.md','needle'),note('2','Archive/Other.md','nothing'),note('3','Trash/Gone.md','needle',true)];
 const active=projectFileNavigation(notes,['Research/Books/Ideas','Empty/Child'],false,'needle');
 assert.deepEqual(active.filtered.map(item=>item.id),['1']);
 assert.deepEqual(active.folders,['Research','Research/Books']);
 assert.deepEqual(active.filesByFolder.get('Research/Books')?.map(item=>item.id),['1']);
 const trash=projectFileNavigation(notes,[],true,'');
 assert.deepEqual(trash.filtered.map(item=>item.id),['3']);
});
