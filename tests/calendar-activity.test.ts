import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Note,Revision} from '../shared/model.ts';
import {calendarActivity} from '../client/calendar-activity.ts';

const revision=(rev:number,time:string):Revision=>({rev,path:'Writing/Work.md',content:`v${rev}`,deleted:false,time});
const note=(overrides:Partial<Note>={}):Note=>({id:'work',path:'Writing/Work.md',content:'current',deleted:false,rev:3,time:'2026-10-22T16:00:00',history:[revision(1,'2026-10-20T09:00:00'),revision(2,'2026-10-21T10:00:00')],...overrides});

test('calendar records creation separately and each edited day once',()=>{
 const activity=calendarActivity([note({history:[revision(1,'2026-10-20T09:00:00'),revision(2,'2026-10-21T10:00:00'),revision(3,'2026-10-21T15:00:00')]})]);
 assert.deepEqual(activity.get('2026-10-20')?.created.map(file=>file.id),['work']);
 assert.deepEqual(activity.get('2026-10-20')?.edited,[]);
 assert.deepEqual(activity.get('2026-10-21')?.edited.map(file=>file.id),['work']);
 assert.deepEqual(activity.get('2026-10-22')?.edited.map(file=>file.id),['work']);
});

test('calendar ignores deleted files and does not call a first save an edit',()=>{
 const fresh=note({rev:1,time:'2026-10-20T09:00:00',history:[]});
 const activity=calendarActivity([fresh,note({id:'gone',deleted:true})]);
 assert.deepEqual(activity.get('2026-10-20')?.created.map(file=>file.id),['work']);
 assert.deepEqual(activity.get('2026-10-20')?.edited,[]);
 assert.equal([...activity.values()].some(entry=>entry.created.some(file=>file.id==='gone')||entry.edited.some(file=>file.id==='gone')),false);
});

test('calendar uses directory activity metadata when file history is intentionally unloaded',()=>{
 const unloaded=note({time:'2026-10-22T16:00:00',history:[],content:'',contentLoaded:false});
 Object.assign(unloaded,{createdTime:'2026-10-20T09:00:00',editTimes:['2026-10-21T10:00:00','2026-10-22T16:00:00']});
 const activity=calendarActivity([unloaded]);
 assert.deepEqual(activity.get('2026-10-20')?.created.map(file=>file.id),['work']);
 assert.deepEqual(activity.get('2026-10-21')?.edited.map(file=>file.id),['work']);
 assert.deepEqual(activity.get('2026-10-22')?.edited.map(file=>file.id),['work']);
 assert.equal(activity.get('2026-10-22')?.created.length,0);
});
