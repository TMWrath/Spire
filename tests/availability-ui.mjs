import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createApp} from '../server/app.ts';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-availability-ui-'));
const app=createApp(root,'http://127.0.0.1:4193',{staticDirectory:path.resolve('dist')});
const server=app.app.listen(4193,'127.0.0.1');let browser;
try{
 await new Promise(r=>server.once('listening',r));
 const response=await fetch('http://127.0.0.1:4193/api/setup',{method:'POST',headers:{Origin:'http://127.0.0.1:4193','Content-Type':'application/json'},body:JSON.stringify({username:'fixture',password:'availability-test-password',reliquary:'Test',device:'fixture'})});
 assert.ok(response.ok);const cookie=response.headers.get('set-cookie').split(';')[0].split('=')[1];
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:850}});await context.addCookies([{name:'spire_session',value:cookie,url:'http://127.0.0.1:4193'}]);
  await context.addInitScript(()=>{globalThis.spireWorkspaceWarnings=[{path:'Gone/file.md',kind:'file',message:'Unavailable file skipped. Retained metadata was not deleted.'}];});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4193');
  await page.getByLabel('Username',{exact:true}).fill('fixture');await page.getByLabel('Password',{exact:true}).fill('availability-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Dismiss workspace warning',exact:true}).click().catch(async e=>{console.error(await page.locator('body').innerText(),await page.evaluate(()=>globalThis.spireWorkspaceWarnings));throw e;});assert.equal(await page.locator('.workspace-warning').count(),0);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Activity log',exact:true}).click();await page.getByText('file: Gone/file.md',{exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Activity log',exact:true}).click();await page.getByText('file: Gone/file.md',{exact:true}).waitFor();
  assert.equal(await page.locator('.workspace-warning').count(),0,'dismissed duplicate does not recur');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no mobile page overflow');
  await context.close();console.log(`PASS: ${width}px dismissible non-modal notice and persistent Settings log`);
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
