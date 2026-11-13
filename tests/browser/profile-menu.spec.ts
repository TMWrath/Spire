import {expect,test,type Page} from '@playwright/test';

async function signIn(page:Page,username:string){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(username);
 await page.getByLabel('Password',{exact:true}).fill('disposable-profile-password');
 await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Profile',exact:true})).toBeVisible();
}

for(const width of [390,673,1280])test(`profile owns session controls and Settings has no Privacy tab at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:850});
 const username='profile-owner';
 await signIn(page,username);
 const profile=page.getByRole('button',{name:'Profile',exact:true});
 const header=page.locator('.app > header');
 await expect.poll(async()=>{
  const button=await profile.boundingBox(),bar=await header.boundingBox();
  return button&&bar?Math.round(bar.x+bar.width-(button.x+button.width)):null;
 }).toBeLessThanOrEqual(20);
 await profile.click();
 const menu=page.getByRole('dialog',{name:'Profile'});
 await expect(menu).toBeVisible();
 await expect.poll(async()=>menu.evaluate(element=>{
  const box=element.getBoundingClientRect();
  const hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
  return Boolean(hit&&(hit===element||element.contains(hit)));
 })).toBe(true);
 await expect(menu).toContainText(username);
 await expect(menu).not.toContainText('Browser session');
 await expect(menu).not.toContainText('This device:');
 await expect.poll(async()=>menu.evaluate(element=>Math.round(element.getBoundingClientRect().width))).toBe(220);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Privacy',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Credits',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'About',exact:true}).click();
 const about=page.getByRole('tabpanel',{name:'About',exact:true});
 await expect(about).toContainText('Privacy & server data');
 await expect(about).toContainText('Whistle speech-to-text model');
 await expect(about.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
 await profile.click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
 const signedOutProfile=page.getByRole('button',{name:'Profile',exact:true});
 await expect(signedOutProfile).toBeVisible();
 await expect.poll(async()=>{
  const button=await signedOutProfile.boundingBox();
  return button?Math.round(width-(button.x+button.width)):null;
 }).toBe(14);
 await signedOutProfile.click();
 const signedOutMenu=page.getByRole('dialog',{name:'Profile'});
 await expect(signedOutMenu).toBeVisible();
 await expect(signedOutMenu.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
