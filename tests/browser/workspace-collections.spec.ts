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

async function createProject(page:any,name:string){
 await page.getByRole('tab',{name:'Projects',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New project/}).click();
 const projects=page.getByRole('region',{name:'Projects',exact:true});
 await projects.getByLabel('Project name').fill(name);
 await projects.getByRole('button',{name:'Create',exact:true}).click();
 return page.getByRole('region',{name:`Project ${name}`,exact:true});
}

test('normal file tasks live inside Files and write authoritative Markdown',async({page})=>{
 await login(page);
 await expect(page.getByRole('tab',{name:'Tasks',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Files',exact:true}).click();
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 const collection=page.getByRole('region',{name:'File tasks',exact:true});
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

test('each project has its own nested gallery and purpose tags persist without copying images',async({page})=>{
 await login(page);
 await expect(page.getByRole('tab',{name:'Gallery',exact:true})).toHaveCount(0);
 const atlas=await createProject(page,'Atlas');
 await atlas.getByRole('button',{name:'Add items to Atlas',exact:true}).click();
 await page.getByRole('dialog',{name:'Add items to Atlas'}).getByRole('button',{name:'Add file',exact:true}).click();
 const file=page.getByRole('dialog',{name:'Create file',exact:true});
 await file.getByLabel('File name',{exact:true}).fill('Gallery.md');
 await file.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Media',exact:true}).click();
 await page.getByLabel('Upload attachment',{exact:true}).setInputFiles('tests/fixtures/media/image.png');
 await page.getByRole('dialog',{name:'Prepare image',exact:true}).getByRole('button',{name:'Insert image',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/image\.png/);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('tab',{name:'Projects',exact:true}).click();
 const atlasAgain=page.getByRole('region',{name:'Project Atlas',exact:true});
 await atlasAgain.locator('button.project-tasks-link').filter({hasText:'Gallery'}).click();
 const gallery=page.getByRole('region',{name:'Gallery for Atlas',exact:true});
 await expect(gallery.locator('.gallery-card')).toHaveCount(1);
 await gallery.getByRole('button',{name:'Tag image',exact:true}).click();
 await gallery.getByLabel('Image tags',{exact:true}).fill('Concept art, Proof of work');
 await gallery.getByRole('button',{name:'Save',exact:true}).click();
 await expect(gallery.getByRole('article').getByText('Concept art',{exact:true})).toBeVisible();
 await gallery.getByRole('button',{name:'Back to Atlas',exact:true}).click();
 await atlasAgain.locator('button.project-tasks-link').filter({hasText:'Gallery'}).click();
 await expect(gallery.getByRole('article').getByText('Proof of work',{exact:true})).toBeVisible();
 await expect(gallery.locator('.gallery-card')).toHaveCount(1);
});
