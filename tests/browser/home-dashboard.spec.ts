import {test,expect} from './fixtures';

async function openHome(page:import('@playwright/test').Page,username:string){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(username);
 await page.getByLabel('Password',{exact:true}).fill('disposable-home-dashboard-password');
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.locator('.home-dashboard')).toBeVisible();
}

test.describe('Home dashboard',()=>{
 test('desktop uses the full canvas instead of retaining an empty navigation sidebar',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await openHome(page,'home-desktop-canvas');
  await expect(page.locator('.workspace')).toHaveClass(/home-workspace/);
  await expect(page.locator('.workspace > .sidebar')).toBeHidden();
  const workspace=await page.locator('.workspace').boundingBox();
  const dashboard=await page.locator('.home-dashboard').boundingBox();
  expect(workspace).not.toBeNull();expect(dashboard).not.toBeNull();
  expect(dashboard!.width).toBeGreaterThan(workspace!.width*.75);
 });

 for(const viewport of [{width:390,height:844},{width:673,height:900},{width:1280,height:900}]){
  test(`widgets use direct remove and add controls at ${viewport.width}px`,async({page})=>{
   await page.setViewportSize(viewport);
   await openHome(page,`home-widgets-${viewport.width}`);
   const dashboard=page.locator('.home-dashboard');
   expect(await dashboard.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();

   const quickCreate=page.getByRole('region',{name:'Quick Create widget',exact:true}).locator('.quick-actions-home');
   await expect(quickCreate).toBeVisible();
   const quickCreateStyle=await quickCreate.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundColor,border:style.borderTopWidth,radius:style.borderTopLeftRadius,padding:style.paddingTop};});
   expect(quickCreateStyle.background).toBe('rgb(24, 24, 24)');
   expect(quickCreateStyle.border).toBe('1px');
   expect(quickCreateStyle.radius).toBe('16px');
   expect(parseFloat(quickCreateStyle.padding)).toBeGreaterThan(0);

   const recent=page.getByRole('region',{name:'Recent files',exact:true});
   await expect(recent.getByRole('button',{name:/Remove Recent files/})).toHaveCount(0);
   await expect(recent).not.toHaveAttribute('draggable','true');

   const audio=page.getByRole('region',{name:'Quick audio widget',exact:true});
   const removeAudio=audio.getByRole('button',{name:'Remove Quick audio widget',exact:true});
   await expect(removeAudio).toBeVisible();
   const removeStyle=await removeAudio.evaluate(element=>{const style=getComputedStyle(element);const button=element.getBoundingClientRect();const widget=element.closest('.home-widget')!.getBoundingClientRect();return {background:style.backgroundColor,border:style.borderTopWidth,radius:style.borderTopLeftRadius,right:widget.right-button.right,top:button.top-widget.top};});
   expect(removeStyle.background).toBe('rgba(0, 0, 0, 0)');
   expect(removeStyle.border).toBe('0px');
   expect(removeStyle.radius).toBe('0px');
   expect(removeStyle.right).toBeGreaterThanOrEqual(8);
   expect(removeStyle.top).toBeGreaterThanOrEqual(8);
   await removeAudio.click();
   await expect(audio).toHaveCount(0);
   await page.reload();
   await expect(page.getByRole('region',{name:'Quick audio widget',exact:true})).toHaveCount(0);

   await page.getByRole('button',{name:'Add widget',exact:true}).click();
   const picker=page.getByRole('dialog',{name:'Add widget',exact:true});
   await picker.getByRole('button',{name:'Quick audio',exact:true}).click();
   await expect(page.getByRole('region',{name:'Quick audio widget',exact:true})).toBeVisible();
  });
 }

 test('widgets can be dragged into a new order and retain that order',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await openHome(page,'home-widget-order');
  const audio=page.getByRole('region',{name:'Quick audio widget',exact:true});
  const actions=page.getByRole('region',{name:'Quick Create widget',exact:true});
  await audio.dragTo(actions);
  const order=await page.locator('.home-widget').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  expect(order[0]).toBe('Quick audio widget');
  await page.reload();
  await expect(page.locator('.home-dashboard')).toBeVisible();
  await expect(page.getByRole('region',{name:'Recent files',exact:true})).toBeVisible();
  const persisted=await page.locator('.home-widget').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  expect(persisted[0]).toBe('Quick audio widget');
 });
});
