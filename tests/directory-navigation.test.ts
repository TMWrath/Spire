import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationIndex,type Note} from '../shared/model';
import {workspaceDirectory} from '../shared/workspace-directory';
import {buildGraph} from '../client/mind-map-model';
import {buildSidebarGraph} from '../client/sidebar-map-model';
test('deferred directory files retain graph, alias and tag navigation without reading bodies',()=>{
 const base={rev:1,time:'',deleted:false};
 const a={...base,id:'a',path:'Writing/A.md',navigation:navigationIndex('---\naliases: [Origin]\ntags: [shared]\n---\nA')};
 const b={...base,id:'b',path:'Writing/B.md',navigation:navigationIndex('---\ntags: [shared]\n---\n[[Origin]]')};
 const directory=workspaceDirectory({seq:2,notes:{a,b},folders:['Writing'],attachments:[]});
 const notes=directory.files.map(n=>({...n,history:[],contentLoaded:false,get content():string{throw Error('Unopened body read');}})) as Note[];
 assert.deepEqual(buildGraph(notes).edges,[{source:'a',target:'b'}]);
 assert.deepEqual(buildSidebarGraph(notes,[],'tags').edges,[{source:'a',target:'b'}]);
 assert.ok(!JSON.stringify(directory).includes('content'));
});
