import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';

test('file cover uploads, saves its focal position, and can be removed',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('button',{name:'Add File',exact:true}).click();
 await page.getByLabel('File name',{exact:true}).fill('Cover check');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Cover fixtures');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 const cover=page.getByRole('region',{name:'File cover',exact:true});
 await cover.getByLabel('Add cover',{exact:true}).setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uoAAAAASUVORK5CYII=','base64')});
 await expect.poll(()=>cover.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
 await cover.getByRole('button',{name:'Reposition',exact:true}).click();
 await cover.getByRole('slider',{name:'Cover position'}).focus();
 await page.keyboard.press('End');
 await expect(cover.locator('img')).toHaveCSS('aspect-ratio','4 / 1');
 await cover.getByRole('button',{name:'Save position'}).click();
 await expect(cover.locator('img')).toHaveCSS('object-position','50% 100%');
 await cover.getByRole('button',{name:'Remove cover'}).click();
 await expect(cover.locator('img')).toHaveCount(0);
});
