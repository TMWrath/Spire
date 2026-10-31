import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve('app/src/main/assets/web');
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'";
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const f=path.join(root,name==='/'?'index.html':name);if(!f.startsWith(root+'/'))throw Error();res.setHeader('Content-Security-Policy',csp);res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
let releaseLoad;let waitLoad=new Promise(resolve=>releaseLoad=resolve);
let disk={files:{'Writing/existing.md':Buffer.from('Initial writing').toString('base64')},dirs:['Writing']};let failed=false;const errors=[];let saves=0;
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.exposeBinding('__native',async(source,message)=>{const m=JSON.parse(message);try{let value;if(m.op==='load'||m.op==='browse'){await waitLoad;if(failed)throw Error('Permission revoked');value=structuredClone(disk);}else if(m.op==='list'){if(failed)throw Error('Permission revoked');value={files:Object.fromEntries(Object.entries(disk.files).filter(([p])=>p.slice(0,p.lastIndexOf('/'))===m.path)),dirs:disk.dirs.filter(p=>p.slice(0,p.lastIndexOf('/'))===m.path&&p!==m.path)};}else if(m.op==='text'){if(failed)throw Error('Permission revoked');assert.equal(typeof disk.files[m.path],'string');value=disk.files[m.path];}else{if(failed)throw Error('Permission revoked');for(const p of new Set([...Object.keys(m.before.files),...Object.keys(m.after.files)])){assert.equal(m.before.files[p],disk.files[p],'native affected-source check: '+p);assert.notDeepEqual(m.before.files[p],m.after.files[p],'unchanged files must not cross the bridge');}const files={...disk.files};for(const p of Object.keys(m.before.files))delete files[p];Object.assign(files,m.after.files);const dirs=new Set(disk.dirs);for(const p of m.before.dirs)if(!m.after.dirs.includes(p))dirs.delete(p);for(const p of m.after.dirs)dirs.add(p);disk={files,dirs:[...dirs]};saves++;value=true;}return {id:m.id,value};}catch(error){return {id:m.id,error:error.message};}});
 await context.addInitScript(()=>{window.SpireFolder={postMessage:raw=>window.__native(raw).then(value=>window.SpireFolder.onmessage({data:JSON.stringify(value)}))};window.SpireApp={postMessage:action=>{if(action==='info')queueMicrotask(()=>window.SpireApp.onmessage?.({data:JSON.stringify({version:'0.2.0',server:location.origin})}));}};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await expect(page.getByRole('status').filter({hasText:'Opening local folder'})).toBeVisible();
 releaseLoad();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible().catch(async e=>{console.log(await page.locator('body').innerText(),errors);throw e;});
 async function open(){await expect(page.locator('.network')).toHaveText('Local folder · manual save');if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();await expect(page.locator('.sidebar')).toBeVisible();const folder=page.locator('details[data-folder="Writing"]');await expect(folder).not.toHaveAttribute('open','');await folder.locator(':scope > summary').click();await page.locator('nav [data-item-name="Writing/existing.md"]').click();}
 await open();await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Initial writing');
 await page.getByRole('button',{name:'Toggle context',exact:true}).click();await page.getByRole('tab',{name:'Writing',exact:true}).click();await expect(page.getByLabel('Autosave this file')).toBeDisabled();await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 await page.getByLabel('Markdown source',{exact:true}).fill('# Real local file\n\nUnicode 🌞');await page.waitForTimeout(2400);assert.equal(Buffer.from(disk.files['Writing/existing.md'],'base64').toString(),'Initial writing','typing never autosaves');await page.getByRole('button',{name:'Save file',exact:true}).click();
 await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toBe('# Real local file\n\nUnicode 🌞');
 await page.reload();await open();await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('# Real local file\n\nUnicode 🌞');
 await page.getByRole('button',{name:'Editor',exact:true}).click();await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('dialog',{name:'Help',exact:true}).locator('li')).toHaveCount(14);await page.keyboard.press('Escape');
 const editor=page.getByRole('textbox',{name:'Document editor',exact:true});await editor.fill('');await editor.pressSequentially('@bld portable');await expect(editor.locator('strong')).toHaveText('portable');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toContain('**portable**');
 await editor.fill('three spaces   ');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect.poll(()=>/three spaces\*\* {3}\n\n$/.test(Buffer.from(disk.files['Writing/existing.md'],'base64').toString())).toBe(true);await page.reload();await open();await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('three spaces');await page.getByRole('button',{name:'Source',exact:true}).click();await expect.poll(async()=>/three spaces\*\* {3}\n\n$/.test(await page.getByLabel('Markdown source',{exact:true}).inputValue())).toBe(true);await page.getByRole('button',{name:'Editor',exact:true}).click();
 // Blank lines must survive visual editing, native save, reload, and a second edit.
 const spaced='\n\none\n\n\ntwo\n\n\n';
 await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source',{exact:true}).fill(spaced);await page.getByRole('button',{name:'Editor',exact:true}).click();
 await editor.locator('p').filter({hasText:/^one$/}).click();await page.keyboard.press('End');await page.keyboard.type('!');await page.getByRole('button',{name:'Save file',exact:true}).click();
 await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toBe(spaced.replace('one','one!'));
 await page.reload();await open();await page.getByRole('button',{name:'Editor',exact:true}).click();await editor.locator('p').filter({hasText:/^two$/}).click();await page.keyboard.press('End');await page.keyboard.type('!');await page.getByRole('button',{name:'Save file',exact:true}).click();
 await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toBe(spaced.replace('one','one!').replace('two','two!'));
 // Exercise the actual bundled Local image upload path, including picker focus loss.
 for(const [code,alignment] of [['img',''],['imgl','left'],['imgc','center'],['imgr','right']]){
  await editor.click();await editor.press('ControlOrMeta+A');await editor.press('Backspace');await editor.pressSequentially('@'+code);
  const picker=page.waitForEvent('filechooser');await editor.pressSequentially(' ');const chooser=await picker;await editor.evaluate(e=>e.blur());
  await chooser.setFiles({name:'local 雪.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await expect(editor.locator('img')).toHaveCount(1);if(alignment)await expect(editor.locator('div[align]')).toHaveAttribute('align',alignment);
  await page.getByRole('button',{name:'Save file',exact:true}).click();await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toContain('Attachments/');
 }
 await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source',{exact:true}).fill('**portable**');await page.getByRole('button',{name:'Editor',exact:true}).click();
 await page.getByRole('button',{name:'Split',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toBeVisible();await expect(page.locator('.preview')).toBeVisible();
 const beforeRotation=await page.getByLabel('Markdown source',{exact:true}).inputValue();assert.match(beforeRotation,/\*\*portable\*\*/);await page.setViewportSize({width:844,height:390});await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(beforeRotation);
 // Exercise every real conflict button, including stale historical conflict metadata.
 for(const action of ['Keep mine','Keep Server','Keep both','Merge']){
  await page.evaluate(async()=>{
   const snapshot=await (await fetch('/api/snapshot')).json();let n=snapshot.notes.find(n=>n.path==='Writing/existing.md');
   const post=(body)=>fetch('/api/mutate',{method:'POST',body:JSON.stringify(body)});
   // Each scenario needs two actual changes from its shared ancestor. The prior
   // Keep mine result equals 'device variant', which is correctly not a conflict.
   const seeded=await post({id:n.id,base:n.rev,path:n.path,deleted:false,op:crypto.randomUUID(),content:'shared ancestor'});
   if(!seeded.ok)throw Error(await seeded.text());n=await seeded.json();
   const m={id:n.id,base:n.rev,path:n.path,deleted:false};
   let r=await post({...m,op:crypto.randomUUID(),content:'canonical'});if(!r.ok)throw Error(await r.text());
   r=await post({...m,op:crypto.randomUUID(),content:'device variant'});if(r.status!==409)throw Error('expected conflict; base='+JSON.stringify(n)+'; status='+r.status+'; response='+await r.text());

  });
  await page.reload();await open();await page.getByRole('button',{name:'Toggle context',exact:true}).click();await page.getByRole('tab',{name:/^Conflicts/}).click();
  const panel=page.getByRole('tabpanel',{name:'Resolve conflicts'});await expect(panel.locator('.conflict')).toHaveCount(1);
  await panel.getByRole('button',{name:action,exact:true}).click();
  if(action==='Merge'){
   await panel.getByLabel('Merged file').fill('merged result');
   await panel.getByRole('button',{name:'Save merged file',exact:true}).click();
  }
  await expect(panel.locator('.conflict')).toHaveCount(0);
  await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toBe(action==='Keep mine'?'device variant':action==='Merge'?'merged result':'canonical');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(action==='Keep mine'?'device variant':action==='Merge'?'merged result':'canonical');
  await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 }
 await page.getByRole('button',{name:'Source',exact:true}).click();
 // Network disabled: requests still pass through the native folder adapter, not HTTP.
 await context.setOffline(true);await page.getByLabel('Markdown source',{exact:true}).fill('Offline writing');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect.poll(()=>Buffer.from(disk.files['Writing/existing.md'],'base64').toString()).toBe('Offline writing');await context.setOffline(false);
 await page.evaluate(()=>{window.__folderActions=[];window.SpireApp={postMessage:action=>window.__folderActions.push(action)};});
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('tab',{name:'Storage',exact:true}).click();
 await expect(page.getByLabel('New Reliquary directory name')).toHaveCount(0);
 await expect(page.getByText('Moves files within this same Docker data volume',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Back to writing',exact:true}).click();
 failed=true;await page.getByLabel('Markdown source',{exact:true}).fill('Retained draft');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Operation was not confirmed. Keep your editor text.');assert.equal(Buffer.from(disk.files['Writing/existing.md'],'base64').toString(),'Offline writing');
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Retained draft');
 failed=false;await page.reload();await open();assert.equal(Buffer.from(disk.files['Writing/existing.md'],'base64').toString(),'Offline writing','failed save is never replayed automatically');
 failed=true;await page.reload();await expect(page.getByRole('heading',{name:'Local folder unavailable'})).toBeVisible();await expect(page.getByRole('button',{name:'Workspaces',exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);assert.ok(saves>3);
 console.log('PASS bundled mobile editor: real bridge protocol, source/visual/split, 10 quick-format hints, formatting, save/reopen, rotation viewport, offline saving, manual save without background replay and unavailable-folder recovery. Chromium, not Android WebView.');
}finally{await browser.close();server.close();}
