import {test,expect} from './fixtures';
for(const touch of [false,true])test.describe(touch?'touch full sidebar scroll':'desktop full sidebar scroll',()=>{
 test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});
 test('all directory tabs share the outer sidebar scroll surface',async({page})=>{
  await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('scroll-user');await page.getByLabel('Password',{exact:true}).fill('disposable-scroll-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  const sidebar=page.locator('.sidebar');const scroller=sidebar.locator('.sidebar-scroll');if(!await sidebar.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
  for(const tab of ['Files','Tags','Templates','Sources']){
   await scroller.evaluate(el=>el.scrollTop=0);await sidebar.getByRole('tab',{name:tab,exact:true}).click();
   const panel=sidebar.locator('#sidebar-'+tab.toLowerCase());
   // Disposable geometry fixture stresses the real rendered panel and its stylesheet.
   await panel.evaluate(el=>{const fixture=document.createElement('div');fixture.dataset.scrollFixture='true';fixture.style.height='1400px';el.append(fixture);});
   expect(await panel.evaluate(el=>getComputedStyle(el).overflowY)).toBe('visible');
   const footerBefore=await sidebar.locator('.sidebar-bottom').boundingBox();
   const before=await sidebar.locator('.mind-map').boundingBox();
   await scroller.evaluate(el=>el.scrollTop=250);
   expect(await scroller.evaluate(el=>el.scrollTop)).toBeGreaterThan(200);
   const after=await sidebar.locator('.mind-map').boundingBox();expect(before!.y-after!.y).toBeGreaterThan(200);
   expect(await panel.evaluate(el=>el.scrollTop)).toBe(0);
   const footerAfter=await sidebar.locator('.sidebar-bottom').boundingBox();expect(footerAfter!.y).toBeCloseTo(footerBefore!.y,0);
   await expect(sidebar.getByRole('button',{name:'Create',exact:true})).toBeInViewport();await expect(sidebar.getByRole('button',{name:'Trash',exact:true})).toBeInViewport();
   await sidebar.getByRole('button',{name:'Create',exact:true}).click();
   await expect(page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New file/})).toBeInViewport();
   await sidebar.getByRole('button',{name:'Create',exact:true}).click();
   await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
   expect((await sidebar.locator('.sidebar-bottom').boundingBox())!.y).toBeCloseTo(footerBefore!.y,0);
   await panel.locator('[data-scroll-fixture]').evaluate(el=>el.remove());
  }
 });
});
