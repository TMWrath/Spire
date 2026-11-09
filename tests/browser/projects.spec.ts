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
 await projects.getByRole('button',{name:'Create project',exact:true}).click();
 await projects.getByLabel('Project name').fill('Atlas');
 await projects.getByRole('button',{name:'Create',exact:true}).click();
 await expect(projects.getByRole('button',{name:'Atlas',exact:true})).toHaveAttribute('aria-pressed','true');
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
 await expect(page.getByRole('region',{name:'Projects',exact:true}).getByRole('button',{name:'Atlas',exact:true})).toBeVisible();
});
