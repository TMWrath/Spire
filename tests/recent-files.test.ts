import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberRecent,recentFiles} from '../client/recent-files';
import {applyWorkspaceFields} from '../shared/workspace-fields';
import {emptyState} from '../shared/model';
import type {Note} from '../shared/model';

test('recent files are server-workspace state, deduplicated, rename-safe and exclude trash',()=>{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 assert.deepEqual(rememberRecent([],first),[first]);
 assert.deepEqual(rememberRecent([first,second],second),[second,first]);
 const state=applyWorkspaceFields(emptyState(),{expected:{recentFiles:[]},changes:{recentFiles:[second,first]}});
 assert.deepEqual(state.recentFiles,[second,first]);
 const n=(id:string,path:string,deleted=false):Note=>({id,path,deleted,content:'',rev:1,time:new Date(0).toISOString(),history:[]});
 assert.deepEqual(recentFiles(state.recentFiles!,[n(first,'Renamed.md'),n(second,'Trash.md',true)]).map(note=>note.path),['Renamed.md']);
});

test('recent history is bounded to thirty server entries',()=>{
 const ids=Array.from({length:35},(_,index)=>`${String(index).padStart(8,'0')}-0000-4000-8000-000000000000`);
 assert.deepEqual(rememberRecent(ids,ids[34]),[ids[34],...ids.slice(0,29)]);
});
