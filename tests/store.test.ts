import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { Store } from '../server/store.ts';
import { mutationSchema, safePath, metadata, isStarred, setStarred } from '../shared/model.ts';
const root = '.test-data/unit';
function fresh() { fs.rmSync(root,{recursive:true,force:true}); return new Store(root); }
const create = (path = 'Folder/First.md', content = '# First') => ({op:randomUUID(),id:randomUUID(),base:0,path,content,deleted:false});
test('empty folders persist independently of notes and reject file collisions',()=>{let s=fresh();s.createFolder('Writing/Ideas');assert.equal(fs.statSync(`${root}/vault/Writing/Ideas`).isDirectory(),true);assert.deepEqual(new Store(root).state.folders,['Writing/Ideas']);assert.throws(()=>s.createFolder('Writing/Ideas'),/exists/);s.mutate(create('Writing/Ideas/First.md'),'d');assert.throws(()=>s.createFolder('Writing/Ideas/First.md'),/file occupies/);s=new Store(root);assert.equal(s.state.folders?.length,1);});
test('folder deletion can move contained notes to trash and remove the folder tree',()=>{
 const s=fresh();s.createFolder('Writing');s.createFolder('Writing/Ideas');
 const first=create('Writing/First.md');const nested=create('Writing/Ideas/Second.md');s.mutate(first,'d');s.mutate(nested,'d');
 const result=s.deleteFolder('Writing',{mode:'trash'},'d');
 assert.deepEqual(result,{moved:2,destination:null});assert.deepEqual(s.state.folders,[]);
 assert.equal(s.state.notes[first.id].deleted,true);assert.equal(s.state.notes[nested.id].deleted,true);
 assert.equal(fs.existsSync(`${root}/vault/Writing`),false);
});
test('folder deletion can reassign notes while preserving relative subfolders and can create Unsorted',()=>{
 const s=fresh();s.createFolder('Writing');s.createFolder('Writing/Ideas');s.createFolder('Archive');
 const first=create('Writing/First.md');const nested=create('Writing/Ideas/Second.md');s.mutate(first,'d');s.mutate(nested,'d');
 assert.deepEqual(s.deleteFolder('Writing',{mode:'reassign',destination:'Archive'},'d'),{moved:2,destination:'Archive'});
 assert.equal(s.state.notes[first.id].path,'Archive/First.md');assert.equal(s.state.notes[nested.id].path,'Archive/Ideas/Second.md');
 assert.ok(s.state.folders?.includes('Archive/Ideas'));assert.ok(!s.state.folders?.some(f=>f==='Writing'||f.startsWith('Writing/')));
 const loose=create('Temporary/Loose.md');s.createFolder('Temporary');s.mutate(loose,'d');
 assert.deepEqual(s.deleteFolder('Temporary',{mode:'reassign',destination:'Unsorted'},'d'),{moved:1,destination:'Unsorted'});
 assert.equal(s.state.notes[loose.id].path,'Unsorted/Loose.md');assert.ok(s.state.folders?.includes('Unsorted'));
});
test('folder deletion rejects missing folders, self destinations and occupied reassignment paths',()=>{
 const s=fresh();s.createFolder('Writing');s.createFolder('Archive');s.mutate(create('Writing/First.md'),'d');s.mutate(create('Archive/First.md'),'d');
 assert.throws(()=>s.deleteFolder('Missing',{mode:'trash'},'d'),/not found/i);
 assert.throws(()=>s.deleteFolder('Writing',{mode:'reassign',destination:'Writing'},'d'),/outside/i);
 assert.throws(()=>s.deleteFolder('Writing',{mode:'reassign',destination:'Archive'},'d'),/occupied/i);
});
test('Reliquary migration preserves notes, attachments, empty folders, state and restart recovery',()=>{let s=fresh();const n=create();s.mutate(n,'d');s.attachment('Attachments/photo.png',Buffer.from('picture'));s.createFolder('Empty');assert.throws(()=>s.moveReliquary('../outside'));assert.throws(()=>s.moveReliquary('Folder/Inside'));assert.equal(s.location().directory,'vault');s.moveReliquary('My Reliquary');assert.equal(fs.readFileSync(s.vault(n.path),'utf8'),n.content);assert.equal(fs.readFileSync(s.vault('Attachments/photo.png'),'utf8'),'picture');assert.ok(fs.statSync(s.vault('Empty')).isDirectory());assert.ok(!fs.existsSync(`${root}/vault`));assert.equal(s.moveReliquary('My Reliquary').directory,'reliquaries/My Reliquary');s=new Store(root);assert.equal(s.state.notes[n.id].content,n.content);assert.equal(fs.readFileSync(s.vault(n.path),'utf8'),n.content);s.moveReliquary('Another Place');assert.ok(fs.existsSync(s.vault('Empty')));s=new Store(root);assert.equal(s.location().directory,'reliquaries/Another Place');});
test('portable paths reject traversal, platform hazards and hidden metadata',()=> { for(const p of ['../x.md','/x.md','a\\b.md','.spire/a.md','a/../b','a//b','NUL.md','x%2fy.md']) assert.equal(safePath.safeParse(p).success,false,p); assert.ok(safePath.safeParse('Notes/Hello world.md').success); });
test('revision CAS, replay, delete/restore and durable conflict survive restart',()=> { let s=fresh(); const m=create(); const a=s.mutate(m,'d'); assert.equal(a.rev,1); assert.equal(s.mutate(m,'d').rev,1); assert.throws(()=>s.mutate({...m,op:randomUUID(),content:'stale'},'d'), /Conflict/); assert.equal(s.state.conflicts.length,1); const b=s.mutate({...m,op:randomUUID(),base:1,deleted:true},'d'); assert.equal(b.rev,2); assert.equal(fs.existsSync(`${root}/vault/${m.path}`),false); s=new Store(root); assert.equal(s.state.conflicts.length,1); s.mutate({...m,op:randomUUID(),base:2},'d'); assert.equal(fs.readFileSync(`${root}/vault/${m.path}`,'utf8'),'# First'); });
test('rename updates wiki and relative Markdown references as a transaction',()=>{const s=fresh();const a=create('Folder/First.md');s.mutate(a,'d');const b=create('Other.md','[[First#Top|label]] [link](Folder/First.md#Top) `[[First]]`');s.mutate(b,'d');s.mutate({...a,base:1,op:randomUUID(),path:'New/Renamed.md'},'d'); assert.equal(s.state.notes[b.id].content,'[[New/Renamed#Top|label]] [link](New/Renamed.md#Top) `[[First]]`');assert.equal(s.state.notes[b.id].rev,2);assert.equal(fs.existsSync(`${root}/vault/Folder/First.md`),false);});
test('adjacent stylesheets are portable, follow file renames, and unmatched styles remain in place',()=>{
 let s=fresh();const file=create('Writing/First.md');s.mutate(file,'d');
 s.putStyle('Writing/First.css','.preview { color: ivory; }');
 s.putStyle('Writing/Loose.css','h1 { letter-spacing: .1em; }');
 assert.equal(fs.readFileSync(`${root}/vault/Writing/First.css`,'utf8'),'.preview { color: ivory; }');
 s.mutate({...file,base:1,op:randomUUID(),path:'Archive/Renamed.md'},'d');
 assert.equal(s.state.styles?.['Archive/Renamed.css'],'.preview { color: ivory; }');
 assert.equal(s.state.styles?.['Writing/First.css'],undefined);
 assert.equal(s.state.styles?.['Writing/Loose.css'],'h1 { letter-spacing: .1em; }');
 assert.equal(fs.existsSync(`${root}/vault/Writing/First.css`),false);
 assert.equal(fs.readFileSync(`${root}/vault/Archive/Renamed.css`,'utf8'),'.preview { color: ivory; }');
 assert.throws(()=>s.putStyle('Archive/Renamed.css','@import "https://example.com/x.css"'),/not allowed/i);
 assert.throws(()=>s.putStyle('Archive/Renamed.css','p { background: url(https://example.com/x) }'),/not allowed/i);
 s=new Store(root);assert.equal(s.state.styles?.['Archive/Renamed.css'],'.preview { color: ivory; }');
});
test('duplicate path rejected; symlink boundary refused',()=>{const s=fresh();s.mutate(create(),'d');assert.throws(()=>s.mutate(create(),'d'));fs.symlinkSync(process.cwd(),`${root}/vault/Escape`);assert.throws(()=>s.mutate(create('Escape/Bad.md'),'d'),/symbolic/i);fs.unlinkSync(`${root}/vault/Escape`);});
test('prepared journal rolls forward after interruption',()=>{let s=fresh();const a=create();s.mutate(a,'d');const next=structuredClone(s.state);next.notes[a.id].content='recovered';fs.writeFileSync(`${root}/pending.json`,JSON.stringify({before:s.state,after:next}));s=new Store(root);assert.equal(fs.readFileSync(`${root}/vault/${a.path}`,'utf8'),'recovered');assert.equal(fs.existsSync(`${root}/pending.json`),false);});
test('frontmatter preserves arbitrary properties, aliases and nested tags',()=>{const m=metadata('---\naliases: [One, Two]\ntags: [a/b]\ncustom: 42\n---\n# Hello\n#inline');assert.deepEqual(m.aliases,['One','Two']);assert.equal(m.properties.custom,42);assert.deepEqual(m.tags,['a/b','inline']);assert.equal(mutationSchema.safeParse(create()).success,true);});
test('starred state round-trips in portable Markdown without losing body or custom metadata',()=>{
 const original='---\naliases: [One]\ncustom: 42 # keep\n---\n# Body\n';
 const marked=setStarred(original,true);assert.equal(isStarred(marked),true);assert.equal(metadata(marked).properties.custom,42);assert.equal(metadata(marked).body,'# Body\n');
 const unmarked=setStarred(marked,false);assert.equal(isStarred(unmarked),false);assert.equal(metadata(unmarked).body,'# Body\n');assert.match(unmarked,/custom: 42 # keep/);
 const plain=setStarred('Just writing',true);assert.equal(isStarred(plain),true);assert.equal(metadata(plain).body,'Just writing');
 assert.equal(setStarred('Just writing',false),'Just writing');assert.throws(()=>setStarred('---\nnot: [valid\n---\nBody',true),/invalid YAML/);
});
test('permanent deletion requires a trashed note at its current revision and erases history without resurrection',()=>{
 let s=fresh();const m=create('My note.md','private first version');s.mutate(m,'d');
 s.mutate({...m,base:1,op:randomUUID(),content:'private second version'},'d');
 assert.throws(()=>s.purge(m.id,2,'d'),/trash/i);
 const trashed=s.mutate({...m,base:2,op:randomUUID(),deleted:true},'d');
 assert.throws(()=>s.purge(m.id,2,'d'),/Conflict/);
 assert.throws(()=>s.purge(randomUUID(),1,'d'),/not found/i);
 s.purge(m.id,trashed.rev,'d');s=new Store(root);
 assert.equal(s.state.notes[m.id],undefined);
 assert.ok(!JSON.stringify(s.state).includes('private first version'));
 assert.ok(!JSON.stringify(s.state).includes('private second version'));
 assert.throws(()=>s.mutate({...m,base:0,op:randomUUID()},'offline'),/permanently deleted/i);
 s.mutate(create('My note.md','fresh note'),'d');
});
