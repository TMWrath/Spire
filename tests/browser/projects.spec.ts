import {test,expect} from './fixtures';

const credentials={username:'owner',password:'correct horse battery staple'};

async function login(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(credentials.username);
 await page.getByLabel('Password',{exact:true}).fill(credentials.password);
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
}

test('Projects is a dedicated workspace and newly created projects stay out of Files',async({page})=>{
 await login(page);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('tab',{name:'Projects',exact:true}).click();
 const projects=page.getByRole('region',{name:'Projects',exact:true});
 await expect(projects).toBeVisible();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const projectCreate=page.getByRole('dialog',{name:'Create from file'});
 await expect(projectCreate.getByRole('button',{name:/New project/})).toBeVisible();
 await expect(projectCreate.getByRole('button',{name:/New file/})).toHaveCount(0);
 await projectCreate.getByRole('button',{name:/New project/}).click();
 await projects.getByLabel('Project name').fill('Atlas');
 await projects.getByLabel('Project color').fill('#247acf');
 await projects.getByRole('button',{name:'Create',exact:true}).click();
 const atlas=page.getByRole('region',{name:'Project Atlas',exact:true});
 await expect(atlas.getByRole('button',{name:'Select project Atlas',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(atlas).toHaveCSS('border-left-color','rgb(36, 122, 207)');
 await atlas.getByRole('button',{name:'Edit project Atlas',exact:true}).click();
 await page.getByLabel('Edit project name').fill('Atlas Revised');
 await page.getByLabel('Edit project color').fill('#cf8799');
 await page.getByRole('dialog',{name:'Edit project Atlas'}).getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('region',{name:'Project Atlas Revised',exact:true})).toHaveCSS('border-left-color','rgb(207, 135, 153)');
 await page.getByRole('tab',{name:'Files',exact:true}).click();
 await expect(page.getByRole('region',{name:'Projects',exact:true})).toHaveCount(0);
 await expect(page.locator('nav').getByText('Atlas',{exact:true})).toHaveCount(0);
 await page.evaluate(async()=>{
  for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
  await caches.delete('spire-shell-v1');
 });
 await page.reload();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const projectsTab=page.getByRole('tab',{name:'Projects',exact:true});
 if(!await projectsTab.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 if(!await projectsTab.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await expect(projectsTab).toBeVisible();
 await projectsTab.click();
 await expect(page.getByRole('region',{name:'Project Atlas Revised',exact:true})).toBeVisible();
});
