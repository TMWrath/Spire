import {test,expect} from './fixtures';

test('tree actions separate trash, icon hold-drag and name hold-rename',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tree-'+crypto.randomUUID().slice(0,8));await page.getByLabel('Password',{exact:true}).fill('disposable-tree-test-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const me=await(await page.request.get('/api/me')).json(),headers={Origin:new URL(page.url()).origin,'X-CSRF-Token':me.csrf};
 for(const path of ['Writing','Archive','Empty'])expect((await page.request.post('/api/folders',{headers,data:{path}})).ok()).toBe(true);
 const id=crypto.randomUUID();expect((await page.request.post('/api/mutate',{headers,data:{id,op:crypto.randomUUID(),base:0,path:'Writing/Original.md',content:'Keep every word',deleted:false}})).ok()).toBe(true);
 await page.reload();await expect(page.locator('.network')).toHaveText('Saved on server');
 const tree=page.locator('.sidebar');if(!await tree.isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 const folder=page.locator('details[data-folder="Writing"]');await folder.locator(':scope > summary').click();
 await expect(page.getByRole('button',{name:'Delete folder Empty',exact:true})).toBeVisible();
 const name=page.locator('[data-item-name="Writing/Original.md"]');await name.hover();await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
 const rename=page.getByRole('dialog',{name:'Rename file',exact:true});await expect(rename).toBeVisible();await expect(page.getByRole('dialog',{name:'Delete folder',exact:true})).toBeHidden();
 await rename.getByLabel('New name',{exact:true}).fill('Renamed');await rename.getByRole('button',{name:'Rename',exact:true}).click();await expect(rename).toBeHidden();console.log(await page.locator('[data-item-name="Writing/Renamed.md"]').evaluate(el=>{const chain=[];for(let n:Element|null=el;n;n=n.parentElement){const s=getComputedStyle(n);chain.push({tag:n.tagName,cls:n.className,hidden:n.hasAttribute('hidden'),display:s.display,rect:n.getBoundingClientRect().toJSON()});}return chain;}));await expect(page.locator('[data-item-name="Writing/Renamed.md"]')).toBeVisible();
 const handle=page.getByLabel('Drag file Writing/Renamed.md',{exact:true});const a=await handle.boundingBox(),target=page.locator('details[data-folder="Archive"] > summary'),b=await target.boundingBox();expect(a&&b).toBeTruthy();
 await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();await page.waitForTimeout(550);await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2,{steps:12});await expect(page.locator('.drag-ghost')).toBeVisible();await page.mouse.up();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/snapshot')).json();return s.notes.find((n:any)=>n.id===id)?.path;}).toBe('Archive/Renamed.md');
 const folderName=page.locator('[data-item-name="Archive"]');await folderName.hover();await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
 const folderRename=page.getByRole('dialog',{name:'Rename folder',exact:true});await expect(folderRename).toBeVisible();await folderRename.getByLabel('New name',{exact:true}).fill('Library');await folderRename.getByRole('button',{name:'Rename',exact:true}).click();await expect(folderRename).toBeHidden();
 await expect.poll(async()=>{const s=await(await page.request.get('/api/snapshot')).json();return s.notes.find((n:any)=>n.id===id)?.path;}).toBe('Library/Renamed.md');
 await page.getByRole('button',{name:'Delete folder Empty',exact:true}).click();const deletion=page.getByRole('dialog',{name:'Delete empty folder'});await expect(deletion).toBeVisible();await deletion.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('details[data-folder="Empty"]')).toBeVisible();
 await page.reload();await expect(page.locator('.network')).toHaveText('Saved on server');const snapshot=await(await page.request.get('/api/snapshot')).json();expect(snapshot.notes.find((n:any)=>n.id===id)).toMatchObject({path:'Library/Renamed.md',content:'Keep every word',deleted:false});
});
