import test from 'node:test';
import assert from 'node:assert/strict';
import {planPublication} from '../client/publication-isolation';
import type {Snapshot} from '../client/sync';
const note=(id:string,content:string,rev=1)=>({id,path:id+'.md',content,rev,deleted:false,history:[],templateIds:[]});
const snap=(...notes:any[]):Snapshot=>({seq:1,notes,folders:[],styles:{},attachments:[],conflicts:[]});
test('server-only workspace changes are pending pulls, not conflicts or premature acknowledgements',()=>{
 const base={...snap(),folders:['old'],quickActions:[]};
 const server={...structuredClone(base),folders:['new']};
 const p=planPublication(structuredClone(base),base,server);
 assert.deepEqual(p.workspacePulls,{folders:['new']});
 assert.deepEqual(p.conflicts,[]);
 assert.deepEqual(p.baseline.folders,['old']);
 assert.equal(p.upload,false);
});
test('divergent workspace changes retain both versions without a pull',()=>{
 const base=snap();
 const p=planPublication({...base,folders:['phone']},base,{...base,folders:['server']});
 assert.deepEqual(p.workspacePulls,{});
 assert.deepEqual(p.conflicts,['workspace:folders']);
});
test('Local-only A publishes while B retains both conflicting copies and old base',()=>{
 const base=snap(note('A','old'),note('B','old'));
 const local=snap(note('A','hello\n\nhow are you\n',4),note('B','phone',3));
 const server=snap(note('A','old'),note('B','server',2));
 const p=planPublication(local,base,server);
 assert.equal(p.outgoing.notes.find(n=>n.id==='A')?.content,'hello\n\nhow are you\n');
 assert.equal(p.outgoing.notes.find(n=>n.id==='B')?.content,'server');
 assert.equal(p.baseline.notes.find(n=>n.id==='B')?.content,'old');
 assert.deepEqual(p.conflicts,['B']);assert.equal(p.upload,true);
 assert.equal(local.notes[1].content,'phone');assert.equal(server.notes[0].content,'old');
});
test('independent edits move in both directions; pull is acknowledged only after provider save',()=>{
 const p=planPublication(snap(note('A','phone'),note('B','old')),snap(note('A','old'),note('B','old')),snap(note('A','old'),note('B','server',2)));
 assert.deepEqual(p.pulls.map(n=>n.id),['B']);assert.equal(p.outgoing.notes[0].content,'phone');assert.equal(p.baseline.notes[1].content,'old');assert.deepEqual(p.conflicts,[]);
});
test('lost upload reply is acknowledged without reupload or touching conflict base',()=>{
 const base=snap(note('A','old'),note('B','old')),local=snap(note('A','phone',4),note('B','phone')),server=snap(note('A','phone',4),note('B','server'));
 const p=planPublication(local,base,server);assert.equal(p.upload,false);assert.equal(p.baseline.notes[0].content,'phone');assert.equal(p.baseline.notes[1].content,'old');
});
test('sequence, revision and hydration metadata do not manufacture authored conflicts',()=>{
 const b=snap(note('A','exact\n\n'));const l=structuredClone(b);l.seq=99;l.notes[0].rev=6;l.notes[0].contentLoaded=true;
 const p=planPublication(l,b,structuredClone(b));assert.equal(p.upload,false);assert.deepEqual(p.conflicts,[]);
});
test('unloaded and missing files never become empty uploads or implicit deletes',()=>{
 const b=snap(note('A','keep'),note('B','keep'));const l=snap({...note('A',''),contentLoaded:false});const p=planPublication(l,b,b);
 assert.equal(p.upload,false);assert.equal(p.outgoing.notes.length,2);assert.equal(p.outgoing.notes[0].content,'keep');assert.deepEqual(p.conflicts,['A','B']);
});
test('case colliding additions are retained locally, not published over another file',()=>{
 const p=planPublication(snap(note('A','local')),snap(),snap({...note('B','server'),path:'a.md'}));assert.equal(p.upload,false);assert.equal(p.outgoing.notes.length,1);assert.ok(p.conflicts.includes('A'));
});
test('remote tombstone is a pull; same-file delete/edit conflict retains both',()=>{
 const b=snap(note('A','old'));const deleted=snap({...note('A','old',2),deleted:true});assert.equal(planPublication(b,b,deleted).pulls[0].deleted,true);
 assert.deepEqual(planPublication(snap(note('A','edited')),b,deleted).conflicts,['A']);
});
test('structural conflicts do not block unrelated file uploads or discard either structure',()=>{
 const b=snap(note('A','old'));const l={...snap(note('A','phone')),folders:['local']};const s={...b,folders:['server']};const p=planPublication(l,b,s);assert.equal(p.upload,true);assert.deepEqual(p.outgoing.folders,['server']);assert.deepEqual(p.baseline.folders,[]);assert.ok(p.conflicts.includes('workspace:folders'));
});

test('divergent numbered histories remain separately identified and are not overwritten by later uploads',()=>{
 const b=note('A','merged',3),left={rev:2,path:'A.md',content:'left',deleted:false,time:'2026-01-01'},right={...left,content:'right'};
 const remote={...b,history:[right],mergeParents:[{hash:'retained',revision:left}]};const local={...b,content:'next',rev:4,history:[left]};
 const result=planPublication(snap(local),snap(b),snap(remote));assert.equal(result.upload,true);assert.deepEqual(result.conflicts,[]);
 const n=result.outgoing.notes[0];assert.ok(n.mergeParents?.some(v=>v.revision.content==='left'));assert.ok(n.mergeParents?.some(v=>v.revision.content==='right'));assert.ok(n.history.some(r=>r.content==='right'));
});
