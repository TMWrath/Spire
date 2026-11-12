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
  test(`widgets form a contained mosaic and visibility persists at ${viewport.width}px`,async({page})=>{
   await page.setViewportSize(viewport);
   await openHome(page,`home-widgets-${viewport.width}`);
   const dashboard=page.locator('.home-dashboard');
   const box=await dashboard.boundingBox();
   expect(box).not.toBeNull();
   expect(await dashboard.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
   await page.getByRole('button',{name:'Customize Home',exact:true}).click();
   const manager=page.getByRole('dialog',{name:'Customize Home',exact:true});
   await manager.getByLabel('Quick audio').uncheck();
   await manager.getByRole('button',{name:'Done',exact:true}).click();
   await expect(page.getByRole('region',{name:'Quick audio',exact:true})).toHaveCount(0);
   await page.reload();
   await expect(page.getByRole('region',{name:'Quick audio',exact:true})).toHaveCount(0);
   await page.getByRole('button',{name:'Customize Home',exact:true}).click();
   await page.getByRole('dialog',{name:'Customize Home',exact:true}).getByLabel('Quick audio').check();
   await page.getByRole('dialog',{name:'Customize Home',exact:true}).getByRole('button',{name:'Done',exact:true}).click();
   await expect(page.getByRole('region',{name:'Quick audio',exact:true})).toBeVisible();
  });
 }
});
