import {test,expect} from '@playwright/test';
test.beforeEach(async({request})=>{await request.post('/__test/reset');});
import {randomUUID} from 'node:crypto';
test('storage settings use four plain sections without server administration controls',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('storage'+randomUUID().slice(0,8));
 await page.getByLabel('Password',{exact:true}).fill(randomUUID());
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const panel=page.getByRole('tabpanel',{name:'Storage',exact:true});
 await expect(panel.locator(':scope > section > h2')).toHaveText(['Local storage','Server storage','Backup export','Imports']);
 await expect(panel.locator('details')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Move Reliquary',exact:true})).toHaveCount(0);
 await expect(panel).not.toContainText('Docker');
 await expect(panel.getByRole('button',{name:'Export recovery data'})).toBeVisible();
 await expect(panel.getByLabel('Import Vault ZIP')).toBeAttached();
 await page.setViewportSize({width:390,height:844});
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
