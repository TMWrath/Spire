import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,demoFiles} from '../client/mind-map-model.ts';
import type {Note} from '../shared/model.ts';
const file=(id:string,content='',deleted=false):Note=>({id,path:`Writing/${id}.md`,content,deleted,rev:1,time:'',history:[]});
test('reference pulses flow from referenced file to referencing file, deduplicated',()=>{const g=buildGraph([file('A','[[B]] [[B]]'),file('B')]);assert.deepEqual(g.edges,[{source:'B',target:'A'}]);});
test('mutual references remain directional; deleted, external, unresolved and code links excluded',()=>{const g=buildGraph([file('A','[[B]] [[Gone]] [[Missing]] `[[C]]` [web](https://example.com)'),file('B','[[A]]'),file('C'),file('Gone','',true)]);assert.equal(g.nodes.length,3);assert.deepEqual(g.edges,[{source:'B',target:'A'},{source:'A',target:'B'}]);});
test('relative and alias links resolve without folder nodes or attachments',()=>{const g=buildGraph([file('A','[b](B.md#hi) [[Alias]] ![image](a.png)'),file('B'),{...file('C'),content:'---\naliases: [Alias]\n---\n'}]);assert.equal(g.nodes.length,3);assert.equal(g.edges.length,2);});
test('demo is deterministic presentation-only data with real relationships',()=>{assert.ok(demoFiles.length>=12);assert.ok(buildGraph(demoFiles).edges.length>=15);assert.ok(demoFiles.every(n=>n.id.startsWith('demo-')));});
