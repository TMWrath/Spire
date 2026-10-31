import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:"import {Engine} from './client/sync';window.Engine=Engine",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.route('http://localhost/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));await page.goto('http://localhost');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(async()=>{
  const e=new window.Engine({kind:'server',origin:'https://example.test'},'open-media-regression');
  const n={id:'test',path:'Notes/test.md',content:'![image](../Attachments/test.png)',rev:1,history:[],deleted:false,templateIds:[],time:'2026-01-01T00:00:00Z'};
  e.cache.snapshot.notes=[n];e.cache.snapshot.attachments=[{path:'Attachments/test.png',size:3}];await e.persist();
  let release,started;const entered=new Promise(r=>started=r);const wait=new Promise(r=>release=r);
  e.raw=async()=>{started();await wait;return new Response('bad',{status:503});};
  const open=e.openFile(n);await entered;
  const opened=await Promise.race([open.then(()=>true),new Promise(r=>setTimeout(()=>r(false),300))]);
  release();await open;if(e.mediaDownloads)await e.mediaDownloads.whenIdle();
  return {opened,state:e.mediaDownloads?.states.get('Attachments/test.png')};
 });
 assert.equal(result.opened,true,'Server document opening waits for media bytes');assert.equal(result.state?.state,'failed','Failed downloads must be visible');console.log('Server document opens during stalled media; failure remains visible');
}finally{await browser.close();}
