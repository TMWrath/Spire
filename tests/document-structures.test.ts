import assert from 'node:assert/strict';
import test from 'node:test';
import {documentLists,documentTables,replaceDocumentStructure} from '../client/document-structures';

test('indexes titled and untitled lists with exact source ranges',()=>{
 const content='Intro\n\n## Packing\n\nA. Shirts\n  a. Socks\nB. Shoes\n\nAfter\n\n- First\n- Second';
 const lists=documentLists(content);
 assert.equal(lists.length,2);
 assert.deepEqual({...lists[0],items:lists[0].items.map(({text,depth})=>({text,depth}))},{start:7,end:48,title:'Packing',style:'lettered',items:[{text:'Shirts',depth:0},{text:'Socks',depth:1},{text:'Shoes',depth:0}]});
 assert.equal(content.slice(lists[0].start,lists[0].end),'## Packing\n\nA. Shirts\n  a. Socks\nB. Shoes');
 assert.equal(lists[1].title,'');
 assert.equal(lists[1].style,'dash');
 assert.deepEqual(lists[1].items.map(({text,depth})=>({text,depth})),[{text:'First',depth:0},{text:'Second',depth:0}]);
});

test('keeps separate lists separate and recognizes checkbox, numbered, and bullet styles',()=>{
 const content='1. One\n2. Two\n\n- [ ] Todo\n- [ ] Done\n\n* Alpha\n* Beta';
 assert.deepEqual(documentLists(content).map(list=>list.style),['numbered','checkboxes','bullets']);
});

test('indexes every managed table and exposes a useful label',()=>{
 const content='Before\n\n<!-- spire:table id=first -->\n| Name | Age |\n| --- | ---: |\n| Ty | 34 |\n<!-- /spire:table -->\n\nMiddle\n\n<!-- spire:table id=second -->\n| Item |\n| --- |\n| Pen |\n<!-- /spire:table -->';
 const tables=documentTables(content);
 assert.equal(tables.length,2);
 assert.equal(tables[0].id,'first');
 assert.equal(tables[0].label,'Name · Age');
 assert.deepEqual(tables[0].alignments,[null,'right']);
 assert.equal(content.slice(tables[1].start,tables[1].end).startsWith('<!-- spire:table id=second -->'),true);
});

test('replaces only the selected indexed structure',()=>{
 const content='Before\n\n- Old\n\nAfter';
 const [list]=documentLists(content);
 assert.equal(replaceDocumentStructure(content,list,'## New\n\nA. One'),'Before\n\n## New\n\nA. One\n\nAfter');
});
