import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/store.ts';
function fixture(t:any){const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-shadow-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const s=new Store(root).state;s.folders=['test2'];fs.writeFileSync(path.join(root,'state.json'),JSON.stringify(s));fs.mkdirSync(path.join(root,'vault/test2'));fs.writeFileSync(path.join(root,'vault/test2/note.md'),'Keep my writing\n\n');fs.mkdirSync(path.join(root,'vault/Test2'));return root;}
test('hosted scanner preserves an empty untracked case shadow without indexing or mutating it',t=>{const root=fixture(t);const before=fs.readFileSync(path.join(root,'state.json'));const s=new Store(root);assert.deepEqual(s.state.folders,['test2']);assert.equal(Object.values(s.state.notes)[0].content,'Keep my writing\n\n');s.refreshDirectory();assert.deepEqual(fs.readdirSync(path.join(root,'vault/Test2')),[]);assert.equal(fs.readFileSync(path.join(root,'vault/test2/note.md'),'utf8'),'Keep my writing\n\n');assert.deepEqual(fs.readFileSync(path.join(root,'state.json')),before);});
test('nonempty case shadows remain rejected with all bytes intact',t=>{const root=fixture(t);fs.writeFileSync(path.join(root,'vault/Test2/external.md'),'external');assert.throws(()=>new Store(root),/Case-colliding/);assert.equal(fs.readFileSync(path.join(root,'vault/Test2/external.md'),'utf8'),'external');});
test('untracked ambiguous directory pairs remain rejected',t=>{const root=fixture(t);const s=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));s.folders=[];fs.writeFileSync(path.join(root,'state.json'),JSON.stringify(s));assert.throws(()=>new Store(root),/Case-colliding/);});
test('explicit local directories retain strict collision rejection',t=>{const root=fixture(t);assert.throws(()=>new Store(root,{contentDirectory:path.join(root,'vault')}),/Case-colliding/);});
