import {test,expect,type Page} from '@playwright/test';

async function createFile(page:Page,name:string,folder:string,content:string){
 if(!await page.locator('.sidebar').isVisible()){await page.getByRole('button',{name:'Toggle folders'}).click();await expect(page.locator('.sidebar')).toBeVisible();}
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New file'}).click();
 await page.getByLabel('File name',{exact:true}).fill(name);const select=page.getByLabel('Save in folder');
 if(await select.locator(`option[value="${folder}"]`).count())await select.selectOption(folder);else{await select.selectOption('__new__');await page.getByLabel('New folder path').fill(folder);}
 await page.getByRole('button',{name:'Create file',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source').fill(content);await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Synchronized');
}
async function setup(page:Page){
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('dictionary');await page.getByLabel('Password',{exact:true}).fill('disposable-dictionary-password');
 const create=page.getByRole('button',{name:'Create Reliquary',exact:true});if(await create.count()){await create.click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();await createFile(page,'Astronomy','Reference','---\nspire_type: dictionary\n---\n# Astronomy\n\n## Aphelion\nThe point in an orbit farthest from the Sun.\n\n## Perihelion\nThe closest orbital point.');await createFile(page,'Chapter','Writing','The ship reached its farthest point.');}else{await page.getByRole('button',{name:'Sign in',exact:true}).click();if(!await page.locator('.sidebar').isVisible()){await page.getByRole('button',{name:'Toggle folders'}).click();await expect(page.locator('.sidebar')).toBeVisible();}await page.getByRole('button',{name:'Chapter',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();}
 const source=page.getByLabel('Markdown source');
 if(!await source.inputValue().then(value=>value.includes('](../Reference/Astronomy.md#aphelion)'))){await source.evaluate((el:HTMLTextAreaElement)=>{const start=el.value.indexOf('its farthest point');el.focus();el.setSelectionRange(start,start+'its farthest point'.length);});
 await page.getByRole('button',{name:'Link to term',exact:true}).click();await expect(page.getByRole('dialog',{name:'Link to dictionary term'})).toBeVisible();await expect(page.getByLabel('Linked text')).toHaveValue('its farthest point');await page.getByLabel('Dictionary term',{exact:true}).selectOption('aphelion');await page.getByRole('button',{name:'Insert term link'}).click();
 await expect(source).toHaveValue('The ship reached [its farthest point](../Reference/Astronomy.md#aphelion).');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Synchronized');}
 await page.getByRole('button',{name:'Split',exact:true}).click();return page.locator('.preview a.dictionary-term-link');
}

test('desktop links selected text and previews a dictionary definition on hover and focus',async({page})=>{
 const link=await setup(page);await link.hover();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toContainText('farthest from the Sun');await expect(preview.getByRole('button',{name:'Open definition'})).toBeVisible();await link.focus();await expect(preview).toBeVisible();
});

test.describe('touch device',()=>{test.use({hasTouch:true});test('mobile tap opens the definition preview and can navigate to its term',async({page})=>{
 await page.setViewportSize({width:390,height:844});const link=await setup(page);await link.tap();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toBeVisible();await preview.getByRole('button',{name:'Open definition'}).tap();await expect(page.getByLabel('File path')).toHaveValue('Reference/Astronomy.md');
});});
