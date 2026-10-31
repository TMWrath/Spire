import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dictatedMarkdown,transcriptFile,validateVoiceTarget} from '../client/voice-authoring';

test('natural dictation keeps command-like prose literal',()=>{
 assert.equal(dictatedMarkdown('Spire, new paragraph. Hello.',false).markdown,'Spire, new paragraph. Hello.');
});
test('explicit commands produce headings, paragraphs and inline formatting',()=>{
 const result=dictatedMarkdown('Spire, heading two. Chapter Five. Spire, new paragraph. The house was silent. Spire, start italic. Something waited. Spire, end italic.',true);
 assert.equal(result.markdown,'## Chapter Five.\n\nThe house was silent. *Something waited.*');
 assert.equal(result.commands.length,4);
});
test('literal mode protects command phrases',()=>{
 assert.equal(dictatedMarkdown('Spire, literal text. Spire, new paragraph. Spire, end literal text.',true).markdown,'Spire, new paragraph.');
});
test('unknown commands remain prose and commands cannot perform privileged actions',()=>{
 assert.equal(dictatedMarkdown('Spire, delete all files.',true).markdown,'Spire, delete all files.');
});
test('lists use explicit item boundaries',()=>{
 assert.equal(dictatedMarkdown('Spire, start bullet list. First. Spire, next item. Second. Spire, end list.',true).markdown,'- First.\n- Second.');
});
test('structured file preserves full transcript without inventing summary or tasks',()=>{
 const raw='Um, this is the entire transcript. We might call tomorrow.';
 const result=transcriptFile('Meeting',raw,'structured');
 assert.ok(result.includes('## Full transcript\n\n'+raw));
 assert.ok(!result.includes('- [ ]'));
});
test('clean mode retains original transcript',()=>{
 const raw='um, Hello   there.';
 assert.ok(transcriptFile('Recording',raw,'clean').includes(raw));
});
test('acceptance refuses changed, deleted, or different target',()=>{
 const target={id:'a',content:'original'};
 assert.doesNotThrow(()=>validateVoiceTarget(target,target));
 for(const current of [{id:'a',content:'changed'},{id:'b',content:'original'},{...target,deleted:true},null])assert.throws(()=>validateVoiceTarget(target,current));
});
