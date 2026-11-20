import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TaskCard} from '../client/TaskCard.tsx';

test('task card exposes its short number and reusable tag editor',()=>{
 const html=renderToStaticMarkup(<TaskCard task={{id:'00000000-0000-4000-8000-000000000001',shortId:142,title:'Ship tags',done:false,tags:['frontend','urgent-fix']}} onChange={async()=>{}} onDelete={()=>{}} onLink={()=>{}} onOpen={()=>{}} onUpload={async()=>''}/>);
 assert.match(html,/class="task-short-id"[^>]*>#142</);
 assert.match(html,/aria-label="Tags for Ship tags"/);
 assert.match(html,/>frontend</);assert.match(html,/>urgent-fix</);
});
