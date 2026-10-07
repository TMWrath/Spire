import {test,expect} from './fixtures';
test('home mind map demo settings persist without creating files and respects reduced motion',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:/^(Create Reliquary|Sign in)$/}).click();
 const map=page.getByRole('region',{name:'Reliquary mind map'});await expect(map).toBeVisible();await expect(map.locator('.mind-node')).toHaveCount(0);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').check();await page.getByRole('button',{name:'Back to writing'}).click();await expect(map.getByText('Demo data',{exact:true})).toBeVisible();await expect(map.locator('.mind-node')).toHaveCount(16);await expect(map.locator('animateMotion').first()).toBeAttached();
 await map.getByRole('button',{name:'Select Origin'}).click();await expect(map.getByRole('button',{name:'Open file'})).toHaveCount(0);await expect(map.getByText('Demonstration only — no files are created.')).toBeVisible();
 await page.reload();await expect(map.locator('.mind-node')).toHaveCount(16);await page.emulateMedia({reducedMotion:'reduce'});await expect(map.locator('animateMotion')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/mind-map-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/mind-map-desktop.png'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').uncheck();await page.getByRole('button',{name:'Back to writing'}).click();await expect(map.locator('.mind-node')).toHaveCount(0);
});
