import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {Store} from '../server/store.ts';import {createBackup,restoreBackup,verifyBackup} from '../server/backup.ts';
test('local full backup restores content styles and history to a new folder, never over an existing folder',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-backup-local-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const folder=path.join(root,'original');fs.mkdirSync(path.join(folder,'Writing'),{recursive:true});fs.writeFileSync(path.join(folder,'Writing/file.md'),'original');const meta=path.join(folder,'.spire-desktop');const store=new Store(meta,{contentDirectory:folder});store.putStyle('Writing/file.css','p{color:red}');const note=Object.values(store.state.notes)[0];store.mutate({id:note.id,op:randomUUID(),base:note.rev,path:note.path,content:'edited',deleted:false},'test');
 const backup=path.join(root,'backup.json');createBackup(meta,backup,{contentDirectory:folder});
 assert.equal(verifyBackup(backup).state.styles?.['Writing/file.css'],'p{color:red}');
 const target=path.join(root,'restored');restoreBackup(backup,path.join(target,'.spire-desktop'),{contentDirectory:target});
 assert.equal(fs.readFileSync(path.join(target,'Writing/file.md'),'utf8'),'edited');assert.equal(fs.readFileSync(path.join(target,'Writing/file.css'),'utf8'),'p{color:red}');
 const restored=new Store(path.join(target,'.spire-desktop'),{contentDirectory:target});assert.equal(restored.state.notes[note.id].history[0].content,'original');
 assert.throws(()=>restoreBackup(backup,meta,{contentDirectory:folder}),/empty/);
 const tampered=JSON.parse(fs.readFileSync(backup,'utf8'));tampered.payload+=' ';fs.writeFileSync(backup,JSON.stringify(tampered));assert.throws(()=>verifyBackup(backup),/Checksum/);
});
