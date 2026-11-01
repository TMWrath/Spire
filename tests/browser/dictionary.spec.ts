import {test,expect,type Page} from './fixtures';

async function createFile(page:Page,name:string,folder:string,content:string){
 if(!await page.locator('.sidebar').isVisible()){await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));await expect(page.locator('.sidebar')).toBeVisible();}
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New file/}).click();await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New blank file/}).click();
 await page.getByLabel('File name',{exact:true}).fill(name);const select=page.getByLabel('Save in folder');await select.click();
 const folderOption=page.getByRole('option',{name:folder,exact:true});if(await folderOption.count())await folderOption.click();else{await page.getByRole('option',{name:'Create new folder…',exact:true}).click();await page.getByLabel('New folder path').fill(folder);}
 await page.getByRole('button',{name:'Create file',exact:true}).click();if(await page.locator('.sidebar').isVisible())await page.locator('.sidebar').evaluate(element=>element.setAttribute('hidden',''));await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source').fill(content);await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Saved on server');
}
async function setup(page:Page){
 const username=`dictionary-preview-${crypto.randomUUID()}`;
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-dictionary-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await createFile(page,'Astronomy','Reference','---\nspire_type: dictionary\n---\n# Astronomy\n\n## Aphelion\nThe point in an orbit farthest from the Sun.\n\n## Perihelion\nThe closest orbital point.');
 await createFile(page,'Chapter','Writing','The ship reached [its farthest point](../Reference/Astronomy.md#aphelion).');
 await page.getByRole('button',{name:'Split',exact:true}).click();return page.locator('.preview a.dictionary-term-link');
}

test.describe('dictionary authoring',()=>{test.use({hasTouch:true});test('Define automatically creates a dictionary beside the current file and opens Add word',async({page})=>{
 await page.setViewportSize({width:390,height:700});
 const username=`automatic-define-action-${crypto.randomUUID()}`;
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-dictionary-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await createFile(page,'Chapter','Writing','The ship reached its farthest point.');
 const source=page.getByLabel('Markdown source');await source.evaluate((el:HTMLTextAreaElement)=>{const start=el.value.indexOf('its farthest point');el.focus();el.setSelectionRange(start,start+'its farthest point'.length);});
 await page.getByRole('button',{name:'Define term',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Link to dictionary term'});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Add word',exact:true})).toBeVisible();await expect(dialog.getByLabel('Dictionary file for new word').locator('option:checked')).toHaveText('Writing/Dictionary.md');await expect(dialog.getByLabel('Word or term')).toHaveValue('its farthest point');
 await dialog.getByLabel('Definition').fill('The point in the journey farthest from home.');await dialog.getByRole('button',{name:'Save word'}).tap();
 await expect(dialog.getByLabel('Dictionary term',{exact:true})).toHaveValue('its-farthest-point');await expect(dialog.getByLabel('Linked text')).toHaveValue('its farthest point');await expect(dialog.getByRole('button',{name:'Insert term link'})).toBeEnabled();
 await dialog.getByRole('button',{name:'Insert term link'}).tap();await expect(source).toHaveValue('The ship reached [its farthest point](Dictionary.md#its-farthest-point).');
 await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Saved on server');
 const snapshot=await page.request.get('/api/snapshot'),data=await snapshot.json();const dictionaries=data.notes.filter((note:any)=>note.path==='Writing/Dictionary.md');expect(dictionaries).toHaveLength(1);expect(dictionaries[0].content).toContain('## its farthest point\nThe point in the journey farthest from home.');
});});

test('typing @def automatically creates a dictionary beside the current file',async({page})=>{
 const username=`automatic-definition-command-${crypto.randomUUID()}`;
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-definition-command-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));
 await createFile(page,'Chapter','Writing','');
 await page.getByRole('button',{name:'Editor',exact:true}).click();const editor=page.getByRole('textbox',{name:'Document editor',exact:true});await editor.fill('@def Solar wind');await editor.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Add definition'});await expect(dialog).toBeVisible();await dialog.getByLabel('Definition location').selectOption('dictionary');await expect(dialog.getByLabel('Dictionary file')).toHaveValue(/.+/);await expect(dialog.getByText('No dictionary files yet')).toHaveCount(0);await expect(dialog.getByLabel('Word or term')).toHaveValue('Solar wind');
 await dialog.getByRole('textbox',{name:'Definition',exact:true}).fill('Charged particles streaming outward from the Sun.');await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.network')).toHaveText('Saved on server');
 const snapshot=await page.request.get('/api/snapshot'),data=await snapshot.json();const dictionary=data.notes.find((note:any)=>note.path==='Writing/Dictionary.md');expect(dictionary.content).toContain('spire_type: dictionary');expect(dictionary.content).toContain('## Solar wind\nCharged particles streaming outward from the Sun.');
});

