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
 await page.setViewportSize({width:390,height:900});
 await login(page);
 await expect(page.getByRole('tab',{name:'Tasks',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Files',exact:true}).click();
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 const collection=page.getByRole('region',{name:'File tasks',exact:true});
 await expect(collection).toBeVisible();
 await expect(page.getByText('Open a file from the sidebar to begin.',{exact:true})).toHaveCount(0);
 await expect(collection.getByLabel('New task',{exact:true})).toBeInViewport();
 await expect(collection).toHaveClass(/project-tasks-page/);
 await expect(page.locator('.sidebar')).toBeHidden();
 await expect(collection.getByRole('button',{name:'Back to files',exact:true})).toBeVisible();
 await expect(collection.getByPlaceholder('What needs to be done?')).toBeVisible();
 await expect(collection.getByRole('status')).toContainText('complete');
 await expect(collection.getByLabel('New task deadline',{exact:true})).toBeVisible();
 await expect(collection.getByRole('button',{name:'Link file',exact:true})).toBeVisible();
 await expect(collection.getByRole('button',{name:'Group tasks',exact:true})).toBeVisible();
 await collection.getByLabel('New task',{exact:true}).fill('Draft scene');
 await collection.getByRole('button',{name:'Add task',exact:true}).click();
 const checkbox=collection.getByRole('checkbox',{name:'Complete Draft scene',exact:true});
 await expect(checkbox).toBeVisible();
 await expect(collection.getByLabel('Task title Draft scene',{exact:true})).toBeVisible();
 await expect(collection.getByRole('button',{name:'Link file for Draft scene',exact:true})).toBeVisible();
 await collection.getByRole('button',{name:'Link file for Draft scene',exact:true}).click();
 await page.getByRole('dialog',{name:'Link file',exact:true}).getByRole('button',{name:'Link existing',exact:true}).click();
 const link=page.getByRole('dialog',{name:'Link existing file',exact:true});
 await link.getByRole('radio',{name:'Tasks/Tasks.md',exact:true}).check();
 await link.getByRole('button',{name:'Link file',exact:true}).click();
 await expect(collection.getByRole('button',{name:'Unlink file for Draft scene',exact:true})).toBeVisible();
 await collection.getByLabel('Deadline for Draft scene',{exact:true}).fill('2026-12-20');
 await expect(collection.getByLabel('Deadline for Draft scene',{exact:true})).toHaveValue('2026-12-20');
 await collection.getByRole('button',{name:'Back to files',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 await expect(collection.getByLabel('Deadline for Draft scene',{exact:true})).toHaveValue('2026-12-20');
 await expect(collection.getByRole('button',{name:'Unlink file for Draft scene',exact:true})).toBeVisible();
 await expect(collection.getByRole('button',{name:'Delete task Draft scene',exact:true})).toBeVisible();
 await checkbox.click();
 await expect(collection.getByRole('checkbox',{name:'Complete Draft scene',exact:true})).toBeChecked();
 await collection.getByRole('button',{name:'Open file for Draft scene',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/# Tasks\n\n- \[x\] Draft scene/);
});

test('each project has its own nested gallery and purpose tags persist without copying images',async({page})=>{
 await login(page);
 await expect(page.getByRole('tab',{name:'Gallery',exact:true})).toHaveCount(0);
 const atlas=await createProject(page,'Atlas');
 await page.setViewportSize({width:390,height:900});
 const sectionRail=atlas.getByRole('toolbar',{name:'Atlas sections',exact:true});
 await expect(sectionRail).toBeVisible();
 const sectionButtons=sectionRail.getByRole('button');
 await expect(sectionButtons).toHaveCount(3);
 await expect(sectionButtons.nth(0)).toHaveAccessibleName('Overview');
 await expect(sectionButtons.nth(1)).toHaveAccessibleName('Tasks');
 await expect(sectionButtons.nth(2)).toHaveAccessibleName('Gallery for Atlas');
 const boxes=await Promise.all([0,1,2].map(index=>sectionButtons.nth(index).boundingBox()));
 expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x);
 expect(boxes[2]!.x).toBeGreaterThan(boxes[1]!.x);
 expect(Math.abs(boxes[0]!.y-boxes[1]!.y)).toBeLessThan(2);
 expect(Math.abs(boxes[1]!.y-boxes[2]!.y)).toBeLessThan(2);
 await expect(sectionRail).toHaveCSS('overflow-x','auto');
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
