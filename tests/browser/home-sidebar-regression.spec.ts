import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';

const credentials={username:'owner',password:'correct horse battery staple'};

async function login(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(credentials.username);
 await page.getByLabel('Password',{exact:true}).fill(credentials.password);
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
}

for(const width of [390,673,1280])test(`Trash replaces the footer button at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844}); await login(page);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 const sidebar=page.locator('.sidebar'), tabs=sidebar.getByRole('tablist');
 expect((await tabs.getByRole('tab').allTextContents()).slice(-2)).toEqual(['Sources','Trash']);
 for(const name of ['General','Journal','Projects','Tags','Templates','Sources']){
  await tabs.getByRole('tab',{name,exact:true}).click();
  await expect(sidebar.getByRole('button',{name:'Trash',exact:true})).toHaveCount(0);
 }
 const main=page.locator('main.main');
 const before=await main.innerText();
 await tabs.getByRole('tab',{name:'Trash',exact:true}).click();
 await expect(sidebar.getByRole('tabpanel',{name:'Trash',exact:true})).toBeVisible();
 await expect(main).toHaveText(before.replace(/\s+/g,' ').trim(),{useInnerText:true});
 await expect(tabs.getByRole('tab',{name:'Trash',exact:true})).toHaveAttribute('aria-selected','true');
 await tabs.getByRole('tab',{name:'General',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Trash',exact:true})).toHaveCount(0);
});

for(const width of [390,673,1280])test(`Files sections stay in the sidebar at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844}); await login(page);
 const sidebar=page.locator('.sidebar');
 if(!await sidebar.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await sidebar.getByRole('tab',{name:'General',exact:true}).click();
 const actions=sidebar.getByRole('group',{name:'Files creation actions'});
 const search=sidebar.getByRole('textbox',{name:'Search files'});
 await search.fill('no matching file');
 await expect(actions).toBeVisible();
 expect((await actions.boundingBox())!.y).toBeLessThan((await search.boundingBox())!.y);
 await search.clear();
 const sections=sidebar.getByRole('group',{name:'Files sections'});
 const main=page.locator('main.main');
 const before=await main.innerText();
 for(const name of ['Tasks','Lists','Audio Notes','Files']){
  const button=sections.getByRole('button',{name,exact:true});
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(actions.getByRole('button',{name:'Add File',exact:true})).toBeVisible();
  if(name!=='Files'){
   const panel=sidebar.getByRole('region',{name:name==='Tasks'?'File tasks':`${name} in Files`,exact:true});
   await expect(panel).toBeVisible();
   await expect(panel.getByRole('button',{name:/^Back to /i})).toHaveCount(0);
   await expect(panel.getByText(name==='Tasks'?'Files · Tasks':`Files ${name}`,{exact:true})).toHaveCount(0);
  }
  await expect(sidebar).toBeVisible();
  await expect(main).toHaveText(before.replace(/\s+/g,' ').trim(),{useInnerText:true});
 }
});

test('mobile sidebar replaces the Workspace label with the tab bar',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await login(page);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 const sidebar=page.locator('.sidebar');
 const head=sidebar.locator('.sidebar-mobile-head');
 const tabs=head.getByRole('tablist');
 await expect(head.getByText('Workspace',{exact:true})).toHaveCount(0);
 await expect(tabs).toBeVisible();
 await expect(tabs.getByRole('tab')).toHaveCount(7);
 await expect(head.getByRole('button',{name:'Close folders',exact:true})).toHaveCount(0);
 const [headBox,tabsBox]=await Promise.all([head.boundingBox(),tabs.boundingBox()]);
 expect(headBox&&tabsBox).toBeTruthy();
 expect(tabsBox!.x).toBeGreaterThanOrEqual(headBox!.x);
 expect(tabsBox!.x+tabsBox!.width).toBeLessThanOrEqual(headBox!.x+headBox!.width);
});

test('mobile sidebar toggle stays centered above the app-header divider',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await login(page);
 const header=page.locator('.app>header');
 const toggle=page.getByRole('button',{name:'Toggle folders',exact:true});
 const [headerBox,toggleBox]=await Promise.all([header.boundingBox(),toggle.boundingBox()]);
 expect(headerBox&&toggleBox).toBeTruthy();
 expect(toggleBox!.y).toBeGreaterThanOrEqual(headerBox!.y+4);
 expect(toggleBox!.y+toggleBox!.height).toBeLessThanOrEqual(headerBox!.y+headerBox!.height-12);
 expect((toggleBox!.y+toggleBox!.height/2)).toBeLessThanOrEqual(headerBox!.y+headerBox!.height/2-2);
});

test('mobile Trash heading keeps its content above the first card without clipping or overlap',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await login(page);
 const {csrf}=await (await page.request.get('/api/me')).json();
 const headers={Origin:new URL(page.url()).origin,'X-CSRF-Token':csrf};
 const folder='Trash layout fixture';
 expect((await page.request.post('/api/folders',{headers,data:{path:folder}})).ok()).toBe(true);
 expect((await page.request.post(`/api/attachments?path=${encodeURIComponent(folder+'/sample.txt')}`,{headers:{...headers,'Content-Type':'application/octet-stream'},data:Buffer.from('fixture')})).ok()).toBe(true);
 expect((await page.request.delete('/api/folders',{headers,data:{path:folder,mode:'trash'}})).ok()).toBe(true);
 await page.reload();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('tab',{name:'Trash',exact:true}).click();
 const panel=page.locator('.sidebar').getByRole('tabpanel',{name:'Trash',exact:true});
 const card=panel.locator('.trash-file-card');
 await expect(card).toBeVisible();
 expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await card.getByRole('button',{name:'Restore',exact:true}).click();
 await expect(card).toHaveCount(0);
});

for(const width of [390,673,844,979]) test(`drawer closes and opening a file reveals the editor at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:width===979?800:390});
 await login(page);
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();
 const sidebar=page.locator('.sidebar');
 await expect(sidebar).toBeHidden();
 const canvas=page.locator('.main');
 const before=(await canvas.boundingBox())!;
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await expect(sidebar).toBeVisible();
 expect((await canvas.boundingBox())!.width).toBeCloseTo(before.width,0);
 await page.locator('.sidebar-backdrop').click({position:{x:width-10,y:200}});
 await expect(sidebar).toBeHidden();
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();

 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create from file'});
 await dialog.getByRole('button',{name:/New file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('Mobile editor');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await expect(sidebar).toBeHidden();
 await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();
});
