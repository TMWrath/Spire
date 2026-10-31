import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quickFormatMatch} from '../client/QuickFormat';

test('image quick formats select alignment and require exact whitespace-delimited tokens',()=>{
 assert.deepEqual(quickFormatMatch('@img'),{image:true,alignment:undefined,length:4});
 assert.deepEqual(quickFormatMatch('@imgl'),{image:true,alignment:'left',length:5});
 assert.deepEqual(quickFormatMatch('@imgc'),{image:true,alignment:'center',length:5});
 assert.deepEqual(quickFormatMatch('@imgr'),{image:true,alignment:'right',length:5});
 assert.equal(quickFormatMatch('email@img'),null);
 assert.equal(quickFormatMatch('@imgx'),null);
});

test('new-page quick layout action matches only the exact whitespace-delimited token',()=>{
 assert.deepEqual(quickFormatMatch('@npg'),{layout:'new-page',label:'New page',length:4});
 assert.equal(quickFormatMatch('email@npg'),null);
 assert.equal(quickFormatMatch('@npgx'),null);
});
