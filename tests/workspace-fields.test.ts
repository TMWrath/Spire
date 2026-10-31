import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkspaceFields} from '../shared/workspace-fields';
import {emptyState} from '../shared/model';
import {Store} from '../server/store';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('workspace field changes persist and reject stale input without partial writes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-fields-'));
 try{const store=new Store(root);store.updateWorkspaceFields({expected:{folders:[]},changes:{folders:['Writing']}});assert.deepEqual(new Store(root).state.folders,['Writing']);
 assert.throws(()=>store.updateWorkspaceFields({expected:{folders:[]},changes:{folders:['Other']}}));
 assert.deepEqual(new Store(root).state.folders,['Writing']);
 store.updateWorkspaceFields({expected:{folders:['Writing']},changes:{folders:[]}});
 assert.equal(fs.existsSync(store.vault('Writing')),false);
 assert.deepEqual(new Store(root).state.folders,[]);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('portable workspace fields apply atomically and preserve device-local state',()=>{
 const state=emptyState();
 const next=applyWorkspaceFields(state,{expected:{folders:[],quickActions:[]},changes:{folders:['Writing'],quickActions:[{id:'12345678-1234-4234-8234-123456789abc',revision:1,label:'Daily',folder:'Writing',namePattern:'Daily',templateId:null}]}});
 assert.deepEqual(next.folders,['Writing']);assert.equal(next.quickActions?.[0].label,'Daily');
 assert.deepEqual(next.notes,state.notes);assert.deepEqual(state.folders,[]);
});
test('stale fields and credentials cannot be applied',()=>{
 const state={...emptyState(),folders:['Local']};
 assert.throws(()=>applyWorkspaceFields(state,{expected:{folders:[]},changes:{folders:['Remote']}}),/changed/i);
 assert.throws(()=>applyWorkspaceFields(state,{expected:{},changes:{identity:{token:'not-a-real-token'}}}));
 assert.throws(()=>applyWorkspaceFields(state,{expected:{folders:['Local']},changes:{folders:['../outside']}}));
 assert.deepEqual(state.folders,['Local']);
});
test('missing expected fields are not wildcard writes and replay is harmless',()=>{
 const state=emptyState();
 assert.throws(()=>applyWorkspaceFields(state,{expected:{},changes:{folders:['Writing']}}));
 const patch={expected:{folders:[]},changes:{folders:['Writing']}};
 const next=applyWorkspaceFields(state,patch);
 assert.deepEqual(applyWorkspaceFields(next,patch),next);
});
