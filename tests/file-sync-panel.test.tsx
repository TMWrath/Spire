import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FileSyncPanel} from '../client/FileSyncPanel';
test('file sync shows unstarted and failed linked media without calling them synced',()=>{
 const html=renderToStaticMarkup(<FileSyncPanel note={{path:'Notes/a.md',content:'![a](../Attachments/a.png) ![b](../Attachments/b.png)'}} attachments={[{path:'Attachments/a.png',size:42},{path:'Attachments/b.png',size:99}]} states={new Map([['Attachments/b.png',{state:'failed',error:'HTTP 404',direction:'download'}]])} documentStatus="No queued document edits" workspaceStatus="Connected" retry={async()=>{}}/>);
 assert.match(html,/Not started/);assert.match(html,/HTTP 404/);assert.match(html,/Server → client/);assert.match(html,/Retry/);assert.match(html,/42 bytes/);
});
test('active file sync shows measured stages without invented percentages',()=>{
 const html=renderToStaticMarkup(<FileSyncPanel note={{path:'a.md',content:'![a](Attachments/a.png)'}} attachments={[{path:'Attachments/a.png',size:42}]} states={new Map([['Attachments/a.png',{state:'transferring',phase:'Checking Server hash',direction:'checking',startedAt:1}]])} documentStatus="1 edit queued" workspaceStatus="Connected" retry={async()=>{}}/>);
 assert.match(html,/Checking Server hash/);assert.match(html,/1 edit queued/);assert.doesNotMatch(html,/100%/);
});
