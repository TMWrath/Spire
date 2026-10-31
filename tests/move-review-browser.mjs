import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
const component=fs.readFileSync('client/WorkspaceMounts.tsx','utf8').split('export function ServerSettings')[1];
const fixture=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
const androidAppAvailable=()=>false;
window.actions=[];
const mounted={supported:true,busy:false,remote:undefined,journals:[1,2].map(id=>({id:String(id),path:'99 - Archive/test file.md',message:'Reconnect and resolve pending edits/conflicts before moving files'})),resumeJournal:async(id)=>{window.actions.push('resume:'+id)},dismissJournal:async(id)=>{window.actions.push('review:'+id);mounted.journals=mounted.journals.filter(j=>j.id!==id);draw()}};
function ServerSettings${component}
const root=createRoot(document.getElementById('root'));function draw(){root.render(<div className="settings"><ServerSettings beforeChange={async()=>{}} onDisconnected={()=>{}} onError={()=>{}}/></div>)}draw();`;
const compiled=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser'});
const css=fs.readFileSync('client/style.css','utf8')+'\n'+fs.readFileSync('client/workspace-mounts.css','utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?compiled.outputFiles[0].text:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script src="/fixture.js"></script>`)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,412,768]){
  const page=await browser.newPage({viewport:{width,height:915}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.move-review').first().waitFor();
  assert.equal(await page.locator('.move-review').count(),2);
  const geometry=await page.locator('.move-review').evaluateAll(cards=>cards.map(card=>({direction:getComputedStyle(card).flexDirection,overflow:card.scrollWidth>card.clientWidth+1,children:[...card.children].map(c=>({left:c.getBoundingClientRect().left,right:c.getBoundingClientRect().right})),width:innerWidth})));
  for(const g of geometry){assert.equal(g.direction,'column');assert.equal(g.overflow,false);for(const c of g.children){assert(c.left>=0&&c.right<=g.width,JSON.stringify(g))}}
  assert.equal(await page.getByRole('button',{name:'Resume move',exact:true}).first().isDisabled(),true);
  await page.getByRole('button',{name:'Acknowledge review',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.move-review').length===1);
  assert.deepEqual(await page.evaluate(()=>window.actions),['review:1']);
  await page.getByRole('button',{name:'Acknowledge review',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.move-review').length===0);
  assert.deepEqual(await page.evaluate(()=>window.actions),['review:1','review:2']);
  await page.close();
 }
 console.log('PASS interrupted-move reviews: 320/412/768px; contained stacked content, reachable review buttons, independent journal acknowledgement; no automatic resume. Chromium fixture, not Android WebView.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
