import {test,expect} from './fixtures';
for(const touch of [false,true])test.describe(touch?'touch recent files':'desktop recent files',()=>{
 test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});
 test('spacing, last-opened ordering, persistence, reopen and contained carousel',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('recent-tester');await page.getByLabel('Password',{exact:true}).fill('disposable-recent-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('region',{name:'Recent files',exact:true})).toContainText('Files you open on this device');
 await page.getByRole('button',{name:'Manage quick actions',exact:true}).click();
 const template=page.getByLabel('Action template'),add=page.getByRole('button',{name:'Add action',exact:true});const top=await template.boundingBox(),bottom=await add.boundingBox();expect(bottom!.y-(top!.y+top!.height)).toBeGreaterThanOrEqual(18);
 await page.getByRole('button',{name:'Back to writing',exact:true}).click();
 const identity=await (await page.request.get('/api/me')).json();
 const ids:string[]=[];for(let i=0;i<7;i++){const id=crypto.randomUUID();ids.push(id);const response=await page.request.post('/api/mutate',{headers:{'X-CSRF-Token':identity.csrf,Origin:new URL(page.url()).origin},data:{id,op:crypto.randomUUID(),base:0,path:`Writing/File ${i}.md`,content:`# File ${i}\nResume this writing.`,deleted:false}});expect(response.ok()).toBe(true);}
 await page.reload();await expect(page.getByRole('region',{name:'Recent files',exact:true})).toBeVisible();
 // Seed enough history to exercise carousel overflow; opening a card below exercises actual tracking.
 await page.evaluate(({owner,ids})=>localStorage.setItem('spire-recent-files:'+owner,JSON.stringify(ids)),{owner:identity.owner,ids});await page.reload();
 const cards=page.locator('.recent-file-card');await expect(cards).toHaveCount(7);await expect(cards.first()).toContainText('File 0');
 const rail=page.locator('.recent-file-carousel');expect(await rail.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await page.getByRole('button',{name:'Next recent files'}).click();await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await cards.nth(3).scrollIntoViewIfNeeded();if(touch)await cards.nth(3).tap();else await cards.nth(3).click();await expect(page.getByLabel('File path',{exact:true})).toHaveValue('Writing/File 3.md');
 await page.reload();await expect(cards.first()).toContainText('File 3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.request.post('/api/mutate',{headers:{'X-CSRF-Token':identity.csrf,Origin:new URL(page.url()).origin},data:{id:ids[3],op:crypto.randomUUID(),base:1,path:'Writing/File 3.md',content:'# File 3\nResume this writing.',deleted:true}});await page.reload();await expect(cards).toHaveCount(6);await expect(cards.first()).toContainText('File 0');
 });
});
