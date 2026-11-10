import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RevisionHistory} from '../client/RevisionHistory';

test('history renders the inline revision panel without a redundant launcher or raw executable snapshots',()=>{
 const r={rev:1,path:'Notes/One.md',content:'old',deleted:false,time:'2026-01-01'};
 const html=renderToStaticMarkup(<RevisionHistory note={{...r,id:'one',rev:2,content:'<script>alert(1)</script>',history:[r]}} restore={()=>{}}/>);
 assert.match(html,/history-shell history-inline/);
 assert.doesNotMatch(html,/DOCUMENT HISTORY/);
 assert.match(html,/<nav[^>]+aria-label="Revisions"/);
 assert.match(html,/aria-pressed="true"><strong>Revision 2/);
 assert.match(html,/aria-pressed="false"><strong>Revision 1/);
 assert.match(html,/role="tablist" aria-label="Revision view"/);
 assert.match(html,/aria-label="Line changes"/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/history-launcher|history-count/);
 assert.ok(!html.includes('<pre>'));
 assert.ok(!html.includes('<script>'));
});
