import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';
for(const mobile of [false,true])test(`visual sections ${mobile?'mobile':'desktop'}`,async({page})=>{
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const fileMenu=page.getByRole('menu',{name:'File add options'});
 await expect(fileMenu.getByRole('menuitem',{name:'File or folder',exact:true})).toBeVisible();
 await expect(fileMenu.getByRole('menuitem',{name:'Add group',exact:true})).toBeVisible();
 await fileMenu.getByRole('menuitem',{name:'Add group',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Visual groups'})).toBeVisible();
 await page.getByRole('dialog',{name:'Visual groups'}).getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Group items in directory',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Group items in directory',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Visual groups'});await expect(dialog).toBeVisible();await expect(dialog.getByText('Grouping changes presentation only; files and folders stay in place.')).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 for(const name of ['Human','Machine','Outside']){await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'File or folder',exact:true}).click();await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New folder/}).click();const folder=page.getByRole('dialog',{name:'Create folder',exact:true});await selectDropdown(folder.getByLabel('Parent folder'),'');await folder.getByLabel('New folder path').fill(name);await folder.getByRole('button',{name:'Create folder',exact:true}).click();await expect(folder).toHaveCount(0);}
 await page.getByRole('button',{name:'Group items in directory',exact:true}).click();await dialog.getByRole('button',{name:'Add group',exact:true}).click();await dialog.getByLabel('Group name 1',{exact:true}).fill('Workshop');await dialog.getByLabel('Group color 1',{exact:true}).fill('#247acf');await dialog.getByRole('checkbox',{name:'Human',exact:true}).check();await dialog.getByRole('checkbox',{name:'Machine',exact:true}).check();await dialog.getByRole('button',{name:'Save groups',exact:true}).click();
 const workshop=page.getByRole('region',{name:'Group Workshop',exact:true});await expect(workshop.locator('[data-folder]')).toHaveCount(2);await expect(workshop.locator('[data-folder="Human"]')).toBeVisible();await expect(page.locator('[data-folder="Outside"]')).toBeVisible();await expect(workshop.locator('[data-folder="Outside"]')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();await expect(workshop.locator('[data-folder]')).toHaveCount(2);await expect(workshop).toHaveCSS('border-left-color','rgb(36, 122, 207)');const inset=await workshop.locator('.visual-section-items').first().evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft));expect(inset).toBeGreaterThanOrEqual(8);
 await page.getByRole('button',{name:'Group items in directory',exact:true}).click();await dialog.getByLabel('Group name 1',{exact:true}).fill('Discard me');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(workshop).toBeVisible();
 await page.getByRole('button',{name:'Group items in directory',exact:true}).click();await dialog.getByRole('button',{name:'Remove group',exact:true}).click();await dialog.getByRole('button',{name:'Save groups',exact:true}).click();await expect(workshop).toHaveCount(0);for(const name of ['Human','Machine','Outside'])await expect(page.locator(`[data-folder="${name}"]`)).toBeVisible();
 await page.getByRole('tab',{name:'Projects',exact:true}).click();
 for(const name of ['Section Alpha','Section Beta']){await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill(name);await page.getByRole('region',{name:'Projects',exact:true}).getByRole('button',{name:'Create',exact:true}).click();await expect(page.getByRole('region',{name:'Project '+name,exact:true})).toBeVisible();}
 await expect(page.getByRole('region',{name:'Project Section Alpha',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Group items in directory',exact:true})).toHaveCount(0);
 const a=await page.getByRole('region',{name:'Project Section Alpha',exact:true}).boundingBox(),b=await page.getByRole('region',{name:'Project Section Beta',exact:true}).boundingBox();expect(b!.y).toBeGreaterThan(a!.y);expect(Math.abs(a!.x-b!.x)).toBeLessThan(2);
 await page.getByRole('tab',{name:'Files',exact:true}).click();await expect(page.locator('[data-folder^="Projects/"]')).toHaveCount(0);
});
