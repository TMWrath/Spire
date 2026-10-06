import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeCase,wordRange,caseSelection} from '../client/capitalization';
test('capitalization styles handle text, punctuation, Unicode and whitespace',()=>{
 assert.equal(changeCase('Hello world!','upper'),'HELLO WORLD!');
 assert.equal(changeCase('HELLO World','lower'),'hello world');
 assert.equal(changeCase("don't STOP—éCOLE\nnew words",'title'),"Don't Stop—École\nNew Words");
 assert.equal(changeCase('HELLO WORLD. NEXT SENTENCE!\nTHIRD LINE','sentence'),'Hello world. Next sentence!\nThird line');
 assert.equal(changeCase('Hello WORLD 123','toggle'),'hELLO world 123');
 assert.equal(changeCase('straße','upper'),'STRASSE');
});
test('cursor targets only its word, including apostrophes and Unicode',()=>{
 assert.deepEqual(wordRange('one café words',6),{start:4,end:8});
 assert.deepEqual(wordRange("don't stop",2),{start:0,end:5});
 assert.deepEqual(wordRange('one  words',4),{start:4,end:4});
 assert.deepEqual(wordRange('one words',3),{start:0,end:3});
 assert.deepEqual(caseSelection('one café words',6,6,'upper'),{content:'one CAFÉ words',start:4,end:8});
 assert.deepEqual(caseSelection('one straße words',4,10,'upper'),{content:'one STRASSE words',start:4,end:11});
 assert.deepEqual(caseSelection('',0,0,'upper'),{content:'',start:0,end:0});
});
