import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-electron-'));
let app;
delete process.env.ELECTRON_RUN_AS_NODE;
try{
 app=await electron.launch({executablePath:process.env.SPIRE_TEST_EXECUTABLE,args:[...(process.platform==='linux'?['--no-sandbox']:[]),...(process.env.SPIRE_TEST_EXECUTABLE?[]:[path.resolve('desktop-dist/main.cjs')]),'--user-data-dir='+path.join(root,'profile')],env:{...process.env}});
 const launcher=await app.firstWindow();await launcher.locator('#local').waitFor();
 const folder=path.join(root,'files');fs.mkdirSync(folder);fs.mkdirSync(path.join(folder,'Writing'));fs.writeFileSync(path.join(folder,'Writing','existing.md'),'Existing file preserved');
 await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
 const opened=app.waitForEvent('window');await launcher.locator('#local').click();const workspace=await opened;
 await workspace.waitForLoadState('domcontentloaded');await workspace.waitForFunction(()=>document.body.innerText.includes('Spire'));
 assert.equal(await workspace.evaluate(()=>typeof window.require),'undefined');
 assert.equal(await workspace.evaluate(()=>typeof window.spireDesktop),'undefined');
 const origin=new URL(workspace.url()).origin;
 assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
 const result=await workspace.evaluate(async()=>{
  const setup=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',password:'isolated-test-passphrase',reliquary:'Test',device:'Desktop smoke'})});
  const auth=await setup.json();const snapshot=await (await fetch('/api/snapshot')).json();
  const file=snapshot.notes.find(n=>n.path==='Writing/existing.md');
  const saved=await fetch('/api/mutate',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf},body:JSON.stringify({op:crypto.randomUUID(),id:file.id,base:file.rev,path:file.path,content:'Edited on desktop',deleted:false})});
  return {setup:setup.status,save:saved.status};
 });assert.deepEqual(result,{setup:200,save:200});assert.equal(fs.readFileSync(path.join(folder,'Writing','existing.md'),'utf8'),'Edited on desktop');
 // Keep local host alive, connect through the server entry point: separate cookies/cache.
 await launcher.locator('#server').fill(origin);const remoteOpened=app.waitForEvent('window');await launcher.locator('#connect').click();const remote=await remoteOpened;await remote.waitForLoadState('domcontentloaded');
 assert.equal(await remote.evaluate(async()=> (await fetch('/api/me')).status),401);
 assert.equal(await workspace.evaluate(async()=> (await fetch('/api/me')).status),200);
 await remote.close();await workspace.close();
 await launcher.waitForTimeout(200);
 const reopened=app.waitForEvent('window');await launcher.locator('#local').click();const again=await reopened;await again.waitForLoadState('domcontentloaded');assert.equal(new URL(again.url()).origin,origin);
 assert.equal(await again.evaluate(async()=> (await fetch('/api/me')).status),200);
 assert.equal(fs.readFileSync(path.join(folder,'Writing','existing.md'),'utf8'),'Edited on desktop');
 await again.close();
 const backup=path.join(root,'backup.json');
 await app.evaluate(({dialog},backup)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:backup});},backup);
 await launcher.locator('#backup').click();await launcher.waitForFunction(()=>document.querySelector('#status').textContent.includes('Backup verified'));
 assert.ok(fs.existsSync(backup));
 const restored=path.join(root,'restored');fs.mkdirSync(restored);
 await app.evaluate(({dialog},{backup,restored})=>{dialog.showOpenDialog=async(_window,options)=>({canceled:false,filePaths:[options.properties.includes('openFile')?backup:restored]});},{backup,restored});
 await launcher.locator('#restore').click();await launcher.waitForFunction(()=>document.querySelector('#status').textContent.includes('Restore verified'));
 assert.equal(fs.readFileSync(path.join(restored,'Writing/existing.md'),'utf8'),'Edited on desktop');
 if(process.env.SPIRE_TEST_SERVER){
  await launcher.locator('#server').fill(process.env.SPIRE_TEST_SERVER);const liveOpened=app.waitForEvent('window');await launcher.locator('#connect').click();const live=await liveOpened;await live.waitForLoadState('domcontentloaded');
  assert.equal(await live.evaluate(async()=> (await (await fetch('/api/health')).json()).ok),true);
  assert.equal(await live.evaluate(async()=> (await fetch('/api/snapshot')).status),401);
  await live.screenshot({path:path.resolve('windows-server.png')});await live.close();console.log('PASS: live Docker HTTPS UI/health and anonymous auth boundary; no live data mutations');
 }
 await launcher.screenshot({path:path.resolve('desktop-launcher.png')});
 console.log('PASS: desktop launcher, shared UI, local edit/reopen, stable origin, renderer isolation, server connection, cookie isolation');
}finally{await app?.close();fs.rmSync(root,{recursive:true,force:true});}
