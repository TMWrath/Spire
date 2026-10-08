import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {blockMarkdown,insertBlock} from '../client/blocks';
test('blocks serialize portable Markdown including empty code and embedded fences',()=>{
 assert.equal(blockMarkdown('code',''),'```\n\n```');
 assert.equal(blockMarkdown('code','a\n```\nb'),'````\na\n```\nb\n````');
 assert.equal(blockMarkdown('quote','one\n\ntwo'),'> one\n>\n> two');
 assert.equal(blockMarkdown('quote',''),'>');
});
test('block insertion replaces selection and separates adjacent prose',()=>{
 assert.equal(insertBlock('Before replace after',7,14,'code','hello').content,'Before \n\n```\nhello\n```\n\n after');
 assert.equal(insertBlock('',0,0,'code','').content,'```\n\n```');
 assert.equal(insertBlock('Before\n\nafter',8,8,'quote','line').content,'Before\n\n> line\n\nafter');
});
