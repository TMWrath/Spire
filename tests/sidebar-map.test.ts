import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSidebarGraph} from '../client/sidebar-map-model';
import type {Note} from '../shared/model';
const file=(id:string,content:string,templateIds?:string[]):Note=>({id,path:`Writing/${id}.md`,content,rev:1,time:'',deleted:false,history:[],templateIds});
test('sidebar Files keeps references; Tags connects shared inline/frontmatter tags once and excludes trash',()=>{
 const a=file('a','---\ntags: [shared]\n---\n#second'),b=file('b','#shared #second [[a]]'),c=file('c','#unrelated'),deleted={...file('d','#shared'),deleted:true};
 assert.deepEqual(buildSidebarGraph([a,b,c,deleted],[],'files').edges,[{source:'a',target:'b'}]);
 assert.deepEqual(buildSidebarGraph([a,b,c,deleted],[],'tags').edges,[{source:'a',target:'b'}]);
 assert.equal(buildSidebarGraph([a,b,c,deleted],[],'tags').nodes.length,3);
});
test('Templates connects stable template identities to actual using files, not titles or content guesses',()=>{
 const library=[{id:'journal',title:'Journal',category:'full' as const,content:'template'}];
 const graph=buildSidebarGraph([file('a','edited writing',['journal','journal']),file('b','template'),{...file('trash','',['journal']),deleted:true}],library,'templates');
 assert.deepEqual(graph.edges,[{source:'template:journal',target:'a'}]);
 assert.deepEqual(graph.nodes.map(n=>n.id),['template:journal','a']);
 assert.equal(buildSidebarGraph([],library,'templates').nodes.length,1);
});
