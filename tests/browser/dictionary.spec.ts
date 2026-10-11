import {test,expect,type Page} from '@playwright/test';

async function createFile(page:Page,name:string,folder:string,content:string){
 if(!await page.locator('.sidebar').isVisible()){await page.getByRole('button',{name:'Toggle folders'}).click();await expect(page.locator('.sidebar')).toBeVisible();}
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New file'}).click();
 await page.getByLabel('File name',{exact:true}).fill(name);const select=page.getByLabel('Save in folder');await select.click();
 const folderOption=page.getByRole('option',{name:folder,exact:true});if(await folderOption.count())await folderOption.click();else{await page.getByRole('option',{name:'Create new folder…',exact:true}).click();await page.getByLabel('New folder path').fill(folder);}
 await page.getByRole('button',{name:'Create file',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source').fill(content);await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Synchronized');
}
async function setup(page:Page){
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('dictionary');await page.getByLabel('Password',{exact:true}).fill('disposable-dictionary-password');
 const create=page.getByRole('button',{name:'Create Reliquary',exact:true});if(await create.count()){await create.click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();await createFile(page,'Astronomy','Reference','---\nspire_type: dictionary\n---\n# Astronomy\n\n## Aphelion\nThe point in an orbit farthest from the Sun.\n\n## Perihelion\nThe closest orbital point.');await createFile(page,'Chapter','Writing','The ship reached its farthest point.');}else{await page.getByRole('button',{name:'Sign in',exact:true}).click();if(!await page.locator('.sidebar').isVisible()){await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));await expect(page.locator('.sidebar')).toBeVisible();}await page.getByRole('button',{name:'Chapter',exact:true}).click();if(await page.locator('.sidebar').isVisible())await page.locator('.sidebar').evaluate(element=>element.setAttribute('hidden',''));await page.getByRole('button',{name:'Source',exact:true}).click();}
 const source=page.getByLabel('Markdown source');
 if(!await source.inputValue().then(value=>value.includes('](../Dictionary/Astronomy.md#aphelion)'))){await source.evaluate((el:HTMLTextAreaElement)=>{const start=el.value.indexOf('its farthest point');el.focus();el.setSelectionRange(start,start+'its farthest point'.length);});
 await page.getByRole('button',{name:'Define term',exact:true}).click();await expect(page.getByRole('dialog',{name:'Link to dictionary term'})).toBeVisible();await expect(page.getByLabel('Linked text')).toHaveValue('its farthest point');await page.getByLabel('Dictionary term',{exact:true}).selectOption('aphelion');await page.getByRole('button',{name:'Insert term link'}).click();
 await expect(source).toHaveValue('The ship reached [its farthest point](../Dictionary/Astronomy.md#aphelion).');await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Synchronized');}
 await page.getByRole('button',{name:'Split',exact:true}).click();return page.locator('.preview a.dictionary-term-link');
}

test.describe('dictionary authoring',()=>{test.use({hasTouch:true});test('creates a dictionary page, adds a word, and keeps the mobile dialog sections separated',async({page})=>{
 await page.setViewportSize({width:390,height:700});
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('dictionary');await page.getByLabel('Password',{exact:true}).fill('disposable-dictionary-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await createFile(page,'Chapter','Writing','The ship reached its farthest point.');
 const source=page.getByLabel('Markdown source');await source.evaluate((el:HTMLTextAreaElement)=>{const start=el.value.indexOf('its farthest point');el.focus();el.setSelectionRange(start,start+'its farthest point'.length);});
 await page.getByRole('button',{name:'Define term',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Link to dictionary term'});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Create dictionary page'})).toBeVisible();
 const header=dialog.locator('header'),empty=dialog.locator('.term-empty');const [headerBox,emptyBox]=await Promise.all([header.boundingBox(),empty.boundingBox()]);expect(headerBox).not.toBeNull();expect(emptyBox).not.toBeNull();expect(emptyBox!.y).toBeGreaterThanOrEqual(headerBox!.y+headerBox!.height);
 await dialog.getByRole('button',{name:'Create dictionary page'}).tap();
 const createDescription=dialog.locator('.term-dialog-header p');
 const pageNameLabel=dialog.getByText('Dictionary page name',{exact:true});
 const [descriptionBox,labelBox,headerBorder]=await Promise.all([
  createDescription.boundingBox(),
  pageNameLabel.boundingBox(),
  dialog.locator('.term-dialog-header').evaluate(element=>getComputedStyle(element).borderBottomWidth),
 ]);
 expect(descriptionBox).not.toBeNull();expect(labelBox).not.toBeNull();
 expect(labelBox!.y).toBeGreaterThanOrEqual(descriptionBox!.y+descriptionBox!.height+12);
 expect(headerBorder).toBe('0px');
 await dialog.getByLabel('Dictionary page name').fill('Astronomy');await dialog.getByRole('button',{name:'Create page'}).tap();
 await expect(dialog.getByLabel('Dictionary file for new word').locator('option:checked')).toHaveText(/Astronomy\.md$/);await dialog.getByLabel('Word or term').fill('Aphelion');await dialog.getByLabel('Definition').fill('The point in an orbit farthest from the Sun.');await dialog.getByRole('button',{name:'Save word'}).tap();
 await expect(dialog.getByLabel('Dictionary term',{exact:true})).toHaveValue('aphelion');await expect(dialog.locator('.term-definition')).toContainText('farthest from the Sun');await expect(dialog.getByLabel('Linked text')).toHaveValue('its farthest point');
 await dialog.getByRole('button',{name:'Insert term link'}).tap();await expect(source).toHaveValue('The ship reached [its farthest point](../Dictionary/Astronomy.md#aphelion).');
});});

test('desktop links selected text and previews a dictionary definition on hover and focus',async({page})=>{
 const link=await setup(page);await link.hover();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toContainText('farthest from the Sun');await expect(preview.getByRole('button',{name:'Open definition'})).toBeVisible();await link.focus();await expect(preview).toBeVisible();
});

test.describe('touch device',()=>{test.use({hasTouch:true});test('mobile tap opens the definition preview and can navigate to its term',async({page})=>{
 await page.setViewportSize({width:390,height:844});const link=await setup(page);await link.tap();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toBeVisible();await preview.getByRole('button',{name:'Open definition'}).tap();await expect(page.getByLabel('File path')).toHaveValue('Dictionary/Astronomy.md');
});});
