import {test,expect} from './fixtures';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
for(const rich of [true,false])test(`toolbar Media Video Save video persists in ${rich?'Editor':'Source'}`,async({page},info)=>{
 await page.context().setExtraHTTPHeaders({'X-Spire-Test':info.testId,Origin:'http://127.0.0.1:4179'});const request=page.request;
 await page.setViewportSize({width:390,height:844});
 const setup=await request.post('/api/setup',{data:{reliquary:'Video test',username:'video-tester',password:'disposable-video-password'}});expect(setup.ok(),await setup.text()).toBeTruthy();
 const identity=await(await request.get('/api/me')).json();
 const created=await request.post('/api/mutate',{headers:{'X-CSRF-Token':identity.csrf},data:{id:randomUUID(),op:randomUUID(),base:0,path:'Writing/Toolbar-video.md',content:'BEFORE AFTER',deleted:false}});expect(created.ok()).toBeTruthy();
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('video-tester');await page.getByLabel('Password',{exact:true}).fill('disposable-video-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const toggle=page.getByRole('button',{name:'Toggle folders',exact:true});await expect(toggle).toBeVisible();if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 const folder=page.locator('.sidebar').getByText('Writing',{exact:true});await folder.click();await page.locator('.sidebar').getByText('Toolbar-video',{exact:true}).click();if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
 await expect(async()=>{if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');}).toPass();if(!rich)await page.getByRole('button',{name:'Source',exact:true}).click();
 await page.getByRole('button',{name:'Media',exact:true}).click();await page.getByRole('button',{name:'Video capture',exact:true}).click();
 await page.getByLabel('Local video',{exact:true}).setInputFiles(path.resolve('tests/fixtures/video-full.mp4'));await expect(page.getByRole('button',{name:'Save video',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Save video',exact:true}).click();await expect(page.getByRole('dialog',{name:'Video capture'})).toHaveCount(0);
 const snapshot=await(await request.get('/api/snapshot')).json();expect(snapshot.notes[0].content).toContain('<video controls');expect(snapshot.sources).toHaveLength(1);expect(snapshot.attachments).toHaveLength(1);const saved=await request.get('/api/attachment?path='+encodeURIComponent(snapshot.attachments[0].path));expect((await saved.body()).equals(readFileSync('tests/fixtures/video-full.mp4'))).toBe(true);
 if(!rich)await page.getByRole('button',{name:'Editor',exact:true}).click();
 {const video=page.locator('.ProseMirror video');await expect(video).toBeVisible();await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.duration)).toBeCloseTo(12,1);await video.evaluate(async(v:HTMLVideoElement)=>{v.muted=true;v.currentTime=10;await v.play();});await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:10000}).toBeGreaterThan(11.5);await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.ended),{timeout:10000}).toBe(true);await page.getByRole('button',{name:'Source',exact:true}).click();}
 await expect(page.getByLabel('Markdown source')).toHaveValue(/<video controls/);
});
