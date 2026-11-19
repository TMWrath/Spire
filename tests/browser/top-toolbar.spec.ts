import {test,expect} from './fixtures';
import {randomUUID} from 'node:crypto';

for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 test(`top toolbar has no Create plus; sidebar creation and Calendar remain available at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.getByLabel('Username',{exact:true}).fill('toolbar'+randomUUID().slice(0,8));
  await page.getByLabel('Password',{exact:true}).fill(randomUUID());
  await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
  const header=page.locator('.app > header');
  await expect(header.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  await expect(header.getByRole('button',{name:/create/i})).toHaveCount(0);
  await expect(header.locator('svg.lucide-plus')).toHaveCount(0);
  await expect(header.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
  if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
  await page.getByRole('button',{name:'Create',exact:true}).click();
  const create=page.getByRole('dialog',{name:'Create from file',exact:true});
  await expect(create.getByRole('button',{name:/^New folder/})).toBeVisible();
  await create.getByRole('button',{name:/^New file/}).click();
  await expect(page.getByLabel('File name',{exact:true})).toBeVisible();
  await page.getByRole('dialog',{name:'Create file',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
  await header.getByRole('button',{name:'Calendar',exact:true}).click();
  await expect(header.getByRole('button',{name:'Home',exact:true})).toBeVisible();
  await expect(header.getByRole('button',{name:'Calendar',exact:true})).toHaveCount(0);
  await header.getByRole('button',{name:'Home',exact:true}).click();
  await expect(header.getByRole('button',{name:'Calendar',exact:true})).toBeVisible();
  await page.screenshot({path:`artifacts/top-toolbar-${viewport.width}.png`});
 });
}
