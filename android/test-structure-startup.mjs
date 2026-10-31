import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRuntime} from './local/runtime.mjs';
const b64=s=>Buffer.from(s).toString('base64');
const ref=id=>({kind:'saf',id,size:20,modified:1});
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function fixture(){
 const notes=Object.fromEntries([[a,'A.md'],[b,'B.md']].map(([id,path])=>[id,{id,path,rev:2,deleted:false,time:'2026-01-01T00:00:00Z',bucketPath:'.spire-android/notes-00-2.json'}]));
 const state={version:1,seq:2,notes,folders:[],styles:{},conflicts:[],events:[],operations:{},attachments:[]};
 const records=Object.fromEntries(Object.values(notes).map(n=>[n.id,{...n,content:n.path+' body',history:[{rev:1,path:n.path,content:'old '+n.path,deleted:false,time:n.time}]}]));
 let disk={dirs:['.spire-android'],files:{'A.md':ref('a'),'B.md':ref('b'),'.spire-android/state.json':b64(JSON.stringify(state)),'.spire-android/notes-00-2.json':ref('bucket')}};
 const reads=[];let commits=0;
 const storage={manual:true,structureOnly:true,load:async()=>structuredClone(disk),readText:async path=>{reads.push(path);if(path.endsWith('notes-00-2.json'))return b64(JSON.stringify({version:1,notes:records}));if(path==='A.md'||path==='B.md')return b64(path+' body');const raw=disk.files[path];if(typeof raw==='string')return raw;throw Error('unexpected read '+path);},commit:async(before,after)=>{assert.deepEqual(before.dirs,disk.dirs);assert.equal(before.files['.spire-android/state.json'],disk.files['.spire-android/state.json']);if(typeof before.files['A.md']==='string')assert.equal(before.files['A.md'],b64('A.md body'));disk=structuredClone(after);commits++;}};
 return {storage,reads,get disk(){return disk;},get commits(){return commits;}};
}
test('directory expansion lists one folder only, defers bodies and retries failures',async()=>{
 const f=fixture(),lists=[];let fail=true;
 f.storage.list=async path=>{lists.push(path);if(fail){fail=false;throw Error('provider unavailable');}return {dirs:['Books/Subfolder'],files:{'Books/Chapter.md':ref('chapter'),'Books/movie.mp4':ref('movie')}};};
 const load=f.storage.load;f.storage.load=async()=>{const tree=await load();tree.dirs.push('Books');return tree;};
 const runtime=await createLocalRuntime(f.storage,'lazy-folders');
 assert.deepEqual(lists,[]);assert.deepEqual(f.reads,[]);
 assert.equal((await post(runtime,'/local/list',{path:'Books'})).status,503);
 const response=await post(runtime,'/local/list',{path:'Books'});assert.equal(response.status,200);
 const snapshot=await response.json();assert.ok(snapshot.notes.some(n=>n.path==='Books/Chapter.md'&&n.contentLoaded===false));
 assert.ok(snapshot.folders.includes('Books/Subfolder'));assert.ok(snapshot.attachments.some(a=>a.path==='Books/movie.mp4'));
 await post(runtime,'/local/list',{path:'Books'});assert.deepEqual(lists,['Books','Books']);assert.deepEqual(f.reads,[]);assert.equal(f.commits,0);
});
const post=(runtime,path,body)=>runtime.fetch('/api'+path,{method:'POST',body:JSON.stringify(body)});
test('structure startup and polling never read bodies or history, click reads just that file',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'test-structure');await runtime.reconciled;
 const snapshot=await(await runtime.fetch('/api/snapshot')).json();assert.equal(snapshot.notes.length,2);assert.equal(snapshot.notes[0].contentLoaded,false);assert.deepEqual(f.reads,[]);assert.equal(f.commits,0);
 await runtime.fetch('/api/events?after=0');assert.deepEqual(f.reads,[]);
 const opened=await post(runtime,'/local/open',{id:a});assert.equal(opened.status,200,await opened.clone().text());const note=await opened.json();assert.equal(note.content,'A.md body');assert.deepEqual(note.history,[]);assert.deepEqual(f.reads,['A.md']);assert.equal(f.commits,0);
});
test('saving one file preserves untouched legacy pointers and survives a structure-only reopen',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'test-save');const opened=await(await post(runtime,'/local/open',{id:a})).json();
 const saved=await post(runtime,'/mutate?localDelta=1',{op:crypto.randomUUID(),id:a,base:opened.rev,path:'A.md',content:'new A',deleted:false});assert.equal(saved.status,200,await saved.clone().text());
 const state=JSON.parse(Buffer.from(f.disk.files['.spire-android/state.json'],'base64'));assert.equal(state.notes[b].bucketPath,'.spire-android/notes-00-2.json');assert.ok(state.notes[a].contentPath);assert.ok(state.notes[a].historyPath);assert.equal(state.notes[a].content,undefined);assert.ok(!f.reads.includes('B.md'));
 const reads=f.reads.length,reopened=await createLocalRuntime(f.storage,'test-save');await reopened.fetch('/api/snapshot');assert.equal(f.reads.length,reads);
 // The provider fixture returns the acknowledged writing bytes after a save.
 f.storage.readText=async p=>{f.reads.push(p);const raw=f.disk.files[p];if(typeof raw==='string')return raw;throw Error('unexpected '+p);};
 const note=await(await post(reopened,'/local/open',{id:a})).json();assert.equal(note.content,'new A');assert.deepEqual(note.history,[]);
 const history=await(await reopened.fetch('/api/workspace/files/'+a+'/history')).json();assert.ok(history.some(r=>r.content==='A.md body'));assert.ok(history.some(r=>r.content==='old A.md'));
});
test('unrelated folder operation does not mark an opened legacy history as loaded',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'history-preservation');
 await post(runtime,'/local/open',{id:a});
 const folder=await post(runtime,'/folders',{path:'New'});assert.equal(folder.status,201,await folder.clone().text());
 const history=await(await runtime.fetch('/api/workspace/files/'+a+'/history')).json();assert.ok(history.some(r=>r.content==='old A.md'));
});
test('explicit publication materializes real bodies without revision reads or writes',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'publication');
 assert.deepEqual(f.reads,[]);
 const response=await post(runtime,'/local/publication',{});assert.equal(response.status,200);
 const snapshot=await response.json();assert.deepEqual(snapshot.notes.map(n=>n.content),['A.md body','B.md body']);
 assert.deepEqual(f.reads,['A.md','B.md']);assert.equal(f.commits,0);
});
test('selected stylesheet is loaded only on open',async()=>{
 const f=fixture(),load=f.storage.load,read=f.storage.readText;const css=b64('p { color: red; }');
 f.storage.load=async()=>{const tree=await load();tree.files['A.css']=css;return tree;};
 f.storage.readText=async p=>p==='A.css'?(f.reads.push(p),css):read(p);
 const runtime=await createLocalRuntime(f.storage,'css');await runtime.fetch('/api/snapshot');assert.deepEqual(f.reads,[]);
 const opened=await(await post(runtime,'/local/open',{id:a})).json();assert.equal(opened.styles['A.css'],'p { color: red; }');assert.deepEqual(f.reads,['A.md','A.css']);
});
test('creating a folder does not materialize any documents or legacy revision buckets',async()=>{
 const f=fixture(),runtime=await createLocalRuntime(f.storage,'test-folder');const response=await post(runtime,'/folders',{path:'New'});assert.equal(response.status,201,await response.clone().text());assert.deepEqual(f.reads,[]);assert.ok(f.disk.dirs.includes('New'));assert.equal(f.disk.files['B.md'].kind,'saf');
});
