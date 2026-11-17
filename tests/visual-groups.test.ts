import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Store} from '../server/store.ts';
import {createBackup,restoreBackup} from '../server/backup.ts';

const groups=[{id:'8b5d2ee5-1045-4bad-93b7-3faf315f05e5',name:'Workshop',color:'#247acf',members:['folder:Human','folder:Machine']}];

test('visual groups persist per directory across restart and backup restore',()=>{
 const root='.test-data/visual-groups',restored='.test-data/visual-groups-restored',backup='.test-data/visual-groups-backup.json';
 fs.rmSync(root,{recursive:true,force:true});fs.rmSync(restored,{recursive:true,force:true});fs.rmSync(backup,{force:true});
 let store=new Store(root);
 store.saveVisualGroups('',groups);
 store.saveVisualGroups('Writing',[{...groups[0],id:'967df772-1fde-41f8-99dc-9f42c6b7022d',name:'Drafts'}]);
 store=new Store(root);
 assert.deepEqual(store.state.visualGroups?.[''],groups);
 assert.equal(store.state.visualGroups?.Writing?.[0].name,'Drafts');
 createBackup(root,backup);restoreBackup(backup,restored);
 assert.deepEqual(new Store(restored).state.visualGroups,store.state.visualGroups);
});

test('project artwork metadata persists with bounded focal positions',()=>{
 const root='.test-data/project-artwork';fs.rmSync(root,{recursive:true,force:true});
 const store=new Store(root);
 const project={...groups[0],members:['project:Workshop'],icon:'Projects/Workshop/Project Assets/icon.webp',hero:'Projects/Workshop/Project Assets/cover.jpg',heroX:34,heroY:72};
 store.saveVisualGroups('Projects',[project]);
 assert.deepEqual(new Store(root).state.visualGroups?.Projects?.[0],project);
 assert.throws(()=>store.saveVisualGroups('Projects',[{...project,heroX:101}]),/100|less than or equal/i);
 assert.throws(()=>store.saveVisualGroups('Projects',[{...project,icon:'../icon.png'}]),/path|portable/i);
});

test('project cover renders between its label bar and section icon rail',()=>{
 const source=fs.readFileSync('client/VisualGroups.tsx','utf8');
 const label=source.indexOf('<div className="visual-section-title">');
 const cover=source.indexOf('className="project-hero"');
 const sections=source.indexOf('<div className="visual-section-items"');
 assert.ok(label>=0&&cover>label&&sections>cover,'expected project label, then cover, then section controls');
});

test('visual groups reject invalid colors and duplicate membership',()=>{
 const root='.test-data/visual-groups-validation';fs.rmSync(root,{recursive:true,force:true});const store=new Store(root);
 assert.throws(()=>store.saveVisualGroups('',[{...groups[0],color:'red'}]),/color/i);
 assert.throws(()=>store.saveVisualGroups('',[groups[0],{...groups[0],id:'967df772-1fde-41f8-99dc-9f42c6b7022d',members:['folder:Human']}]),/member/i);
});
