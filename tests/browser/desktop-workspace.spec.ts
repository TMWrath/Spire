import {test,expect} from './fixtures';

test('desktop keeps a 1:3:1 workspace and returns to mobile drawers on resize',async({page})=>{
 await page.setViewportSize({width:1500,height:950});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.locator('.context')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeHidden();
 const check=async()=>{
  const widths=await page.locator('.workspace').evaluate(el=>Array.from(el.children).filter(n=>n.matches('.sidebar,.main,.context')).map(n=>n.getBoundingClientRect().width));
  expect(widths).toHaveLength(2);
  expect(widths[0]).toBeCloseTo(300,0);expect(widths[1]).toBeCloseTo(1200,0);
 };
 await check();
 const home=await page.locator('.empty').boundingBox();
 const recent=await page.locator('.recent-files').boundingBox();
 expect(recent!.width).toBeGreaterThan(1000);
 expect(recent!.width).toBeGreaterThan(home!.width*.85);

 await expect(page.getByRole('button',{name:'Calendar',exact:true})).toBeHidden();
 await expect(page.getByRole('region',{name:'Sidebar calendar'})).toBeVisible();
 const placement=await page.locator('.sidebar').evaluate(el=>({actions:el.querySelector('.sidebar-actions')!.getBoundingClientRect().bottom,calendar:el.querySelector('.sidebar-calendar')!.getBoundingClientRect().top}));
 expect(placement.calendar).toBeGreaterThanOrEqual(placement.actions);
 await page.locator('.sidebar-calendar [role="gridcell"]').filter({has:page.locator('span')}).first().click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Create dated file'}).click();
 await page.getByLabel('File name',{exact:true}).fill('Desktop context check');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await expect(page.locator('.context')).toBeVisible();
 const drag=async(label:string,dx:number)=>{const edge=page.getByRole('separator',{name:label});const box=(await edge.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+70);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+70,{steps:8});await page.mouse.up();};
 await drag('Resize navigation panel',70);
 expect((await page.locator('.sidebar').boundingBox())!.width).toBeCloseTo(370,0);
 await drag('Resize navigation panel',-62);
 expect((await page.locator('.sidebar').boundingBox())!.width).toBeCloseTo(300,0);
 await drag('Resize Context panel',-60);
 expect((await page.locator('.context').boundingBox())!.width).toBeCloseTo(360,0);
 await drag('Resize Context panel',52);
 expect((await page.locator('.context').boundingBox())!.width).toBeCloseTo(300,0);
 await page.getByRole('tab',{name:/Revision/}).click();
 const revisionWidth=(await page.locator('.context').boundingBox())!.width;
 await drag('Resize Context panel',-120);
 expect((await page.locator('.context').boundingBox())!.width).toBeGreaterThan(revisionWidth+80);
 await page.getByRole('separator',{name:'Resize Context panel'}).dblclick();
 await page.getByRole('tab',{name:'Details',exact:true}).click();


 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.locator('.context')).toHaveCount(0);
 for(const width of [360,390,768,1280,1920]){
  await page.setViewportSize({width,height:950});
  const sizes=await page.locator('.empty').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,cards:Array.from(el.querySelectorAll('.recent-files,.quick-actions-home,.quick-note,.quick-audio')).map(card=>({border:getComputedStyle(card).borderRadius,overflow:card.scrollWidth>card.clientWidth+1})),controls:Array.from(el.querySelectorAll('.quick-note textarea,.quick-note button,.quick-audio button')).map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))}));
  expect(sizes.overflow).toBe(false);
  for(const card of sizes.cards){expect(card.border).toBe('16px');expect(card.overflow).toBe(false);}
  for(const control of sizes.controls){expect(control.w).toBeGreaterThan(90);expect(control.h).toBeGreaterThanOrEqual(44);}
 }
 await page.setViewportSize({width:1500,height:950});
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Reliquary settings'})).toBeVisible();
 await check();
 await page.getByRole('button',{name:'Back to writing',exact:true}).click();
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 await expect(page.getByRole('region',{name:'File tasks',exact:true})).toBeVisible();
 await check();
 await page.getByRole('button',{name:'Back to files',exact:true}).click();
 // Android browsers commonly use a 980 CSS-pixel viewport for Desktop site.
 await page.setViewportSize({width:980,height:900});
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeHidden();
 await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.locator('.context')).toHaveCount(0);
 const phoneDesktopWidths=await page.locator('.workspace').evaluate(el=>Array.from(el.children).filter(n=>n.matches('.sidebar,.main,.context')).map(n=>n.getBoundingClientRect().width));
 expect(phoneDesktopWidths).toHaveLength(2);
 expect(phoneDesktopWidths[0]).toBeCloseTo(196,0);expect(phoneDesktopWidths[1]).toBeCloseTo(784,0);
 await page.setViewportSize({width:390,height:900});
 await expect(page.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
 await expect(page.locator('.sidebar-calendar')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeVisible();
 await expect(page.locator('.context')).toHaveCount(0);
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeVisible();
});
