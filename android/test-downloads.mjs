import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const script = await readFile(new URL('./app/src/main/assets/downloads.js',import.meta.url),'utf8');
const browser = await chromium.launch({headless:true});
let passed=0;
try {
 const page=await browser.newPage();
 await page.goto('about:blank');
 await page.evaluate(()=>{window.messages=[];window.SpireDownloads={postMessage:value=>window.messages.push(JSON.parse(value))};});
 await page.evaluate(script);
 // Installation must remain idempotent through repeat onPageFinished callbacks.
 await page.evaluate(script);
 await page.evaluate(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['{"files":[]}'],{type:'application/json'}));a.download='spire-backup.json';a.click();});
 await page.waitForFunction(()=>window.messages.length===1);
 let results=await page.evaluate(()=>window.messages);
 assert.equal(results[0].name,'spire-backup.json');assert.equal(results[0].mime,'application/json');assert.equal(Buffer.from(results[0].data,'base64').toString(),'{"files":[]}');passed++;
 await page.evaluate(()=>{const a=document.createElement('a');a.textContent='Export';a.id='download';a.href=URL.createObjectURL(new Blob(['hello 🌞'],{type:'text/plain'}));a.download='writing.txt';document.body.append(a);});
 await page.click('#download');await page.waitForFunction(()=>window.messages.length===2);
 results=await page.evaluate(()=>window.messages);assert.equal(results[1].name,'writing.txt');assert.equal(Buffer.from(results[1].data,'base64').toString(),'hello 🌞');passed++;
 await page.evaluate(()=>window.__spireExport(URL.createObjectURL(new Blob([new Uint8Array(33554433)])),'huge.bin'));
 results=await page.evaluate(()=>window.messages);assert.deepEqual(results[2],{error:true});passed++;
 await page.evaluate(()=>window.__spireExport('blob:null/missing','missing'));
 results=await page.evaluate(()=>window.messages);assert.deepEqual(results[3],{error:true});passed++;
 // Non-blob links must retain normal browser click behavior.
 await page.evaluate(()=>{const a=document.createElement('a');a.href='#normal';document.body.append(a);a.click();});
 assert.equal(await page.evaluate(()=>location.hash),'#normal');assert.equal((await page.evaluate(()=>window.messages)).length,4);passed++;
 const isolated=await browser.newPage();await isolated.goto('about:blank');await isolated.evaluate(script);
 assert.equal(await isolated.evaluate(()=>window.__spireDownloadInstalled),undefined);passed++;
 console.log(`${passed}/6 Android download-adapter browser checks passed (Chromium, not Android WebView).`);
} finally {await browser.close();}
