import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTasks,collectImages,setImageTags,appendGroupedTask,renameTask,removeTask} from '../shared/workspace-collections';
import type {Note} from '../shared/model';

const note=(path:string,content:string,id=path):Note=>({id,path,content,rev:1,deleted:false,time:'2026-11-09T00:00:00.000Z',history:[]});

test('collects ordinary and project tasks with stable source offsets and heading groups',()=>{
 const notes=[
  note('Writing/Plan.md','# Plan\n\n## Today\n- [ ] Draft scene\n- [x] Outline\n'),
  note('Projects/Atlas/Tasks.md','# Tasks\n\n## Build\n- [ ] Make frame\n')
 ];
 const ordinary=collectTasks(notes,{kind:'files'});
 assert.deepEqual(ordinary.map(task=>[task.group,task.text,task.checked,task.folder]),[
  ['Today','Draft scene',false,'Writing'],['Today','Outline',true,'Writing']
 ]);
 const project=collectTasks(notes,{kind:'project',project:'Atlas'});
 assert.deepEqual(project.map(task=>[task.group,task.text]),[['Build','Make frame']]);
 assert.equal(notes[0].content.slice(ordinary[0].markerOffset,ordinary[0].markerOffset+3),'[ ]');
});

test('collects referenced images once per file and preserves image classifications in frontmatter',()=>{
 const source=note('Projects/Atlas/Ideas.md','---\nspire_image_tags:\n  Attachments/ship.png:\n    - Concept art\n---\n# Ideas\n\n![Ship](../../Attachments/ship.png)\n<img src="../../Attachments/proof.jpg">\n');
 const images=collectImages([source],[{path:'Attachments/ship.png'},{path:'Attachments/proof.jpg'}],{kind:'project',project:'Atlas'});
 assert.deepEqual(images.map(image=>[image.path,image.tags]),[
  ['Attachments/ship.png',['Concept art']],['Attachments/proof.jpg',[]]
 ]);
 const updated=setImageTags(source.content,'Attachments/proof.jpg',['Proof of work','Build']);
 assert.deepEqual(collectImages([{...source,content:updated}],[{path:'Attachments/proof.jpg'}],{kind:'project',project:'Atlas'})[0].tags,['Proof of work','Build']);
});

test('appends a task beneath an existing or new named group',()=>{
 assert.equal(appendGroupedTask('# Tasks\n\n## Build\n- [ ] Existing\n','Build','New'),'# Tasks\n\n## Build\n- [ ] Existing\n- [ ] New\n');
 assert.equal(appendGroupedTask('# Tasks\n','Research','Find source'),'# Tasks\n\n## Research\n- [ ] Find source\n');
});

test('renames and removes the exact Markdown task selected in the file task editor',()=>{
 const content='# Plan\n\n## Today\n- [ ] Repeat\n- [x] Repeat\n\nNotes stay here.\n';
 const tasks=collectTasks([note('Plan.md',content)],{kind:'files'});
 assert.equal(renameTask(content,tasks[1],'Finished copy'),'# Plan\n\n## Today\n- [ ] Repeat\n- [x] Finished copy\n\nNotes stay here.\n');
 assert.equal(removeTask(content,tasks[0]),'# Plan\n\n## Today\n- [x] Repeat\n\nNotes stay here.\n');
});
