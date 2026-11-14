import {test,expect} from './fixtures';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

const base='examples/showcase/vault';
const out='/tmp/spire-desktop-gallery';
function walk(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(root,e.name)):[join(root,e.name)]);}

test('capture comprehensive Spire desktop gallery',async({page})=>{
  mkdirSync(out,{recursive:true});
  await page.setViewportSize({width:1500,height:1050});
  await page.goto('/');
  await page.getByLabel('Username',{exact:true}).fill('showcase');
  await page.getByLabel('Password',{exact:true}).fill('sample-workspace-password');
  await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  const me=await(await page.request.get('/api/me')).json();
  const headers={Origin:'http://127.0.0.1:4179','X-CSRF-Token':me.csrf};
  const files=walk(base);
  const folders=[...new Set(files.map(f=>dirname(relative(base,f))).flatMap(p=>p.split('/').map((_,i,a)=>a.slice(0,i+1).join('/'))))].sort((a,b)=>a.split('/').length-b.split('/').length);
  for(const path of folders)expect((await page.request.post('/api/folders',{headers,data:{path}})).ok()).toBeTruthy();
  const fieldJournalId=randomUUID();
  for(const f of files){
    const path=relative(base,f);
    const response=path.endsWith('.md')
      ?await page.request.post('/api/mutate',{headers,data:{op:randomUUID(),id:path==='Writing/Field journal.md'?fieldJournalId:randomUUID(),base:0,path,content:readFileSync(f,'utf8'),deleted:false}})
      :await page.request.post('/api/attachments?path='+encodeURIComponent(path),{headers:{...headers,'Content-Type':'application/octet-stream'},data:readFileSync(f)});
    expect(response.ok(),await response.text()).toBeTruthy();
  }
  const journal=`# November 13, 2026\n\n## Today\nThe gallery workspace came together one careful detail at a time.\n\n## On my mind\nGood tools should feel calm, private, and dependable.\n\n## Looking ahead\nRefine the desktop experience and prepare the public introduction.\n`;
  expect((await page.request.post('/api/folders',{headers,data:{path:'Journal'}})).ok()).toBeTruthy();
  expect((await page.request.post('/api/mutate',{headers,data:{op:randomUUID(),id:randomUUID(),base:0,path:'Journal/2026-11-13.md',content:journal,deleted:false}})).ok()).toBeTruthy();
  await page.evaluate(async()=>{
    const me=await(await fetch('/api/me')).json();
    const h={'Content-Type':'application/json','X-CSRF-Token':me.csrf};
    const project=await fetch('/api/projects',{method:'POST',headers:h,body:JSON.stringify({name:'Lantern Trail'})}); if(!project.ok&&project.status!==409)throw Error('project setup failed');
    const tasks=[
      {id:'11111111-1111-4111-8111-111111111111',title:'Finalize the field guide layout',done:false,priority:'urgent',dueDate:'2026-11-15'},
      {id:'22222222-2222-4222-8222-222222222222',title:'Review trail photography',done:false,priority:'high',dueDate:'2026-11-18'},
      {id:'33333333-3333-4333-8333-333333333333',title:'Polish accessibility notes',done:false,priority:'medium',dueDate:'2026-11-22'},
      {id:'44444444-4444-4444-8444-444444444444',title:'Prepare launch screenshots',done:false,priority:'high',dueDate:'2026-11-25'},
      {id:'55555555-5555-4555-8555-555555555555',title:'Define the visual direction',done:true,priority:'high',dueDate:'2026-11-08'},
      {id:'66666666-6666-4666-8666-666666666666',title:'Create the project workspace',done:true,priority:'low',dueDate:'2026-11-09'}
    ];
    const groups=[
      {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Editorial',color:'#a78bfa',members:['task:'+tasks[0].id,'task:'+tasks[2].id,'task:'+tasks[4].id]},
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Visuals',color:'#38bdf8',members:['task:'+tasks[1].id,'task:'+tasks[3].id,'task:'+tasks[5].id]}
    ];
    const board=await fetch('/api/project-tasks/Lantern%20Trail',{method:'PUT',headers:h,body:JSON.stringify({revision:0,tasks,groups})}); if(!board.ok)throw Error('task setup failed');
  });
  const recent=await page.request.post('/api/workspace/fields',{headers,data:{expected:{recentFiles:[]},changes:{recentFiles:[fieldJournalId]}}});
  expect(recent.ok(),await recent.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  await expect(page.locator('.recent-file-card')).toContainText('Field journal');
  await page.evaluate(()=>document.fonts.ready);
  const shot=async(name:string)=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${name}.png`,fullPage:false});};

  await shot('01-home-dashboard');
  await page.locator('.recent-file-card').click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.getByRole('navigation',{name:'Files',exact:true}).getByText('Writing',{exact:true}).click();
  await shot('02-files-and-folders');
  await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('Where the light settles');
  await expect.poll(()=>page.locator('.document-editor img').first().evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBeTruthy();
  await shot('03-rich-editor');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await shot('04-markdown-source-editor');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.locator('.recent-file-card').click();
  await page.getByRole('tab',{name:'Journal',exact:true}).click();
  await shot('05-journal-library');
  await page.locator('#sidebar-journal').getByTitle('Journal/2026-11-13.md',{exact:true}).click();
  await page.getByRole('button',{name:'Editor',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('Good tools should feel calm');
  await shot('06-journal-entry');
  if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
  await page.getByRole('tab',{name:'Projects',exact:true}).click();
  await shot('07-projects-workspace');
  const project=page.getByRole('region',{name:'Project Lantern Trail',exact:true});
  await project.getByRole('button',{name:'Overview',exact:true}).click();
  await expect(page.getByLabel('File path',{exact:true})).toHaveValue('Projects/Lantern Trail/overview.html');
  await shot('08-project-overview');
  if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
  await page.getByRole('tab',{name:'Projects',exact:true}).click();
  await page.getByRole('region',{name:'Project Lantern Trail',exact:true}).getByRole('button',{name:'Tasks',exact:true}).click();
  const done=page.getByRole('region',{name:'Done',exact:true});
  await done.getByRole('button',{name:/Done/}).click();
  await expect(done.locator('.project-task-card')).toHaveCount(2);
  await shot('09-project-task-board');
  await page.getByRole('region',{name:'Tasks for Lantern Trail',exact:true}).getByRole('button',{name:'Calendar',exact:true}).click();
  await expect(page.getByRole('region',{name:'Task calendar for Lantern Trail'}).getByRole('heading',{name:'November 2026'})).toBeVisible();
  await shot('10-project-calendar');
});
