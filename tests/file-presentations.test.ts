import test from 'node:test';
import assert from 'node:assert/strict';
import {filePresentation,setFilePresentation} from '../shared/file-presentations';

test('list presentation is explicit and does not infer ordinary Markdown lists',()=>{
 assert.equal(filePresentation('# Groceries\n\n- Milk\n- Bread\n'),null);
 assert.equal(filePresentation('<!-- spire:presentation list -->\n# Groceries\n\n- Milk\n'),'list');
});

test('presentation designation is reversible without rewriting user content',()=>{
 const original='# Groceries\n\nIntro prose.\n\n* Milk\n  * Whole\n\nUnknown tail.\n';
 const designated=setFilePresentation(original,'list');
 assert.equal(designated,'<!-- spire:presentation list -->\n'+original);
 assert.equal(setFilePresentation(designated,null),original);
});

test('changing a presentation only replaces the explicit marker',()=>{
 const content='<!-- spire:presentation list -->\n# Title\n\n- [ ] Keep formatting\n';
 assert.equal(setFilePresentation(content,'wiki'),'<!-- spire:presentation wiki -->\n# Title\n\n- [ ] Keep formatting\n');
});
