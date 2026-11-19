import {test,expect} from './fixtures';
import {randomUUID} from 'node:crypto';
import {selectDropdown} from './dropdown';

async function setup(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('create'+randomUUID().slice(0,8));
 await page.getByLabel('Password',{exact:true}).fill(randomUUID());
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
}

test('Add File offers direct normal creation without generation actions',async({page})=>{
 await setup(page);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create from file',exact:true});
 await expect(dialog.getByRole('button',{name:/^New file/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/^New folder/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/Audio Note/})).toBeVisible();
 for(const label of ['New blank file','From PDF','From Word','From OpenDocument','From audio'])await expect(dialog.getByRole('button',{name:new RegExp(label)})).toHaveCount(0);
 await dialog.getByRole('button',{name:/^New file/}).click();
 await expect(page.getByRole('dialog',{name:'Create file',exact:true})).toBeVisible();
 await page.getByLabel('File name',{exact:true}).fill('Normal file');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await expect(page.getByLabel('File path',{exact:true})).toHaveValue('Writing/Normal file.md');
});

test('Add File folder cancellation remains unchanged',async({page})=>{
 await setup(page);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/^New folder/}).click();
 const folder=page.getByRole('dialog',{name:'Create folder'});
 await expect(folder).toBeVisible();
 await folder.getByRole('button',{name:'Cancel'}).click();
 await expect(folder).toHaveCount(0);
});
