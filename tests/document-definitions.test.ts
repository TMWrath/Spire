import assert from 'node:assert/strict';
import test from 'node:test';
import {readDocumentDefinitions,upsertDocumentDefinition,setDefinitionsPageEnabled} from '../client/document-definitions.ts';

const page='---\nspire_page:\n  header: { enabled: false, text: "" }\n  footer: { enabled: true, text: Footer }\n  footnotes: { enabled: false, text: "" }\n  toc: { enabled: false, text: "" }\n---\nMain ending.\n\n<!-- spire:footer -->\nFooter\n<!-- /spire:footer -->';

test('stores document-local definitions without changing main prose',()=>{
 const result=upsertDocumentDefinition('Main ending.','Aphelion','The farthest orbital point.');
 assert.deepEqual(readDocumentDefinitions(result),[{term:'Aphelion',definition:'The farthest orbital point.'}]);
 assert.match(result,/Main ending\.$/);
 assert.doesNotMatch(result,/^# Definitions/m);
});

test('updates a duplicate term case-insensitively instead of adding another',()=>{
 const first=upsertDocumentDefinition('Body','Aphelion','First');
 const second=upsertDocumentDefinition(first,' aphelion ','Updated');
 assert.deepEqual(readDocumentDefinitions(second),[{term:'Aphelion',definition:'Updated'}]);
});

test('generates definitions after main content and before running footer',()=>{
 const stored=upsertDocumentDefinition(page,'Aphelion','The farthest orbital point.');
 const generated=setDefinitionsPageEnabled(stored,true);
 assert.ok(generated.indexOf('Main ending.')<generated.indexOf('# Definitions'));
 assert.ok(generated.indexOf('# Definitions')<generated.indexOf('<!-- spire:footer -->'));
 assert.match(generated,/# Definitions\n\n## Aphelion\nThe farthest orbital point\./);
 const changed=upsertDocumentDefinition(generated,'Perihelion','The nearest orbital point.');
 assert.match(changed,/## Perihelion\nThe nearest orbital point\./);
 assert.equal(changed.match(/# Definitions/g)?.length,1);
});

test('can remove the generated page while retaining canonical definitions',()=>{
 const stored=upsertDocumentDefinition('Body','Aphelion','Meaning');
 const removed=setDefinitionsPageEnabled(setDefinitionsPageEnabled(stored,true),false);
 assert.doesNotMatch(removed,/# Definitions/);
 assert.equal(readDocumentDefinitions(removed)[0]?.definition,'Meaning');
});
