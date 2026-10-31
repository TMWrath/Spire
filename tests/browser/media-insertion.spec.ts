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
test('Image and Video open device pickers and insert uploaded media; video capture has Save video',async({page})=>{
 await login(page);await create(page,'Insertions','Media insertions');
 for(const [kind,fixture,mime] of [['Image','image.png','image/png'],['Video','clip.webm','video/webm']]){
  const trigger=page.getByRole('button',{name:'Media',exact:true});if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
  const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:kind,exact:true}).click();const chooser=await picker;
  expect(await chooser.element().getAttribute('accept')).toBe(kind==='Image'?'image/*':'video/*');
  const upload=page.waitForResponse(r=>r.url().includes('/api/attachments?')&&r.request().method()==='POST');
  await chooser.setFiles({name:fixture,mimeType:mime,buffer:readFileSync('tests/fixtures/media/'+fixture)});expect((await upload).ok()).toBeTruthy();
  await expect.poll(()=>page.getByLabel('Markdown source').inputValue()).toContain(kind==='Image'?'![image.png]':'<video controls src=');
 }
 await page.getByRole('button',{name:'Video capture',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Video capture',exact:true});await dialog.getByLabel('Local video',{exact:true}).setInputFiles('tests/fixtures/media/clip.webm');
 await expect(dialog.getByRole('button',{name:'Save video',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'Save video',exact:true}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Save file',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open Insertions',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source')).toHaveValue(/<video controls/);
});
