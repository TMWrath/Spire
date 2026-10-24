import {test,expect} from './fixtures';

test('mobile Back asks before leaving Spire from Home',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.goto('data:text/html,<h1>Before Spire</h1>');
 await page.goto('http://127.0.0.1:4179/');
 await page.getByLabel('Username',{exact:true}).fill('mobile-exit');
 await page.getByLabel('Password',{exact:true}).fill('disposable-mobile-exit-password');
 await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
 const homeUrl=page.url();
 page.once('dialog',async dialog=>{expect(dialog.message()).toBe('Exit Spire?');await dialog.dismiss();});
 await page.goBack();
 await expect(page).toHaveURL(homeUrl);
 page.once('dialog',async dialog=>{expect(dialog.message()).toBe('Exit Spire?');await dialog.accept();});
 await page.goBack();
 await expect(page).toHaveURL(/^data:text\/html/);
 await context.close();
});
