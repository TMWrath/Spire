import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationIsAdditive} from '../client/publication-bootstrap.ts';
import type {Snapshot} from '../client/sync.ts';
import type {Note} from '../shared/model.ts';

const note=(id:string,path:string,content:string):Note=>({id,path,content,rev:1,deleted:false,time:'2026-01-01T00:00:00.000Z',history:[]});
const snapshot=(notes:Note[]):Snapshot=>({seq:notes.length,notes,folders:['Writing'],styles:{},conflicts:[],attachments:[],sources:[],templates:[],quickActions:[]});

test('missing publication baseline may recover when Local only adds a file',()=>{
 const old=snapshot([note('a','Writing/Old.md','old')]);
 const local=snapshot([...old.notes,note('b','Writing/New.md','new')]);
 assert.equal(publicationIsAdditive(old,local),true);
});

test('missing publication baseline refuses edits and deletions of published files',()=>{
 const old=snapshot([note('a','Writing/Old.md','old')]);
 assert.equal(publicationIsAdditive(old,snapshot([note('a','Writing/Old.md','edited')])),false);
 assert.equal(publicationIsAdditive(old,snapshot([])),false);
});

test('missing publication baseline refuses structural replacement',()=>{
 const old=snapshot([note('a','Writing/Old.md','old')]);
 const local={...structuredClone(old),styles:{'Writing/Old.css':'changed'}};
 const server={...structuredClone(old),styles:{'Writing/Old.css':'original'}};
 assert.equal(publicationIsAdditive(server,local),false);
});
