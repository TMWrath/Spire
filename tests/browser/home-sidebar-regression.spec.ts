import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';

const credentials={username:'owner',password:'correct horse battery staple'};

async function login(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(credentials.username);
 await page.getByLabel('Password',{exact:true}).fill(credentials.password);
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
}

test('Home remains available and sidebar Add and Trash share the bottom action row',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 const add=page.getByRole('button',{name:'Create',exact:true});
 const trash=page.locator('.sidebar-actions').getByRole('button',{name:'Trash',exact:true});
 await expect(add).toBeVisible();
 await expect(trash).toBeVisible();
 const [sidebarBox,addBox,trashBox]=await Promise.all([page.locator('.sidebar').boundingBox(),add.boundingBox(),trash.boundingBox()]);
 expect(sidebarBox&&addBox&&trashBox).toBeTruthy();
 expect(Math.abs(addBox!.y-trashBox!.y)).toBeLessThanOrEqual(2);
 expect(addBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x);
 expect(trashBox!.x+trashBox!.width).toBeLessThanOrEqual(sidebarBox!.x+sidebarBox!.width);
 expect(addBox!.y+addBox!.height).toBeLessThanOrEqual(sidebarBox!.y+sidebarBox!.height);
});

test('mobile sidebar has explicit close routes and opening a file reveals the editor',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await login(page);
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 const sidebar=page.locator('.sidebar');
 await expect(sidebar).toBeVisible();
 await page.locator('.sidebar-mobile-head').getByRole('button',{name:'Close folders',exact:true}).click();
 await expect(sidebar).toBeHidden();
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();

 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create from file'});
 await dialog.getByRole('button',{name:/New file/}).click();
 await dialog.getByRole('button',{name:/New blank file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('Mobile editor');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await expect(sidebar).toBeHidden();
 await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your writing lives here.',exact:true})).toBeVisible();
});
