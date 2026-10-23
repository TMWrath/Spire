import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankLineTokens,joinEditorBlocks} from '../client/editor-blank-lines';
for(const source of ['one\n\ntwo','one\n\n\ntwo','one\n\n\n\ntwo','\n\none\n\n\n','one\n','\n\n\n','one\n\n']) test(`blank lines survive edit and reopen: ${JSON.stringify(source)}`,()=>{
 const roundtrip=(s:string)=>joinEditorBlocks(blankLineTokens(s).map(t=>t.kind==='gap'?{blankNewlines:t.newlines}:{text:t.source}));
 assert.equal(roundtrip(source),source);
 const edited=source.replace('one','edited');assert.equal(roundtrip(roundtrip(edited)),edited);
});
test('new empty editor paragraphs retain blank lines',()=>{
 assert.equal(joinEditorBlocks([{text:'one'},{blankNewlines:2},{text:'two'},{blankNewlines:2}]),'one\n\n\n\ntwo\n\n');
});
