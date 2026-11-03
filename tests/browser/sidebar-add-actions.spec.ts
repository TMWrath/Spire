import {test,expect} from './fixtures';

for(const touch of [false,true])test.describe(touch?'touch contextual sidebar Add':'desktop contextual sidebar Add',()=>{
 test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});
 test('Add follows the active Tags, Templates and Sources tab',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Username',{exact:true}).fill(`sidebaradd${touch?'touch':'desktop'}`);
  await page.getByLabel('Password',{exact:true}).fill('disposable-sidebar-add-password');
  await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  const sidebar=page.locator('.sidebar');
  const reveal=async()=>{if(!await sidebar.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();};

  await reveal();
  await sidebar.getByRole('tab',{name:'Tags',exact:true})[touch?'tap':'click']();
  await expect(sidebar.getByRole('button',{name:'Create',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
  await page.getByLabel('Quick note text',{exact:true}).fill('A file for contextual tag creation.');
  await page.getByRole('button',{name:'Add quick note',exact:true}).click();
  await expect(page.getByLabel('File path',{exact:true})).toBeVisible();

  await reveal();
  await sidebar.getByRole('tab',{name:'Tags',exact:true})[touch?'tap':'click']();
  await sidebar.getByRole('button',{name:'Create',exact:true}).click();
  await expect(page.getByLabel('Tag name',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();

  await reveal();
  await sidebar.getByRole('tab',{name:'Templates',exact:true})[touch?'tap':'click']();
  await sidebar.getByRole('button',{name:'Create',exact:true}).click();
  await expect(page.getByLabel('Template editor',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Template title',{exact:true})).toHaveValue('Untitled template');
  await page.getByRole('button',{name:'Close template',exact:true}).click();

  await reveal();
  await sidebar.getByRole('tab',{name:'Sources',exact:true})[touch?'tap':'click']();
  await sidebar.getByRole('button',{name:'Create',exact:true}).click();
  await expect(page.getByLabel('New source',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Source title',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to writing',exact:true}).click();
 });
});
