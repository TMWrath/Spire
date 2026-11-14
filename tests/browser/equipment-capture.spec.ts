import {test,expect} from './fixtures';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const base='examples/showcase/vault';
function walk(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(root,e.name)):[join(root,e.name)]);}
test('capture equipment table on desktop and mobile',async({page})=>{
 await page.setViewportSize({width:1500,height:1050});await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('showcase');await page.getByLabel('Password',{exact:true}).fill('sample-workspace-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 const me=await(await page.request.get('/api/me')).json();const headers={Origin:'http://127.0.0.1:4179','X-CSRF-Token':me.csrf};
 const files=walk(base),folders=[...new Set(files.map(f=>dirname(relative(base,f))).flatMap(p=>p.split('/').map((_,i,a)=>a.slice(0,i+1).join('/'))))].sort((a,b)=>a.split('/').length-b.split('/').length);
 for(const path of folders){const res=await page.request.post('/api/folders',{headers,data:{path}});expect(res.ok()).toBeTruthy();}
 for(const f of files){const path=relative(base,f);const res=path.endsWith('.md')?await page.request.post('/api/mutate',{headers,data:{op:randomUUID(),id:randomUUID(),base:0,path,content:readFileSync(f,'utf8'),deleted:false}}):await page.request.post('/api/attachments?path='+encodeURIComponent(path),{headers:{...headers,'Content-Type':'application/octet-stream'},data:readFileSync(f)});expect(res.ok(),await res.text()).toBeTruthy();}
 const image=await page.request.get('/api/attachment?path=Attachments/lantern-lake.png');expect(image.headers()['content-type']).toContain('image/png');
 const audio=await page.request.get('/api/attachment?path=Attachments/lantern-chime.mp3');expect(audio.headers()['content-type']).toContain('audio/mpeg');
 expect(await page.evaluate(async()=>{const c=new AudioContext();try{const b=await(await fetch('/api/attachment?path=Attachments/lantern-chime.mp3')).arrayBuffer();return (await c.decodeAudioData(b)).duration;}finally{await c.close();}})).toBeGreaterThan(2);
 await page.reload();await expect(page.locator('.sidebar')).toBeVisible();
 mkdirSync('/tmp/spire-equipment-screenshots',{recursive:true});
 await page.getByText('Reference',{exact:true}).click();
 await page.getByRole('button',{name:'Equipment table',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('A lighter pack');
 await expect(page.locator('.document-editor table')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'/tmp/spire-equipment-screenshots/desktop-equipment-table.png'});
 await page.setViewportSize({width:390,height:844});if(await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true}).click();await expect(page.locator('.sidebar')).not.toBeVisible();await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toBeVisible();await page.screenshot({path:'/tmp/spire-equipment-screenshots/mobile-equipment-table.png'});
});
