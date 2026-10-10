import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store.ts';
import {createBackup,restoreBackup} from '../server/backup.ts';
const input={label:'Journal',folder:'Writing/Journal',namePattern:'Entry',templateId:null};
test('quick actions persist, unique activation is atomic and replay-safe, backups round trip',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-actions-'));try{
 const store=new Store(root);const a=store.saveQuickAction(input);const op=randomUUID();const first=store.activateQuickAction(a.id,op,'test');assert.equal(first.path,'Writing/Journal/Entry.md');assert.equal(store.activateQuickAction(a.id,op,'test').id,first.id);assert.equal(store.activateQuickAction(a.id,randomUUID(),'test').path,'Writing/Journal/Entry-2.md');
 const reopened=new Store(root);assert.equal(reopened.state.quickActions?.length,1);assert.throws(()=>reopened.saveQuickAction(input,a.id,0));const edited=reopened.saveQuickAction({...input,label:'Daily'},a.id,a.revision);assert.equal(edited.revision,2);
 const backup=path.join(root,'backup.json');createBackup(root,backup);const restored=path.join(root,'restored');restoreBackup(backup,restored);assert.deepEqual(new Store(restored).state.quickActions,reopened.state.quickActions);
 reopened.deleteQuickAction(a.id,edited.revision);assert.equal(reopened.state.quickActions?.length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('template activation records provenance and refuses missing template without creating files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-actions-'));try{const store=new Store(root);const template=store.saveTemplate({title:'Test',category:'full',content:'# Hello',sourcePath:'Templates/Test.md'});const a=store.saveQuickAction({...input,templateId:'saved-'+template.id});const n=store.activateQuickAction(a.id,randomUUID(),'test');assert.equal(n.content,'# Hello');assert.deepEqual(n.templateIds,['saved-'+template.id]);assert.throws(()=>store.saveQuickAction({...input,templateId:'missing'}));assert.throws(()=>store.saveQuickAction({...input,folder:'../escape'}));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
