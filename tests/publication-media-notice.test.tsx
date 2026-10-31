import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PublicationMediaNotice} from '../client/PublicationMediaNotice';
test('opened file displays only its pending server attachments and offers retry',()=>{
 const states=new Map([['Assets/photo.png',{state:'failed' as const,error:'Local attachment unavailable'}],['Assets/other.png',{state:'transferring' as const}]]);
 const html=renderToStaticMarkup(<PublicationMediaNotice note={{path:'Notes/Test.md',content:'![photo](../Assets/photo.png)'}} states={states} retry={()=>{}}/>);
 assert.match(html,/role="status"/);assert.match(html,/Assets\/photo.png/);assert.match(html,/unavailable/i);assert.match(html,/Retry/);assert.doesNotMatch(html,/other.png/);
});
test('confirmed media and unrelated files do not produce a notice',()=>{
 const states=new Map([['Assets/photo.png',{state:'ready' as const}]]);
 assert.equal(renderToStaticMarkup(<PublicationMediaNotice note={{path:'Notes/Test.md',content:'![photo](../Assets/photo.png)'}} states={states} retry={()=>{}}/>),'');
});
