import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSidebarGraphCache} from '../client/sidebar-map-model';
const file={id:'a',path:'A.md',content:'hello',rev:0,time:'',deleted:false,history:[]};
test('map cache reuses unchanged snapshots across navigation and refresh',()=>{
 const get=createSidebarGraphCache();const a=get([file],[],'files');
 get([file],[],'tags');assert.equal(get([{...file}],[],'files'),a);
 assert.notEqual(get([{...file,content:'[[B]]'}],[],'files'),a);
});
test('map cache invalidates paths deletion templates and sources',()=>{
 const get=createSidebarGraphCache();const a=get([file],[],'files');
 assert.notEqual(get([{...file,path:'B.md'}],[],'files'),a);
 const tags=get([file],[],'tags');assert.notEqual(get([{...file,deleted:true}],[],'tags'),tags);
 const sources=get([file],[],'sources');assert.notEqual(get([file],[],'sources',[{id:'s',title:'Source'} as any]),sources);
 const templates=get([file],[],'templates');assert.notEqual(get([{...file,templateIds:['t']}],[{id:'t',title:'T',category:'full',content:''}],'templates'),templates);
});
