import {test,expect} from './fixtures';

test('file cover uploads, saves its focal position, and can be removed',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('button',{name:'Add File',exact:true}).click();
 const rename=page.getByRole('button',{name:'Save name',exact:true});
 await page.getByRole('textbox',{name:'New name'}).fill('Cover check');
 await rename.click();
 await page.getByRole('button',{name:'Cover check',exact:true}).click({position:{x:8,y:14}});
 if(!await page.getByRole('tab',{name:'Details',exact:true}).isVisible())await page.getByRole('button',{name:'Toggle context'}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
 const settings=page.getByRole('region',{name:'Cover settings'});
 const cover=page.getByRole('region',{name:'File cover',exact:true});
 await settings.getByLabel('Add cover',{exact:true}).setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uoAAAAASUVORK5CYII=','base64')});
 await expect.poll(()=>cover.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
 await settings.getByRole('button',{name:'Reposition',exact:true}).click();
 await settings.getByRole('slider',{name:'Cover position'}).focus();
 await page.keyboard.press('End');
 await expect(cover.locator('img')).toHaveCSS('aspect-ratio','4 / 1');
 await expect(cover.getByRole('button')).toHaveCount(0);
 for(const width of [320,673,1440]){await page.setViewportSize({width,height:844});await expect(settings).toBeVisible(); expect(await settings.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 await settings.getByRole('button',{name:'Save position'}).click();
 await expect(cover.locator('img')).toHaveCSS('object-position','50% 100%');
 await settings.getByRole('button',{name:'Remove cover'}).click();
 await expect(cover.locator('img')).toHaveCount(0);
});
