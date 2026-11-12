import {test,expect} from './fixtures';

const tasks=[
 {id:'11111111-1111-4111-8111-111111111111',title:'Define the product vision and success metrics',done:false,priority:'high',dueDate:'2026-11-18'},
 {id:'22222222-2222-4222-8222-222222222222',title:'Create responsive wireframes for the dashboard',done:false,priority:'urgent',dueDate:'2026-11-15'},
 {id:'33333333-3333-4333-8333-333333333333',title:'Build reusable task card components',done:false,priority:'high',dueDate:'2026-11-22'},
 {id:'44444444-4444-4444-8444-444444444444',title:'Add keyboard navigation and accessibility labels',done:false,priority:'medium',dueDate:'2026-11-25'},
 {id:'55555555-5555-4555-8555-555555555555',title:'Prepare launch notes and product screenshots',done:false,priority:'medium',dueDate:'2026-11-28'},
 {id:'66666666-6666-4666-8666-666666666666',title:'Review the first design concepts',done:true,priority:'high',dueDate:'2026-11-10'},
 {id:'77777777-7777-4777-8777-777777777777',title:'Set up the project workspace',done:true,priority:'low',dueDate:'2026-11-08'},
 {id:'88888888-8888-4888-8888-888888888888',title:'Agree on the initial feature scope',done:true,priority:'medium',dueDate:'2026-11-09'},
] as const;
const groups=[
 {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Design',color:'#a78bfa',members:['task:'+tasks[0].id,'task:'+tasks[1].id,'task:'+tasks[5].id]},
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Engineering',color:'#38bdf8',members:['task:'+tasks[2].id,'task:'+tasks[3].id,'task:'+tasks[6].id]},
 {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Launch',color:'#f59e0b',members:['task:'+tasks[4].id,'task:'+tasks[7].id]},
];
for(const viewport of [{name:'mobile',width:390,height:1800},{name:'desktop',width:1440,height:1000}])test(`capture task manager ${viewport.name}`,async({page})=>{
 await page.setViewportSize({width:viewport.width,height:viewport.height});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await page.evaluate(async({tasks,groups})=>{const me=await(await fetch('/api/me')).json();const headers={'Content-Type':'application/json','X-CSRF-Token':me.csrf};await fetch('/api/projects',{method:'POST',headers,body:JSON.stringify({name:'Aurora Launch'})});await fetch('/api/project-tasks/Aurora%20Launch',{method:'PUT',headers,body:JSON.stringify({revision:0,tasks,groups})});},{tasks,groups});
 await page.reload();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await page.getByRole('tab',{name:'Projects',exact:true}).click();
 await page.getByRole('region',{name:'Project Aurora Launch',exact:true}).getByRole('button',{name:'Tasks',exact:true}).click();
 await expect(page.getByText('Aurora Launch · Tasks',{exact:true})).toBeVisible();
 const done=page.getByRole('region',{name:'Done',exact:true});
 await done.getByRole('button',{name:/Done · 3/}).click();
 await expect(done.locator('.project-task-card')).toHaveCount(3);
 await expect(page.getByText('Design',{exact:true}).first()).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`artifacts/task-manager-${viewport.name}.png`,fullPage:true});
});