test('typing @def and a term in the visual editor adds its definition to a dictionary file',async({page})=>{
 const username=`definition-command-${crypto.randomUUID()}`;
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-definition-command-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));
 await createFile(page,'Astronomy','Reference','---\nspire_type: dictionary\n---\n# Astronomy\n');await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));await createFile(page,'Chapter','Writing','');
 await page.getByRole('button',{name:'Editor',exact:true}).click();const editor=page.getByRole('textbox',{name:'Document editor',exact:true});await editor.fill('@def Solar wind');await editor.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Add definition'});await expect(dialog).toBeVisible();await dialog.getByLabel('Definition location').selectOption('dictionary');await expect(dialog.getByLabel('Word or term')).toHaveValue('Solar wind');await expect(editor).not.toContainText('@def');
 await dialog.getByRole('textbox',{name:'Definition',exact:true}).fill('Charged particles streaming outward from the Sun.');await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.network')).toHaveText('Saved on server');
 const snapshot=await page.request.get('/api/snapshot'),data=await snapshot.json();expect(data.notes.filter((note:any)=>note.path==='Writing/Dictionary.md')).toHaveLength(0);const reference=data.notes.find((note:any)=>note.path==='Reference/Astronomy.md');expect(reference.content).toContain('## Solar wind\nCharged particles streaming outward from the Sun.');const chapter=data.notes.find((note:any)=>note.path==='Writing/Chapter.md');expect(chapter.content).not.toContain('@def');
});

test('mobile soft-keyboard Enter activates @def and persists it in Definitions',async({page})=>{
 const username=`mobile-definition-command-${crypto.randomUUID()}`;
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-definition-command-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));
 await createFile(page,'Chapter','Writing','');
 await page.getByRole('button',{name:'Editor',exact:true}).click();const editor=page.getByRole('textbox',{name:'Document editor',exact:true});await editor.fill('@def Solar wind');
 await editor.evaluate(element=>element.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true})));
 const dialog=page.getByRole('dialog',{name:'Add definition'});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Word or term')).toHaveValue('Solar wind');await dialog.getByLabel('Definition',{exact:true}).fill('Charged particles streaming outward from the Sun.');await dialog.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('button',{name:'Toggle context'}).click();await page.getByRole('tab',{name:'Definitions'}).click();const definitions=page.getByRole('tabpanel',{name:'Definitions'});await expect(definitions.locator('article').filter({hasText:'Solar wind'})).toContainText('Charged particles streaming outward from the Sun.');await page.getByRole('button',{name:'Toggle context'}).click();await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Saved on server');
});

test('typing @def can keep the term and store a document-local definition with an optional final page',async({page})=>{
 const username=`local-definition-command-${crypto.randomUUID()}`;
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill('disposable-definition-command-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await page.locator('.sidebar').evaluate(element=>element.removeAttribute('hidden'));
 await createFile(page,'Chapter','Writing','');
 await page.getByRole('button',{name:'Editor',exact:true}).click();const editor=page.getByRole('textbox',{name:'Document editor',exact:true});await editor.fill('@def Aphelion');await editor.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Add definition'});await expect(dialog).toBeVisible();await dialog.getByLabel('Definition location').selectOption('document');await expect(dialog.getByLabel('Word or term')).toHaveValue('Aphelion');await dialog.getByLabel('Definition',{exact:true}).fill('The farthest point in an orbit.');await dialog.getByRole('button',{name:'Done',exact:true}).click();
 await expect(editor).toContainText('Aphelion');await expect(editor).not.toContainText('@def');await page.getByRole('button',{name:'Toggle context'}).click();await page.getByRole('tab',{name:'Definitions'}).click();const definitions=page.getByRole('tabpanel',{name:'Definitions'});const definitionEntry=definitions.locator('article').filter({hasText:'Aphelion'});await expect(definitionEntry.locator('strong')).toHaveText('Aphelion');await expect(definitionEntry.locator('p')).toHaveText('The farthest point in an orbit.');const viewportWidth=await page.evaluate(()=>window.visualViewport?.width??window.innerWidth);await expect.poll(async()=>page.locator('.context').evaluate(element=>element.getBoundingClientRect().x)).toBeLessThanOrEqual(2);await expect.poll(async()=>page.locator('.context').evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(viewportWidth-2);await definitions.getByRole('button',{name:'Edit'}).click();await definitions.getByLabel('Edit definition',{exact:true}).fill('The farthest orbital point.');await definitions.getByRole('button',{name:'Save definition'}).click();await expect(definitions).toContainText('The farthest orbital point.');
 await page.getByLabel('Create Definitions page').check();await page.getByRole('button',{name:'Toggle context'}).click();await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('.network')).toHaveText('Saved on server');await page.getByRole('button',{name:'Source',exact:true}).click();const source=page.getByLabel('Markdown source');await expect(source).toHaveValue(/Aphelion[\s\S]*# Definitions[\s\S]*## Aphelion\nThe farthest orbital point\./);const value=await source.inputValue();expect(value.lastIndexOf('# Definitions')).toBeGreaterThan(value.lastIndexOf('Aphelion',value.indexOf('# Definitions')));
 const snapshot=await page.request.get('/api/snapshot'),data=await snapshot.json();expect(data.notes.filter((note:any)=>note.path==='Writing/Dictionary.md')).toHaveLength(0);
});

test('desktop links selected text and previews a dictionary definition on hover and focus',async({page})=>{
 const link=await setup(page);await link.hover();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toContainText('farthest from the Sun');await expect(preview.getByRole('button',{name:'Open definition'})).toBeVisible();await link.focus();await expect(preview).toBeVisible();
});

test.describe('touch device',()=>{test.use({hasTouch:true});test('mobile tap opens the definition preview and can navigate to its term',async({page})=>{
 await page.setViewportSize({width:390,height:844});const link=await setup(page);await link.tap();const preview=page.getByRole('dialog',{name:'Definition of Aphelion'});await expect(preview).toBeVisible();await preview.getByRole('button',{name:'Open definition'}).tap();await expect(page.getByLabel('File path')).toHaveValue('Reference/Astronomy.md');
});});
