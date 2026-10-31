import test from 'node:test';
import assert from 'node:assert/strict';
import {fullTemplates,insertFullTemplate} from '../client/full-templates.ts';
test('full templates provide portable cigar journal, journal and checklist starters',()=>{
 assert.deepEqual(fullTemplates.map(t=>t.title),['Cigar journal','Journal','Checklist']);
 for(const template of fullTemplates){assert.ok(template.content.startsWith('# '));assert.ok(!template.content.includes('<'));assert.ok(!template.content.includes('spire_'));}
 assert.ok(fullTemplates[0].content.includes('### First third'));
 assert.ok(fullTemplates[2].content.includes('- [ ] First task'));
});
test('full template insertion keeps surrounding prose and separators',()=>{
 assert.equal(insertFullTemplate('BeforeAfter',6,'# Journal\n'),'Before\n\n# Journal\n\nAfter');
 assert.equal(insertFullTemplate('',0,'# Journal\n'),'# Journal\n');
 assert.equal(insertFullTemplate('Original',999,'# Journal\n'),'Original\n\n# Journal\n');
});
