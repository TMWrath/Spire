import {test,expect} from './fixtures';
import {readFileSync} from 'node:fs';
import {selectDropdown} from './dropdown';
import type {Page} from './fixtures';
async function login(page:Page){await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('file-media');await page.getByLabel('Password',{exact:true}).fill('disposable-media-password');await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();}
async function create(page:Page,name:string,content:string){
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Create from file'});await dialog.getByRole('button',{name:/New file/}).click();await dialog.getByRole('button',{name:/New blank file/}).click();await page.getByLabel('File name',{exact:true}).fill(name);
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Media '+name);await page.getByRole('button',{name:'Create file',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source').fill(content);await page.getByRole('button',{name:'Save file',exact:true}).click();
}
test('file Media tab groups real references, deduplicates, previews, and follows the selected file',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await login(page);
 const me=await (await page.request.get('/api/me')).json();const headers={Origin:new URL(page.url()).origin,'X-CSRF-Token':me.csrf,'Content-Type':'application/octet-stream'};
 for(const [name,fixture] of [['one.png','image.png'],['2.png','image.png'],['3.png','image.png'],['4.png','image.png'],['5.png','image.png'],['movie.webm','clip.webm'],['song.mp3','tone.mp3']]){const result=await page.request.post('/api/attachments?path='+encodeURIComponent('Attachments/'+name),{headers,data:readFileSync('tests/fixtures/media/'+fixture)});expect(result.ok()).toBeTruthy();}
 await page.reload();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await create(page,'Collection','![One](../Attachments/one.png)\n![Duplicate](../Attachments/one.png)\n'+Array.from({length:4},(_,i)=>`![Image ${i+2}](../Attachments/${i+2}.png)`).join('\n')+'\n<video controls src="../Attachments/movie.webm"></video>\n<audio controls><source src="../Attachments/song.mp3" type="audio/wav"></audio>\n\n```md\n![Not media](https://media.example/code.png)\n```');
 const originalSource=await page.getByLabel('Markdown source').inputValue();
 await page.getByRole('button',{name:'Editor',exact:true}).click();
 const video=page.locator('.document-writing-surface .spire-video');await expect(video).toHaveCount(1);await expect(video.locator('video')).not.toHaveAttribute('controls','');await expect(video.getByRole('slider',{name:'Seek video'})).toBeVisible();
 const inline=page.locator('.document-writing-surface .media-audio-row');await expect(inline).toHaveCount(1);
 await expect(inline.locator('audio')).not.toHaveAttribute('controls','');
 await expect.poll(()=>inline.locator('audio').evaluate((el:HTMLAudioElement)=>el.duration)).toBeGreaterThan(1);
 await inline.getByRole('button',{name:'Play song.mp3',exact:true}).click();await expect(inline.getByRole('button',{name:'Pause song.mp3',exact:true})).toBeVisible();await inline.getByRole('button',{name:'Pause song.mp3',exact:true}).click();
 expect(await inline.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source')).toHaveValue(originalSource);
 if(!await page.locator('.context').isVisible())await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 await page.getByRole('tab',{name:'Media',exact:true}).click();const panel=page.getByRole('tabpanel',{name:'File media',exact:true});await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:'Images (5)',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Videos (1)',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Audio (1)',exact:true})).toBeVisible();
 await expect(panel.locator('audio')).not.toHaveAttribute('controls','');
 const row=panel.locator('.media-audio-row');
 expect(await row.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
 expect(await row.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
 await panel.getByLabel('More options for song.mp3').click();
 await expect(panel.getByRole('link',{name:'Open original'})).toBeVisible();
 await panel.getByLabel('More options for song.mp3').click();
 await expect.poll(()=>panel.locator('audio').evaluate((el:HTMLAudioElement)=>el.duration)).toBeGreaterThan(1);await panel.getByRole('button',{name:'Play song.mp3',exact:true}).click();await expect(panel.getByRole('button',{name:'Pause song.mp3',exact:true})).toBeVisible();await panel.getByRole('button',{name:'Pause song.mp3',exact:true}).click();await expect(panel.locator('audio')).toHaveAttribute('src','/api/attachment?path=Attachments%2Fsong.mp3');
 await panel.getByRole('button',{name:'Show 1 more images',exact:true}).click();await expect(panel.getByRole('button',{name:'Preview Image 5',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Preview One',exact:true}).click();const preview=page.getByRole('dialog',{name:'Media preview'});await expect(preview.getByRole('img',{name:'One',exact:true})).toBeVisible();await preview.getByRole('button',{name:'Close media preview'}).click();
 await panel.getByRole('button',{name:'Preview movie.webm',exact:true}).click();const videoPreview=page.getByRole('dialog',{name:'Media preview'});await expect(videoPreview.locator('.spire-video')).toHaveCount(1);await expect(videoPreview.getByRole('slider',{name:'Seek video'})).toBeVisible();await videoPreview.getByRole('button',{name:'Close media preview'}).click();
 await page.screenshot({path:'artifacts/file-media-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Toggle context',exact:true}).click();await create(page,'Empty','No media in this file.');if(!await page.locator('.context').isVisible())await page.getByRole('button',{name:'Toggle context',exact:true}).click();await page.getByRole('tab',{name:'Media',exact:true}).click();await expect(page.getByRole('tabpanel',{name:'File media'})).toContainText('No media used in this file');
});
