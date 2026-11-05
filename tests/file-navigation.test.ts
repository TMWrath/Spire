import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFileNavigation} from '../client/file-navigation';
import type {Note} from '../shared/model';

const note=(id:string,path:string,content:string,deleted=false):Note=>({id,rev:1,path,content,deleted,history:[],time:'2026-01-01T00:00:00.000Z'});

test('search avoids a folder-by-file cross product',()=>{
 let reads=0;
 const notes=Array.from({length:1000},(_,i)=>({...note(String(i),'','needle'),get path(){reads++;return `Folder${i}/Note.md`;}}));
 const projection=projectFileNavigation(notes,[],false,'needle');
 assert.equal(projection.filtered.length,1000);
 assert.ok(reads<50000,`excessive path reads: ${reads}`);
});
test('folder adjacency lists include only immediate children and preserve sorted order',()=>{
 const projection=projectFileNavigation([note('1','A/Deep/One.md',''),note('2','Z/Two.md','')],['Empty','A/Other'],false,'');
 assert.deepEqual(projection.foldersByParent?.get(''),['A','Empty','Z']);
 assert.deepEqual(projection.foldersByParent?.get('A'),['A/Deep','A/Other']);
 assert.deepEqual(projection.foldersByParent?.get('A/Deep'),undefined);
});
test('search keeps matching empty folders and their ancestors without unrelated siblings',()=>{
 const projection=projectFileNavigation([],['Top/Needle/Child','Top/Other','Other'],false,'needle');
 assert.deepEqual(projection.folders,['Top','Top/Needle','Top/Needle/Child']);
 assert.deepEqual(projection.foldersByParent?.get('Top'),['Top/Needle']);
});
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