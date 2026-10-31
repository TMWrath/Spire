import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {files,edges} from './demo.mjs';
import {layout,identity,project} from './core.mjs';
const dir='/tmp/spire-dot-map-evidence';await mkdir(dir,{recursive:true});const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,recordVideo:{dir,size:{width:412,height:915}}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4192/');await page.waitForTimeout(1200);
 const b=await page.locator('#map').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,cdp=await context.newCDPSession(page);
 const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({x,y,id:i+1,radiusX:4,radiusY:4}))});
 await send('touchStart',[[x-75,y-30]]);for(let i=1;i<=50;i++){await send('touchMove',[[x-75+i*3,y-30+Math.sin(i/50*Math.PI)*60]]);await page.waitForTimeout(50);}await send('touchEnd',[]);await page.waitForTimeout(450);
 await send('touchStart',[[x-35,y],[x+35,y]]);for(let i=1;i<=55;i++){const a=i/55*.7,d=35+i/55*43,cx=x+i/55*15;await send('touchMove',[[cx-Math.cos(a)*d,y-Math.sin(a)*d],[cx+Math.cos(a)*d,y+Math.sin(a)*d]]);await page.waitForTimeout(50);}await send('touchEnd',[]);await page.waitForTimeout(600);
 await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(600);const positions=layout(files,edges),front=files.map(file=>({file,...project(positions.get(file.id),identity(),Math.min(b.width,b.height)*.37)})).sort((a,b)=>b.depth-a.depth)[0];await page.touchscreen.tap(x+front.x,y+front.y);await page.locator('#detail').waitFor({state:'visible'});await page.waitForTimeout(2200);await page.getByRole('button',{name:'Clear selection'}).click();await page.waitForTimeout(900);
 assert.deepEqual(errors,[]);await page.screenshot({path:`${dir}/preview-mobile.png`});const video=page.video();await context.close();await video.saveAs(`${dir}/dot-map-mobile-demo.webm`);console.log(`${dir}/dot-map-mobile-demo.webm`);
}finally{await browser.close();}
