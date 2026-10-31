import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {Store} from '../server/store';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test('binary CAS persists download/replacement/delete and refuses stale bytes',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-binary-cas-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let store=new Store(root);const p='Attachments/photo.jpg';
 store.syncAttachment(p,'missing',Buffer.from('one'));store=new Store(root);assert.equal(Buffer.from(store.state.attachments[0].data,'base64').toString(),'one');
 store.syncAttachment(p,hash('one'),Buffer.from('two'));store.syncAttachment(p,hash('one'),Buffer.from('two'));
 assert.throws(()=>store.syncAttachment(p,hash('one'),Buffer.from('bad')),/changed/);
 assert.throws(()=>store.syncAttachment(p,hash('one'),null),/changed/);
 store.syncAttachment(p,hash('two'),null);store=new Store(root);assert.equal(store.state.attachments.length,0);assert.equal(fs.existsSync(store.vault(p)),false);
});
