import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trashFilePresentation} from '../client/trash-presentation.ts';

test('trash file presentation emphasizes the filename and humanizes generated recovery folders',()=>{
 const item=trashFilePresentation({path:'Recovered Folders-a5342d43-4904-40b7-8d25-4167c4d7900c/Attachments-d73d5f5f-77a6-44a5-b0da-682411e1c8a0/heroes/147d56db-2c06-4ff6-a2cd-b841f474fd07.jpg',kind:'attachment',size:153600,time:'2026-11-12T23:00:00.000Z'});
 assert.equal(item.name,'147d56db-2c06-4ff6-a2cd-b841f474fd07.jpg');
 assert.equal(item.location,'Recovered Folders / Attachments / heroes');
 assert.equal(item.type,'JPG image');
 assert.equal(item.size,'150 KB');
});

test('trash file presentation identifies styles and root files without inventing a folder',()=>{
 assert.deepEqual(trashFilePresentation({path:'theme.css',kind:'style',size:12,time:'2026-11-12T23:00:00.000Z'}),{
  name:'theme.css',location:'Workspace root',type:'CSS stylesheet',size:'12 B',deleted:'Nov 12, 2026'
 });
});
