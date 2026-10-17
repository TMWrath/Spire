import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';
test('per-file autosave waits for idle and leaving offers save discard cancel',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('savewriter');await page.getByLabel('Password',{exact:true}).fill('disposable-saving-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New file'}).click();await page.getByLabel('File name',{exact:true}).fill('Saving');await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Writing');await page.getByRole('button',{name:'Create file',exact:true}).click();
 const toggle=page.getByRole('checkbox',{name:'Autosave this file'});await expect(toggle).toBeChecked();
 await page.getByRole('button',{name:'Source',exact:true}).click();const source=page.getByLabel('Markdown source',{exact:true});
 await source.fill('first');await page.waitForTimeout(1200);await expect(page.locator('footer')).toContainText('Unsaved changes');await source.fill('second');await page.waitForTimeout(1200);await expect(page.locator('footer')).toContainText('Unsaved changes');await expect(page.locator('footer')).toContainText(/Revision \d+/,{timeout:10000});
 await toggle.uncheck();await source.fill('manual draft');await page.waitForTimeout(2400);await expect(page.locator('footer')).toContainText('Unsaved changes');
 await page.getByRole('button',{name:'Home',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Unsaved changes'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(source).toHaveValue('manual draft');
 await page.getByRole('button',{name:'Home',exact:true}).click();await dialog.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByRole('heading',{name:'Your writing lives here.'})).toBeVisible();
 await page.getByRole('region',{name:'Recent files'}).getByRole('button').filter({hasText:'Saving'}).first().click();await expect(toggle).not.toBeChecked();await page.getByRole('button',{name:'Source',exact:true}).click();await expect(source).toHaveValue('second');await source.fill('saved on exit');
 await page.getByRole('button',{name:'Home',exact:true}).click();await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toBeHidden();
 await page.getByRole('region',{name:'Recent files'}).getByRole('button').filter({hasText:'Saving'}).first().click();await page.getByRole('button',{name:'Source',exact:true}).click();await expect(source).toHaveValue('saved on exit');
 await page.reload();await page.getByRole('region',{name:'Recent files'}).getByRole('button').filter({hasText:'Saving'}).first().click();await expect(toggle).not.toBeChecked();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 // Native Back is consumed while writing is unsaved, and Cancel retains the edit.
 await source.fill('Keep this failed save');
 const consumed=await page.evaluate(()=>!window.dispatchEvent(new CustomEvent('spire-request-leave',{cancelable:true,detail:'leave'})));
 expect(consumed).toBe(true);
 await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(source).toHaveValue('Keep this failed save');
 await page.route('**/api/mutate',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Provider unavailable'})}));
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await expect(source).toBeVisible();await expect(source).toHaveValue('Keep this failed save');
 await expect(page.locator('footer')).toContainText('Unsaved changes');

});

test('overlapping explicit saves serialize and retain the latest edit until acknowledged',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('save-race');await page.getByLabel('Password',{exact:true}).fill('disposable-save-race-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const me=await(await page.request.get('/api/me')).json();const id=crypto.randomUUID();
 const seed=await page.request.post('/api/mutate',{headers:{Origin:new URL(page.url()).origin,'X-CSRF-Token':me.csrf},data:{id,op:crypto.randomUUID(),base:0,path:'Writing/Serialized.md',content:'Initial',deleted:false}});expect(seed.ok()).toBe(true);
 await page.reload();await expect(page.locator('.network')).toHaveText('Synchronized');if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();const folder=page.locator('details[data-folder="Writing"]');if(!await folder.getAttribute('open'))await folder.locator(':scope > summary').click();await page.locator('nav').getByRole('button',{name:'Serialized',exact:true}).click();await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByRole('checkbox',{name:'Autosave this file'}).uncheck();
 let firstEntered!:()=>void,secondEntered!:()=>void,releaseFirst!:()=>void,releaseSecond!:()=>void;
 const first=new Promise<void>(r=>firstEntered=r),second=new Promise<void>(r=>secondEntered=r),gateFirst=new Promise<void>(r=>releaseFirst=r),gateSecond=new Promise<void>(r=>releaseSecond=r);const contents:string[]=[];
 await page.route('**/api/mutate',async route=>{const body=route.request().postDataJSON();if(body.id===id){contents.push(body.content);if(contents.length===1){firstEntered();await gateFirst;}else if(contents.length===2){secondEntered();await gateSecond;}}await route.continue();});
 const source=page.getByLabel('Markdown source',{exact:true}),save=page.getByRole('button',{name:'Save file',exact:true});await source.fill('First acknowledged revision');await save.click();await first;await source.fill('Latest writing');await save.click();await expect(source).toHaveValue('Latest writing');releaseFirst();await second;await expect(source).toHaveValue('Latest writing');await expect(page.locator('footer')).toContainText('Unsaved changes');releaseSecond();await expect(page.locator('footer')).toContainText('Revision 3');await expect(page.getByRole('alert')).toHaveCount(0);expect(contents).toEqual(['First acknowledged revision','Latest writing']);
 const snapshot=await(await page.request.get('/api/snapshot')).json(),note=snapshot.notes.find((n:any)=>n.id===id);expect(note.content).toBe('Latest writing');expect(note.history.some((n:any)=>n.content==='First acknowledged revision')).toBe(true);
});
