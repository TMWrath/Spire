import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableOfContents,contentsMarkdown} from '../client/table-of-contents';
import {readPage,writePage} from '../client/page-layout';
test('contents uses real headings, levels, inline labels and unique Unicode anchors',()=>{
 const entries=tableOfContents('# Hello **world**\n\n## Hello world\n\n```md\n# Not a heading\n```\n\nCafé\n====\n');
 assert.deepEqual(entries,[{level:1,text:'Hello world',id:'hello-world'},{level:2,text:'Hello world',id:'hello-world-1'},{level:1,text:'Café',id:'café'}]);
});
test('contents round-trips before header and refreshes without touching body',()=>{
 const original='---\ntitle: Story\n---\n# Start\n\n## Next';const layout=readPage(original);layout.toc={enabled:true,text:''};layout.header={enabled:true,text:'Header'};layout.footer={enabled:true,text:'Footer'};
 const saved=writePage(original,layout);assert.ok(saved.indexOf('spire:toc')<saved.indexOf('spire:header'));assert.ok(saved.includes('[Next](#next)'));assert.equal(readPage(saved).body,layout.body);
 const edited=readPage(saved);edited.body='# Changed';const next=writePage(saved,edited);assert.ok(next.includes('[Changed](#changed)'));assert.ok(!next.includes('[Next](#next)'));edited.toc!.enabled=false;assert.ok(!writePage(next,edited).includes('<!-- spire:toc -->'));
 assert.throws(()=>readPage(saved.replace('<!-- /spire:toc -->','')));
 assert.equal(contentsMarkdown('No headings'),'');
});
