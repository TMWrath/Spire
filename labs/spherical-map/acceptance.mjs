import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const dir='/tmp/spire-sphere-evidence';await fs.mkdir(dir,{recursive:true});
const base='http://127.0.0.1:4191/';
async function ready(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>document.querySelector('#surface').dataset.zoom);assert.equal(await page.locator('.node').count(),16);return errors;}
async function state(page){return page.locator('#surface').evaluate(e=>({...e.dataset}));}
const desktop=await browser.newContext({viewport:{width:1100,height:800},recordVideo:{dir,size:{width:1100,height:800}}});
const page=await desktop.newPage();const errors=await ready(page);const start=await state(page);const box=await page.locator('#surface').boundingBox();const x=box.x+box.width*.5,y=box.y+box.height*.5;
await page.screenshot({path:dir+'/desktop-start.png'});await page.waitForTimeout(700);
await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+150,y+90,{steps:45});await page.mouse.up();await page.waitForTimeout(600);assert.notEqual((await state(page)).rotation,start.rotation);
await page.mouse.move(x,y);await page.mouse.wheel(0,-180);await page.waitForTimeout(450);assert.ok(Number((await state(page)).zoom)>1);
await page.mouse.move(x,y);await page.mouse.down({button:'middle'});await page.mouse.move(x+50,y+25,{steps:20});await page.mouse.up({button:'middle'});await page.waitForTimeout(300);assert.notEqual((await state(page)).pan,start.pan);
await page.getByRole('button',{name:'Reset view'}).click();await page.waitForTimeout(400);assert.equal((await state(page)).rotation,start.rotation);assert.equal((await state(page)).zoom,start.zoom);assert.equal((await state(page)).pan,start.pan);
await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x-90,y-45,{steps:30});await page.mouse.up({button:'right'});await page.waitForTimeout(500);assert.notEqual((await state(page)).rotation,start.rotation);
await page.locator('#surface').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert.notEqual((await state(page)).rotation,start.rotation);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
assert.deepEqual(errors,[]);const desktopVideo=page.video();await desktop.close();await desktopVideo.saveAs(dir+'/desktop.webm');
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,recordVideo:{dir,size:{width:390,height:844}}});
const phone=await mobile.newPage();const phoneErrors=await ready(phone);const cdp=await mobile.newCDPSession(phone);const b=await phone.locator('#surface').boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;const touch=(type,ps)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:ps.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5,force:1}))});
await phone.screenshot({path:dir+'/mobile-start.png'});await phone.waitForTimeout(700);const m0=await state(phone);
await touch('touchStart',[[1,cx,cy]]);for(let i=1;i<=30;i++){await touch('touchMove',[[1,cx+i*2.5,cy+i*1.6]]);await phone.waitForTimeout(16);}await touch('touchEnd',[]);await phone.waitForTimeout(500);assert.notEqual((await state(phone)).rotation,m0.rotation);
await phone.getByRole('button',{name:'Reset view'}).tap();await phone.waitForTimeout(250);
await touch('touchStart',[[1,cx-35,cy],[2,cx+35,cy]]);for(let i=1;i<=25;i++){await touch('touchMove',[[1,cx-35-i*1.5,cy],[2,cx+35+i*1.5,cy]]);await phone.waitForTimeout(16);}await phone.waitForTimeout(100);assert.ok(Number((await state(phone)).zoom)>1.8);
for(let i=1;i<=25;i++){const angle=i/25*Math.PI*.3;await touch('touchMove',[[1,cx+20-72.5*Math.cos(angle),cy+15-72.5*Math.sin(angle)],[2,cx+20+72.5*Math.cos(angle),cy+15+72.5*Math.sin(angle)]]);await phone.waitForTimeout(16);}await phone.waitForTimeout(150);assert.notEqual((await state(phone)).rotation,m0.rotation);assert.notEqual((await state(phone)).pan,m0.pan);
const before=await state(phone);await touch('touchEnd',[[1,cx+20-72.5*Math.cos(Math.PI*.3),cy+15-72.5*Math.sin(Math.PI*.3)]]);await phone.waitForTimeout(100);assert.equal((await state(phone)).rotation,before.rotation);await touch('touchMove',[[1,cx-30,cy-30]]);await touch('touchCancel',[]);await phone.waitForTimeout(300);const cancelled=await state(phone);await phone.waitForTimeout(300);assert.equal((await state(phone)).rotation,cancelled.rotation);
await phone.getByRole('button',{name:'Reset view'}).tap();await phone.waitForTimeout(450);assert.equal((await state(phone)).zoom,'1.0000');assert.equal((await state(phone)).rotation,m0.rotation);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);await phone.screenshot({path:dir+'/mobile-final.png'});assert.deepEqual(phoneErrors,[]);
await phone.emulateMedia({reducedMotion:'reduce'});await phone.waitForTimeout(100);assert.equal(await phone.getByRole('button',{name:'Resume pulses'}).count(),1);
const mobileVideo=phone.video();await mobile.close();await mobileVideo.saveAs(dir+'/mobile.webm');await browser.close();console.log('PASS: sphere geometry, desktop orbit/wheel/pan/reset/keyboard, mobile orbit/pinch/twist/pan, 2→1 transition, cancel, reduced-motion, no page errors, no mobile overflow. Evidence: '+dir);
