import {test,expect} from './fixtures';

for(const width of [390,673,1280])test(`task numbers and reusable tags persist and filter at ${width}px`,async({page})=>{
 await page.setViewportSize({width:Math.min(width,673),height:850});await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const me=await(await fetch('/api/me')).json();const headers={'Content-Type':'application/json','X-CSRF-Token':me.csrf};await fetch('/api/projects',{method:'POST',headers,body:JSON.stringify({name:'Tagged'})});const first=crypto.randomUUID(),second=crypto.randomUUID();await fetch('/api/project-tasks/Tagged',{method:'PUT',headers,body:JSON.stringify({revision:0,tasks:[{id:first,title:'Build filters',done:false,tags:['frontend']},{id:second,title:'Repair API',done:false,tags:['backend']}],groups:[]})});});
 const open=async()=>{await page.setViewportSize({width:Math.min(width,673),height:850});await page.reload();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();const projects=page.getByRole('tab',{name:'Projects',exact:true});if(!await projects.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();await projects.click();await page.getByRole('region',{name:'Project Tagged',exact:true}).getByRole('button',{name:'Tasks',exact:true}).click();await page.setViewportSize({width,height:850});};await open();
 const todo=page.getByRole('region',{name:'To Do',exact:true});const cards=todo.locator('.project-task-card');await expect(cards).toHaveCount(2);
 await expect(cards.first().getByText(/^#\d+$/)).toBeVisible();await expect(cards.nth(1).getByText(/^#\d+$/)).toBeVisible();
 const build=todo.getByRole('article',{name:'Task Build filters'});await build.getByLabel('Tags for Build filters').fill('frontend, urgent-fix');await build.getByLabel('Tags for Build filters').blur();await expect(build.getByText('urgent-fix',{exact:true})).toBeVisible();
 await page.getByLabel('Filter tasks').fill('urgent-fix');await expect(cards).toHaveCount(1);await expect(build).toBeVisible();
 const number=(await build.locator('.task-short-id').textContent())!;await page.getByLabel('Filter tasks').fill(number);await expect(cards).toHaveCount(1);await expect(build).toBeVisible();
 await open();await expect(page.getByRole('region',{name:'To Do',exact:true}).getByText('urgent-fix',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
