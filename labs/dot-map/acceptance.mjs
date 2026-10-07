import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {layout,identity,project} from './core.mjs';
import {files,edges} from './demo.mjs';
const positions=layout(files,edges);
const base=process.env.DOT_MAP_URL||'http://127.0.0.1:4192';
const output='/tmp/spire-dot-map-evidence';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});let checks=0;
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1360,height:900},isMobile:mobile,hasTouch:mobile,recordVideo:{dir:output,size:mobile?{width:412,height:915}:{width:1360,height:900}}});
  const page=await context.newPage(),errors=[],foreign=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))foreign.push(r.url());});
  await page.goto(base);const canvas=page.locator('#map');await page.waitForTimeout(150);
  assert.equal(await canvas.getAttribute('data-nodes'),'28','new renderer must initialize 28 spherical dot nodes');checks++;
  const state=()=>canvas.getAttribute('data-camera');const initial=await state(),box=await canvas.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
  await canvas.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await state(),initial);checks++;
  await page.getByRole('button',{name:'Reset view',exact:true}).click();assert.equal(await state(),initial);checks++;
  if(!mobile){
   await page.mouse.move(cx-80,cy-60);await page.mouse.down();await page.mouse.move(cx+130,cy+70,{steps:22});await page.mouse.up();assert.notEqual(await state(),initial);checks++;
   const pre=JSON.parse(await state());await page.mouse.move(cx+50,cy-20);await page.mouse.wheel(0,-180);await page.waitForTimeout(100);assert.ok(JSON.parse(await state()).zoom>pre.zoom);checks++;
   const before=JSON.parse(await state());await page.keyboard.down('Shift');await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+45,cy+35,{steps:10});await page.mouse.up();await page.keyboard.up('Shift');const after=JSON.parse(await state());assert.deepEqual(after.axes,before.axes);assert.ok(after.x>before.x+40);checks++;
  }else{
   const cdp=await context.newCDPSession(page);const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({x,y,id:i+1,radiusX:4,radiusY:4}))});
   await send('touchStart',[[cx-40,cy]]);for(let i=1;i<=12;i++){await send('touchMove',[[cx-40+i*9,cy+i*4]]);await page.waitForTimeout(25);}await send('touchEnd',[]);assert.notEqual(await state(),initial);checks++;
   const before=JSON.parse(await state());await send('touchStart',[[cx-35,cy],[cx+35,cy]]);for(let i=1;i<=16;i++){const a=i*.045,d=35+i*2.7;await send('touchMove',[[cx+Math.sin(a)*d+15*i/16,cy-Math.cos(a)*d],[cx-Math.sin(a)*d+15*i/16,cy+Math.cos(a)*d]]);await page.waitForTimeout(25);}const after=JSON.parse(await state());assert.ok(after.zoom>before.zoom*1.7);assert.notDeepEqual(after.axes,before.axes);checks++;
   await send('touchEnd',[[cx,cy+75]]);const transition=await state();await send('touchMove',[[cx,cy+75]]);assert.equal(await state(),transition,'two-to-one pointer transition must not jump');checks++;
   await send('touchCancel',[]);const canceled=await state();await page.waitForTimeout(100);assert.equal(await state(),canceled);checks++;
  }
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(50);
  const front=files.map(f=>({file:f,...project(positions.get(f.id),identity(),Math.min(box.width,box.height)*.37)})).sort((a,b)=>b.depth-a.depth)[0];
  if(mobile)await page.touchscreen.tap(cx+front.x,cy+front.y);else await page.mouse.click(cx+front.x,cy+front.y);
  await page.locator('#detail').waitFor({state:'visible'});assert.equal(await page.locator('#file-title').textContent(),front.file.name);checks++;await page.getByRole('button',{name:'Clear selection'}).click();
  await page.locator('#file-picker').selectOption('file-0');await page.locator('#detail').waitFor({state:'visible'});assert.equal(await page.locator('#file-title').textContent(),'The Observatory');checks++;
  await page.getByRole('button',{name:'Clear selection'}).click();await page.getByRole('textbox',{name:'Find a file'}).fill('impossible-match');assert.equal(await canvas.getAttribute('data-matches'),'0');await page.getByRole('textbox',{name:'Find a file'}).fill('');checks++;
  const pixels=()=>canvas.evaluate(c=>c.toDataURL());
  await page.getByRole('button',{name:'Pause animation',exact:true}).click();await page.waitForTimeout(80);const frozen=await pixels();await page.waitForTimeout(150);assert.equal(await pixels(),frozen);checks++;
  await page.getByRole('button',{name:'Resume animation',exact:true}).click();await page.waitForTimeout(80);const moving=await pixels();await page.waitForTimeout(180);assert.notEqual(await pixels(),moving);checks++;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);checks++;
  await page.screenshot({path:`${output}/${mobile?'mobile':'desktop'}.png`});
  const video=page.video();await context.close();await video.saveAs(`${output}/${mobile?'mobile':'desktop'}.webm`);
 }
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();await page.goto(base);assert.equal(await page.locator('#map').getAttribute('data-motion'),'static');checks++;await context.close();
 console.log(JSON.stringify({passed:checks,evidence:output},null,2));
}finally{await browser.close();}
