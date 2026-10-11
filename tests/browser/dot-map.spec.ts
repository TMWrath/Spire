import {selectDropdown} from './dropdown';
import {randomUUID} from 'node:crypto';
import {test,expect} from './fixtures';
test('approved original dot renderer selects actual dots and pauses rendered motion',async({page,context})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();const before=await (await context.request.get('/api/snapshot')).json();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').check();await page.getByRole('button',{name:'Back to writing'}).click();if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 const map=page.getByRole('region',{name:'Reliquary mind map'}),surface=map.locator('canvas.mind-surface');await expect(surface).toBeVisible({timeout:3000});await expect(surface).toHaveAttribute('data-renderer','original-canvas-dots');
 await expect(surface).toHaveAttribute('data-motion','animated');await page.waitForTimeout(100);const moving=await surface.screenshot();await page.waitForTimeout(350);expect(await surface.screenshot()).not.toEqual(moving);
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();await expect(page.locator('.sidebar canvas.mind-surface')).toHaveAttribute('data-motion','static');await page.getByRole('button',{name:'Toggle folders',exact:true}).click();await expect(surface).toHaveAttribute('data-motion','animated');
 await page.emulateMedia({reducedMotion:'reduce'});await surface.focus();await page.keyboard.press('Home');await expect(surface).toHaveAttribute('data-motion','static');await page.waitForTimeout(100);const reduced=await surface.screenshot();await page.waitForTimeout(350);expect(await surface.screenshot()).toEqual(reduced);
 // Hit a projected front dot, not the accessible file picker. The expected point comes from the approved engine.
 const {layout,identity,project}=await import('../../client/dot-map/core.mjs');const {files,edges}=await import('../../client/dot-map/demo.mjs');const b=(await surface.boundingBox())!,positions=layout(files,edges);const front=files.map(file=>({file,...project(positions.get(file.id)!,identity(),Math.min(b.width,b.height)*.37)})).sort((a,b)=>b.depth-a.depth)[0];
 await page.mouse.click(b.x+b.width/2+front.x,b.y+b.height/2+front.y);await expect(map.locator('.mind-detail strong')).toHaveText(front.file.name);await expect(map.getByRole('button',{name:'Open file'})).toHaveCount(0);
 await map.getByRole('button',{name:'Clear map selection'}).click();await expect(map.locator('.mind-detail')).toHaveCount(0);await page.locator('.sidebar').getByLabel('Find a file in the map').fill('Observatory');await expect(surface).toHaveAttribute('data-matches','1');await page.locator('.sidebar').getByLabel('Find a file in the map').fill('');
 const after=await (await context.request.get('/api/snapshot')).json();expect(after).toEqual(before);await page.screenshot({path:'artifacts/dot-map-integrated-desktop.png'});
});

test('real UUID files keep their directional map and camera across sync; opening never rewrites files',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const me=await (await context.request.get('/api/me')).json(),headers={'Origin':'http://127.0.0.1:4179','X-CSRF-Token':me.csrf},source=randomUUID(),target=randomUUID();
 const folder=await context.request.post('/api/folders',{headers,data:{path:'Graph'}});expect(folder.status()).toBe(201);
 for(const file of [{id:source,path:'Graph/Source.md',content:'# Original source'},{id:target,path:'Graph/Target.md',content:'[[Source]]'}]){const response=await context.request.post('/api/mutate',{headers,data:{...file,op:randomUUID(),base:0,deleted:false}});expect(response.status()).toBe(200);}
 await page.reload();const map=page.getByRole('region',{name:'Reliquary mind map'}),surface=map.locator('canvas');await expect(map.locator('.mind-node')).toHaveCount(2);await expect(map).toHaveAttribute('data-file-count','2');await expect(map).toHaveAttribute('data-connection-count','1');
 const before=await (await context.request.get('/api/snapshot')).json();await surface.focus();await page.keyboard.press('ArrowRight');const rotated=await surface.getAttribute('data-rotation');expect(rotated).not.toBe('1,0,0,0,1,0,0,0,1');
 const refresh=page.waitForResponse(r=>r.url().endsWith('/api/snapshot')&&r.status()===200);await page.getByRole('button',{name:'Sync now',exact:true}).focus();await page.keyboard.press('Enter');await refresh;await expect(page.locator('.sidebar')).toBeHidden();await page.getByRole('button',{name:'Toggle folders',exact:true}).click();await page.waitForTimeout(100);await expect(surface).toHaveAttribute('data-rotation',rotated!);
 await selectDropdown(map.getByLabel('Select a file in the map'),source);await expect(map.getByText('0 references · 1 referencing files')).toBeVisible();
 await selectDropdown(map.getByLabel('Select a file in the map'),target);await expect(map.getByText('1 references · 0 referencing files')).toBeVisible();await map.getByRole('button',{name:'Open file'}).click();await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('Source');await page.locator('.editor-tabs').getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source')).toHaveValue('[[Source]]');
 expect(await (await context.request.get('/api/snapshot')).json()).toEqual(before);expect(errors).toEqual([]);
});
