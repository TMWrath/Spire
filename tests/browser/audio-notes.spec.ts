import {test,expect,type Page} from './fixtures';
import {selectDropdown} from './dropdown';

async function signIn(page:Page,username:string){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(username);
 await page.getByLabel('Password',{exact:true}).fill('disposable-audio-note-password');
 const create=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:create?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
}

async function journey(page:Page,username:string){
 await signIn(page,username);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const create=page.getByRole('dialog',{name:'Create from file'});
 await expect(create.getByRole('button',{name:/Audio Note/})).toBeVisible();
 await create.getByRole('button',{name:/New file/}).click();
 await create.getByRole('button',{name:/New blank file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('Meeting audio');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Audio Notes');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await page.getByLabel('Markdown source').fill('<!-- spire:audio-note {"audioPath":"Attachments/test.wav"} -->\n<audio controls src="../Attachments/test.wav"></audio>\n\n<!-- spire:audio-transcript -->\nOriginal words\n<!-- /spire:audio-transcript -->\n');
 await page.getByRole('button',{name:'Save file',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:/Meeting audio Audio Notes/}).click();
 await expect(page.getByRole('region',{name:'Audio Note'})).toBeVisible();
 await expect(page.getByText('Original words',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit transcript'}).click();
 await page.getByLabel('Edit transcript').fill('Edited words');
 await page.getByRole('button',{name:'Save transcript'}).click();
 await expect(page.getByText('Edited words',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept('Writing/Meeting transcript.md'));
 await page.getByRole('button',{name:'Convert to normal file'}).click();
 await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('Edited words');
 await expect(page.locator('audio')).toHaveCount(1);
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source')).toContainText('Edited words');
 await page.getByRole('button',{name:'Original Audio Note'}).click();
 await expect(page.getByRole('region',{name:'Audio Note'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Linked normal files'})).toContainText('Writing/Meeting transcript.md');
}

test('Audio Note is offered from Files and converts without replacing the original',async({page})=>journey(page,'audio-note-desktop'));
test('Audio Note edit and conversion works on mobile',async({browser})=>{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await journey(page,'audio-note-mobile');await context.close();});
