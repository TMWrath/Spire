import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/store';
import {createBackup,restoreBackup} from '../server/backup';
test('template usage survives restart, edits from old clients, folder moves, history and backup without changing Markdown',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'spire-usage-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));const root=path.join(temp,'data');let s=new Store(root);s.createFolder('Writing');
 const id=randomUUID(),content='---\ntitle: Exact 🌞\n---\nwriting  \n';
 s.mutate({op:randomUUID(),id,base:0,path:'Writing/A.md',content,templateIds:['journal','journal']},'d');assert.deepEqual(s.state.notes[id].templateIds,['journal']);assert.equal(fs.readFileSync(s.vault('Writing/A.md'),'utf8'),content);
 s=new Store(root);assert.deepEqual(s.state.notes[id].templateIds,['journal']);s.mutate({op:randomUUID(),id,base:1,path:'Writing/A.md',content:content+'more'},'older-client');assert.deepEqual(s.state.notes[id].templateIds,['journal']);assert.deepEqual(s.state.notes[id].history[0].templateIds,['journal']);
 s.deleteFolder('Writing',{mode:'reassign',destination:'Archive'},'d');assert.deepEqual(s.state.notes[id].templateIds,['journal']);assert.equal(s.state.notes[id].path,'Archive/A.md');
 const backup=path.join(temp,'backup.json');createBackup(root,backup);const restored=path.join(temp,'restored');restoreBackup(backup,restored);assert.deepEqual(new Store(restored).state.notes[id].templateIds,['journal']);assert.deepEqual(new Store(restored).state.notes[id].history[0].templateIds,['journal']);
});
