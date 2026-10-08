import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPage,writePage} from '../client/page-layout.ts';
import {renderMarkdown} from '../client/markdown.ts';
import type {Note} from '../shared/model';
const fresh=(path:string,content:string):Note=>({id:path,path,content,rev:1,deleted:false,history:[],time:''});
test('optional footnotes serialize after footer, preserve body and restore hidden definitions',()=>{
 const body='Text.[^1]';let layout=readPage(body);assert.equal(layout.footnotes?.enabled,false);
 layout.header={enabled:true,text:'Header'};layout.footer={enabled:true,text:'Footer'};layout.footnotes={enabled:true,text:`[^1]: Explanation

[^long]: More
    continued`};
 let source=writePage(body,layout);assert.deepEqual(readPage(source),layout);assert.ok(source.indexOf('<!-- spire:footnotes -->')>source.indexOf('<!-- /spire:footer -->'));
 const html=renderMarkdown(fresh('Writing/Test.md',source),[],[]);assert.match(html,/fn-1/);assert.match(html,/Explanation/);
 layout=readPage(source);layout.footnotes!.enabled=false;source=writePage(source,layout);assert.ok(!source.includes('<!-- spire:footnotes -->'));assert.equal(readPage(source).footnotes?.text,layout.footnotes!.text);assert.equal(readPage(source).body,body);
 layout=readPage(source);layout.footnotes!.enabled=true;source=writePage(source,layout);assert.deepEqual(readPage(source),layout);
 const changed=source.replace('<!-- spire:footnotes -->\n[^1]: Explanation','<!-- spire:footnotes -->\n[^1]: Changed');assert.match(readPage(changed).footnotes!.text,/Changed/);
 assert.throws(()=>readPage(source.replace('<!-- /spire:footnotes -->','')),/boundary/);
});
