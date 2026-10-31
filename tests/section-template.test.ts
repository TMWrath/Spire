import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {insertHeroSection,refreshHeroSection} from '../shared/section-template.ts';

test('hero template inserts portable markdown using note sidebar metadata and relative attachment path',()=>{
 const content='---\nhero: Attachments/heroes/cover.png\ndescription: A quiet beginning.\ntags: [writing, ideas]\n---\nOriginal prose.';
 const result=insertHeroSection(content,'Writing/Story.md',content.length);
 assert.match(result,/!\[Header image\]\(\.\.\/Attachments\/heroes\/cover\.png\)/);
 assert.match(result,/> A quiet beginning\./);
 assert.match(result,/#writing #ideas/);
 assert.match(result,/Original prose\./);
});
test('sidebar edits refresh the inserted section without touching authored prose',()=>{
 const base='---\ndescription: Old.\ntags: [old]\n---\nOriginal prose.';
 const inserted=insertHeroSection(base,'Story.md',base.length);
 const updated=refreshHeroSection(inserted.replace('description: Old.','description: New.').replace('tags: [old]','tags: [new]'),'Story.md');
 assert.match(updated,/> New\./);assert.match(updated,/#new/);assert.doesNotMatch(updated,/> Old\./);
 assert.equal((updated.match(/Original prose\./g)||[]).length,1);
});
test('empty metadata produces editable placeholders and duplicate insertion is rejected',()=>{
 const result=insertHeroSection('Body','Story.md',0);
 assert.match(result,/Add a header image/);assert.match(result,/Add a description/);assert.match(result,/Add tags/);
 assert.equal(insertHeroSection(result,'Story.md',0),result);
 const withFrontmatter='---\ndescription: Banner\n---\nBody';
 const inserted=insertHeroSection(withFrontmatter,'Story.md',0);
 assert.match(inserted,/^---\ndescription: Banner\n---\n/);
 assert.ok(inserted.indexOf('spire:hero-section:start')>inserted.indexOf('---\nBody')-5);
});
