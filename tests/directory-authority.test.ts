import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/store.ts';
for(const local of [true,false]) test(`directory authority ${local?'desktop':'server'}: edits, missing paths, read-only reopen and retained history`,()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-authority-'));
 try {
 const folder=local?path.join(root,'content'):path.join(root,'vault');fs.mkdirSync(path.join(folder,'Files'),{recursive:true});
 fs.writeFileSync(path.join(folder,'Files/a.md'),'first');
 const options=local?{contentDirectory:folder}:{};
 let store=new Store(root,options);
 if(!local){store.indexLocalDirectory();}
 const id=Object.values(store.state.notes).find(n=>n.path==='Files/a.md')!.id;
 const metadata=fs.readFileSync(path.join(root,'state.json'));
 fs.writeFileSync(path.join(folder,'Files/a.md'),'external');
 store=new Store(root,options);
 assert.equal(store.state.notes[id].content,'external');assert.ok(store.state.notes[id].history.some(n=>n.content==='first'));
 assert.deepEqual(fs.readFileSync(path.join(root,'state.json')),metadata);
 fs.unlinkSync(path.join(folder,'Files/a.md'));fs.rmdirSync(path.join(folder,'Files'));
 store=new Store(root,options);assert.equal(Object.hasOwn(store.state.notes,id),false);assert.ok(!store.state.folders?.includes('Files'));
 store.commit(structuredClone(store.state));
 assert.equal(fs.existsSync(path.join(folder,'Files')),false);
 const retained=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));assert.ok(retained.notes[id]);
 const preview=store.recoveryItems()[0];assert.equal(preview.canRestore,false);fs.mkdirSync(path.join(folder,'Files'));
 const fresh=store.recoveryItems()[0];assert.equal(fresh.canRestore,true);
 fs.writeFileSync(path.join(folder,'Files/a.md'),'new arrival');assert.throws(()=>store.reconcileDirectory(fresh.token,'restore'));assert.equal(fs.readFileSync(path.join(folder,'Files/a.md'),'utf8'),'new arrival');
 store.refreshDirectory();assert.equal(store.state.notes[id].content,'new arrival');assert.ok(store.state.notes[id].history.some(n=>n.content==='first'));
 store.commit(structuredClone(store.state));store=new Store(root,options);assert.ok(store.state.notes[id].history.some(n=>n.content==='first'));
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
