import {test,expect} from './fixtures';
for(const mobile of [false,true])test(`folder deletion shows retry errors and recovery disclosure ${mobile?'mobile':'desktop'}`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('delete-'+crypto.randomUUID().slice(0,8));await page.getByLabel('Password',{exact:true}).fill('disposable-delete-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const me=await(await page.request.get('/api/me')).json(),headers={Origin:new URL(page.url()).origin,'X-CSRF-Token':me.csrf};
 expect((await page.request.post('/api/folders',{headers,data:{path:'Disposable'}})).ok()).toBe(true);
 await page.reload();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Delete folder Disposable',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Delete empty folder',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Delete folder Disposable',exact:true}).click();
 // Addition after the dialog opens must fail safely, then offer a refreshed disposition.
 expect((await page.request.post('/api/attachments?path=Disposable/hidden.json',{headers:{...headers,'Content-Type':'application/octet-stream'},data:Buffer.from('{"keep":"bytes"}')})).ok()).toBe(true);
 await dialog.getByRole('button',{name:'Delete folder',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('no longer empty');
 await dialog.getByRole('button',{name:'Refresh folder',exact:true}).click();dialog=page.getByRole('dialog',{name:'Delete folder',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('Recovered');
 await dialog.getByRole('button',{name:'Delete files',exact:true}).click();const recovery=page.getByRole('dialog',{name:'Folder recovery',exact:true});await expect(recovery).toBeVisible();await expect(recovery).toContainText('Recovered Folders/Disposable-');
 await recovery.getByRole('button',{name:'Done',exact:true}).click();await page.reload();const snapshot=await(await page.request.get('/api/snapshot')).json();expect(snapshot.attachments.some((a:any)=>a.path.startsWith('Recovered Folders/Disposable-')&&a.path.endsWith('/hidden.json'))).toBe(true);expect(snapshot.folders).not.toContain('Disposable');
});
