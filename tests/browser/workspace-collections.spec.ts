import {test,expect} from './fixtures';

const credentials={username:'owner',password:'correct horse battery staple'};

async function login(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(credentials.username);
 await page.getByLabel('Password',{exact:true}).fill(credentials.password);
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
}

test('workspace task collection writes and toggles authoritative Markdown',async({page})=>{
 await login(page);
 await page.getByRole('tab',{name:'Tasks',exact:true}).click();
 const collection=page.getByRole('tabpanel',{name:'Tasks',exact:true});
 await expect(collection).toBeVisible();
 await collection.getByLabel('Task group',{exact:true}).fill('Today');
 await collection.getByLabel('New task',{exact:true}).fill('Draft scene');
 await collection.getByRole('button',{name:'Add',exact:true}).click();
 const checkbox=collection.getByRole('checkbox',{name:'Complete Draft scene',exact:true});
 await expect(checkbox).toBeVisible();
 await checkbox.click();
 await expect(collection.getByRole('checkbox',{name:'Reopen Draft scene',exact:true})).toBeChecked();
 await collection.getByRole('button',{name:/Draft scene/}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/## Today\n- \[x\] Draft scene/);
});

test('gallery discovers one embedded attachment and persists purpose tags without copying it',async({page})=>{
 await login(page);
 await page.getByRole('tab',{name:'Files',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const create=page.getByRole('dialog',{name:'Create from file',exact:true});
 await create.getByRole('button',{name:/New file/}).click();
 await create.getByRole('button',{name:/New blank file/}).click();
 const file=page.getByRole('dialog',{name:'Create file',exact:true});
 await file.getByLabel('File name',{exact:true}).fill('Gallery.md');
 await file.getByLabel('Save in folder',{exact:true}).click();
 await page.getByRole('option',{name:'Create new folder…',exact:true}).click();
 await file.getByLabel('New folder path',{exact:true}).fill('Writing');
 await file.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Media',exact:true}).click();
 const upload=page.getByLabel('Upload attachment',{exact:true});
 await upload.setInputFiles('tests/fixtures/media/image.png');
 await page.getByRole('dialog',{name:'Prepare image',exact:true}).getByRole('button',{name:'Insert image',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/image\.png/);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('tab',{name:'Gallery',exact:true}).click();
 const gallery=page.getByRole('tabpanel',{name:'Gallery',exact:true});
 await expect(gallery.locator('.gallery-card')).toHaveCount(1);
 await gallery.getByRole('button',{name:'Tag image',exact:true}).click();
 await gallery.getByLabel('Image tags',{exact:true}).fill('Concept art, Proof of work');
 await gallery.getByRole('button',{name:'Save',exact:true}).click();
 await expect(gallery.getByRole('article').getByText('Concept art',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Files',exact:true}).click();
 await page.getByRole('tab',{name:'Gallery',exact:true}).click();
 await expect(gallery.getByRole('article').getByText('Proof of work',{exact:true})).toBeVisible();
 await expect(gallery.locator('.gallery-card')).toHaveCount(1);
});
