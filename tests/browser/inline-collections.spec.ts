import {test,expect} from './fixtures';

for(const width of [390,673,1280]) test(`Wiki and Lists create and name rows inline at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 async function showSidebar(){if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();}
 await showSidebar();
 for(const [section,action,folder,tree] of [['Lists','Add List','Lists','List files'],['Wiki','Add Wiki','Wiki','Wiki pages']]){
  await page.getByRole('group',{name:'Files sections'}).getByRole('button',{name:section,exact:true}).click();
  await page.getByRole('button',{name:action,exact:true}).click();
  const rows=page.getByRole('navigation',{name:tree,exact:true});
  const input=rows.getByRole('textbox',{name:'New name',exact:true});
  await expect(input).toBeFocused();
  await input.fill(`Inline ${section}`);
  await input.press('Enter');
  await expect(rows.getByRole('button',{name:`Rename ${folder}/Inline ${section}.md`,exact:true})).toBeVisible();
 }
 await page.reload();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await showSidebar();
 for(const [name,folder] of [['Lists','Lists'],['Wiki','Wiki']]){
  await page.getByRole('group',{name:'Files sections'}).getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('button',{name:`Rename ${folder}/Inline ${name}.md`,exact:true})).toBeVisible();
 }
});
