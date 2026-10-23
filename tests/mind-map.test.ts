import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,buildFileSlice,buildTimeline,buildTimelineRows,buildWorkspaceChronology,demoFiles} from '../client/mind-map-model.ts';
import type {Note} from '../shared/model.ts';
test('file slices contain only the current file and direct incoming/outgoing neighbors',()=>{const notes=[file('A','[[B]] [[Gone]] [[Missing]]'),file('B','[[D]]'),file('C','[[A]]'),file('D'),file('Gone','',true)];const g=buildFileSlice(notes,'A');assert.deepEqual(g.nodes.map(n=>n.id),['A','B','C']);assert.deepEqual(g.edges,[{source:'B',target:'A'},{source:'A',target:'C'}]);assert.deepEqual(buildFileSlice(notes,'D').nodes.map(n=>n.id),['B','D']);assert.deepEqual(buildFileSlice([file('Solo')],'Solo'),{nodes:[file('Solo')],edges:[]});assert.deepEqual(buildFileSlice(notes,'Gone'),{nodes:[],edges:[]});});
const file=(id:string,content='',deleted=false):Note=>({id,path:`Writing/${id}.md`,content,deleted,rev:1,time:'',history:[]});
test('reference pulses flow from referenced file to referencing file, deduplicated',()=>{const g=buildGraph([file('A','[[B]] [[B]]'),file('B')]);assert.deepEqual(g.edges,[{source:'B',target:'A'}]);});
test('mutual references remain directional; deleted, external, unresolved and code links excluded',()=>{const g=buildGraph([file('A','[[B]] [[Gone]] [[Missing]] `[[C]]` [web](https://example.com)'),file('B','[[A]]'),file('C'),file('Gone','',true)]);assert.equal(g.nodes.length,3);assert.deepEqual(g.edges,[{source:'B',target:'A'},{source:'A',target:'B'}]);});
test('relative and alias links resolve without folder nodes or attachments',()=>{const g=buildGraph([file('A','[b](B.md#hi) [[Alias]] ![image](a.png)'),file('B'),{...file('C'),content:'---\naliases: [Alias]\n---\n'}]);assert.equal(g.nodes.length,3);assert.equal(g.edges.length,2);});
test('large graph resolves aliases through one workspace index instead of rescanning every file per link',()=>{
 let bodyReads=0;
 const notes=Array.from({length:1_000},(_,index)=>{
  const value=file(String(index));
  const body=index<200?'[[Shared Alias]]':index===999?'---\naliases: [Shared Alias]\n---\n':'';
  Object.defineProperty(value,'content',{enumerable:true,get(){bodyReads++;return body;}});
  return value;
 });
 const graph=buildGraph(notes);
 assert.equal(graph.edges.length,200);
 assert.ok(bodyReads<=2_100,`graph read file bodies ${bodyReads} times; expected a bounded indexing pass`);
});
test('demo is deterministic presentation-only data with real relationships',()=>{assert.ok(demoFiles.length>=12);assert.ok(buildGraph(demoFiles).edges.length>=15);assert.ok(demoFiles.every(n=>n.path.startsWith('Demo/')&&n.rev===1&&!n.deleted));assert.equal(demoFiles.length,28);});

test('timeline anchors the current file between directly linked files by permanent creation order',()=>{
 const current={...file('Current','[[Past]] [[Future]]'),time:'2026-03-01T12:00:00.000Z',history:[{...file('Current').history,rev:1,path:'Writing/Current.md',content:'',deleted:false,time:'2026-02-01T12:00:00.000Z'}] as Note['history']};
 const past={...file('Past'),time:'2026-01-01T12:00:00.000Z'};
 const future={...file('Future','[[Current]]'),time:'2026-04-01T12:00:00.000Z'};
 const unrelated={...file('Unrelated'),time:'2025-01-01T12:00:00.000Z'};
 const timeline=buildTimeline([future,unrelated,current,past],current.id)!;
 assert.equal(timeline.current.id,'Current');
 assert.deepEqual(timeline.past.map(item=>item.note.id),['Past']);
 assert.deepEqual(timeline.future.map(item=>item.note.id),['Future']);
 assert.equal(timeline.current.created,'2026-02-01T12:00:00.000Z');
 assert.deepEqual(timeline.topics,[]);
});

test('timeline extracts stable tags and topic metadata without moving files when edited',()=>{
 const current={...file('Current','---\ntags: [writing, shared]\ntopics: [Spire, Focus]\n---\n[[Linked]]'),time:'2026-10-01T00:00:00.000Z',history:[{rev:1,path:'Writing/Current.md',content:'',deleted:false,time:'2026-01-01T00:00:00.000Z'}]};
 const linked={...file('Linked','---\ntags: [shared]\ntopic: Timeline\n---\n'),time:'2026-02-01T00:00:00.000Z'};
 const timeline=buildTimeline([current,linked],current.id)!;
 assert.deepEqual(timeline.topics,['Focus','shared','Spire','Timeline','writing']);
 assert.deepEqual(timeline.future.map(item=>item.note.id),['Linked']);
});

test('workspace chronology uses immutable creation time and deterministic order for functional date navigation',()=>{
 const edited={...file('Edited'),time:'2026-12-01T00:00:00.000Z',history:[{rev:1,path:'Writing/Edited.md',content:'',deleted:false,time:'2026-10-20T12:00:00.000Z'}]};
 const sameDay={...file('SameDay'),time:'2026-10-20T12:00:00.000Z'};
 const later={...file('Later'),time:'2026-10-25T12:00:00.000Z'};
 const deleted={...file('Deleted'),time:'2026-10-19T12:00:00.000Z',deleted:true};
 assert.deepEqual(buildWorkspaceChronology([later,deleted,sameDay,edited]).map(item=>[item.note.id,item.created]),[
  ['Edited','2026-10-20T12:00:00.000Z'],['SameDay','2026-10-20T12:00:00.000Z'],['Later','2026-10-25T12:00:00.000Z']
 ]);
});

test('timeline rows mirror older and newer relationships around the selected file and preserve four visual lanes',()=>{
 const older=[{note:file('Oldest'),created:'2025-01-01T00:00:00.000Z',direction:'outgoing' as const},{note:file('Recent'),created:'2025-10-01T00:00:00.000Z',direction:'incoming' as const}];
 const newer=[{note:file('Soon'),created:'2026-11-01T00:00:00.000Z',direction:'mutual' as const}];
 assert.deepEqual(buildTimelineRows(older,newer).map(row=>[row.before?.note.id??null,row.after?.note.id??null]),[['Recent','Soon'],['Oldest',null],[null,null],[null,null]]);
});
