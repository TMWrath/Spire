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
for(const width of [390,1280])test(`Media uses the same expanded Context width as Revisions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 if(width===390)await page.goto('data:text/html,<h1>Before Spire</h1>');
 await login(page);await create(page,'Expanded '+width,'Media width test');
 if(!await page.locator('.context').isVisible())await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 const context=page.locator('aside.context');
 await page.getByRole('tab',{name:'Revisions',exact:true}).click();await expect(context).toHaveClass(/context-expanded/);
 await expect.poll(async()=>Math.abs((await context.boundingBox())!.width-width)).toBeLessThan(2);
 const revisions=await context.boundingBox();
 await page.getByRole('tab',{name:'Media',exact:true}).click();await expect(context).toHaveClass(/context-expanded/);
 const media=await context.boundingBox();expect(media).not.toBeNull();expect(Math.abs(media!.width-revisions!.width)).toBeLessThan(2);expect(Math.abs(media!.x-revisions!.x)).toBeLessThan(2);
 await expect(page.getByRole('tabpanel',{name:'File media',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Details',exact:true}).click();await expect(context).not.toHaveClass(/context-expanded/);
 if(width===390){
  const url=page.url();await page.goBack();await expect(context).not.toBeVisible();expect(page.url()).toBe(url);
  await page.getByRole('button',{name:'Toggle context',exact:true}).click();await expect(context).toBeVisible();
  await page.goBack();await expect(context).not.toBeVisible();expect(page.url()).toBe(url);
  await page.getByRole('button',{name:'Toggle folders'}).click();await expect(page.locator('.sidebar')).toBeVisible();
  await page.goBack();await expect(page.locator('.sidebar')).not.toBeVisible();expect(page.url()).toBe(url);
  for(const name of ['Text style','Heading','List','Alignment','Capitalization','Media','Date & time','Blocks']){
   const trigger=page.getByRole('button',{name,exact:true});await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');
   await page.goBack();await expect(trigger).toHaveAttribute('aria-expanded','false');await expect(page.getByLabel('Markdown source')).toBeVisible();
  }
  await page.goBack();await expect(page.getByLabel('Markdown source')).not.toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/^data:text\/html/);await expect(page.getByRole('heading',{name:'Before Spire'})).toBeVisible();
 }
});
