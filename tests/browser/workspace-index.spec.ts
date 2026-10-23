import {test,expect} from './fixtures';
test('cached workspace reveals before head completes; repeated refresh avoids full snapshots',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('index-tester');await page.getByLabel('Password',{exact:true}).fill('disposable-index-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.locator('.network')).toHaveText('Synchronized');
 await page.evaluate(async()=>{const me=await(await fetch('/api/me')).json();const headers={'Content-Type':'application/json','X-CSRF-Token':me.csrf};let response=await fetch('/api/folders',{method:'POST',headers,body:JSON.stringify({path:'Writing'})});if(!response.ok)throw Error('folder setup failed');response=await fetch('/api/mutate',{method:'POST',headers,body:JSON.stringify({id:crypto.randomUUID(),op:crypto.randomUUID(),base:0,path:'Writing/Cached.md',content:'Exact cached writing\n\n',deleted:false})});if(!response.ok)throw Error('file setup failed');});
 await page.reload();await expect(page.locator('.network')).toHaveText('Synchronized');
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 // Folder expansion is independent of the file body.
 const folder=page.locator('.sidebar').getByText('Writing',{exact:true});await folder.click();await expect(page.getByRole('button',{name:'Cached',exact:true})).toBeVisible();
 const snapshots:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/snapshot')snapshots.push(r.url());});
 let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);await page.route('**/api/workspace/head',async route=>{await blocked;await route.continue();});
 try{await page.reload();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();await expect(page.locator('.workspace-status')).toContainText('1 file');expect(snapshots).toHaveLength(0);}finally{release();}
 await expect(page.locator('.network')).toHaveText('Synchronized');expect(snapshots).toHaveLength(0);
});
