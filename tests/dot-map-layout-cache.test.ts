import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLayoutCache} from '../client/dot-map/core.mjs';
test('layout cache reuses geometry across labels and tab round trips but invalidates topology',()=>{
 const get=createLayoutCache();const files=[{id:'a'},{id:'b'}];const a=get(files,[]);
 assert.equal(get(files.map(f=>({...f,name:'updated'})),[]),a);
 get(files,[{source:'a',target:'b'}]);assert.equal(get(files,[]),a);
 assert.notEqual(get([...files,{id:'c'}],[]),a);
});
