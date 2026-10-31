import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyHighlight,normalizeColor,highlightInk} from '../client/highlight';
test('highlight uses Markdown default and portable HTML colors at exact selection',()=>{
 assert.equal(applyHighlight('Before words after',7,12,'default').content,'Before ==words== after');
 assert.equal(applyHighlight('Before words after',7,12,'#abc').content,'Before <mark style="background-color: #aabbcc; color: #111111;">words</mark> after');
 assert.equal(applyHighlight('words',0,0,'default').content,'words');
});
test('changing or removing highlight never nests wrappers',()=>{
 assert.equal(applyHighlight('==words==',2,7,'#123456').content,'<mark style="background-color: #123456; color: #ffffff;">words</mark>');
 const html='<mark style="background-color: #aabbcc; color: #111111;">words</mark>';
 const at=html.indexOf('words');assert.equal(applyHighlight(html,at,at+5,'default').content,'==words==');
 assert.equal(applyHighlight('==words==',0,9,'remove').content,'words');
});
test('color validation is strict and foreground remains legible',()=>{
 assert.equal(normalizeColor('#AbC'),'#aabbcc');assert.equal(normalizeColor('FF00AA'),'#ff00aa');
 assert.equal(normalizeColor('red; background:url(x)'),null);assert.equal(normalizeColor('#12345678'),null);
 assert.equal(highlightInk('#000000'),'#ffffff');assert.equal(highlightInk('#ffffff'),'#111111');
});
test('multiline highlighting uses independent inline spans and preserves line endings',()=>{
 assert.equal(applyHighlight('first\nsecond',0,12,'default').content,'==first==\n==second==');
});
