import {test,expect} from '@playwright/test';
import {readdirSync} from 'node:fs';

for(const width of [390,673,1440]) test(`independent folder and tag branches at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const leaf=(name:string)=>`<div class="tree-file-row">${name}</div>`;
 const folder=(name:string,body:string)=>`<details data-folder="${name}" open><summary>${name}</summary>${body}</details>`;
 const tag=(name:string)=>`<details open><summary>${name}</summary><button class="library-file">Quartz</button><button class="library-file">Slate</button></details>`;
 await page.setContent(`<div class="mount-tree"><nav>${folder('Aster',folder('Petals',leaf('Amber'))+leaf('Fern'))}${folder('Lumen',leaf('Glow'))}${leaf('Flat')}</nav></div><section id="sidebar-tags">${tag('Minerals')}${tag('Colours')}</section>`);
 await page.addStyleTag({path:'dist/assets/'+readdirSync('dist/assets').find(f=>/^index-.*\.css$/.test(f))});
 const box=async(selector:string)=>(await page.locator(selector).boundingBox())!;
 const root='[data-folder=Aster]',sub='[data-folder=Petals]',last=root+' > .tree-file-row';
 const style=(selector:string,pseudo:string,prop:string)=>page.locator(selector).evaluate((e,[p,k])=>getComputedStyle(e,p).getPropertyValue(k),[pseudo,prop]);
 expect((await box(sub)).x-(await box(root)).x).toBe(22);
 expect((await box(sub+' > div')).x-(await box(sub)).x).toBe(22);
 expect(await style(sub,'::after','height')).toBe((await box(sub)).height+'px');
 expect(await style(last,'::before','height')).toBe((await box(last)).height/2+'px');
 for(const sel of [root,'[data-folder=Lumen]','nav > div',last])expect(await style(sel,'::after','content')).toBe('none');
 const tagLast='#sidebar-tags details:first-child button:last-child';
 expect(await style(tagLast,'::before','height')).toBe((await box(tagLast)).height/2+'px');
 for(const [summary,child,neighbor] of [[root+' > summary',last,'[data-folder=Lumen] > div'],['#sidebar-tags summary >> nth=0',tagLast,'#sidebar-tags details:last-child button:last-child']]){
  await page.locator(summary).click();await expect(page.locator(child)).toBeHidden();await expect(page.locator(neighbor)).toBeVisible();
  await page.locator(summary).click();await expect(page.locator(child)).toBeVisible();
 }
});
