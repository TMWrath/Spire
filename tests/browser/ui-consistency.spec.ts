import {test,expect} from './fixtures';
import {randomUUID} from 'node:crypto';

async function createWorkspace(page:import('@playwright/test').Page){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('ui'+randomUUID().slice(0,8));
 await page.getByLabel('Password',{exact:true}).fill(randomUUID());
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
}

for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 test(`application chrome uses one aligned control system at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await createWorkspace(page);
  const tokens=await page.locator('.app').evaluate(element=>{
   const style=getComputedStyle(element);
   return {
    control:style.getPropertyValue('--control-size').trim(),
    radius:style.getPropertyValue('--control-radius').trim(),
    gap:style.getPropertyValue('--control-gap').trim(),
    panel:style.getPropertyValue('--surface-panel').trim(),
    border:style.getPropertyValue('--line-subtle').trim(),
   };
  });
  expect(tokens).toEqual({control:'40px',radius:'6px',gap:'8px',panel:'#171717',border:'#383838'});

  const header=page.locator('.app > header');
  const buttons=header.locator('button:visible');
  const geometry=await buttons.evaluateAll(nodes=>nodes.map(node=>{
   const rect=node.getBoundingClientRect();
   const svg=node.querySelector('svg')?.getBoundingClientRect();
   return {top:Math.round(rect.top),height:Math.round(rect.height),iconWidth:svg?Math.round(svg.width):0,iconHeight:svg?Math.round(svg.height):0};
  }));
  expect(geometry.length).toBeGreaterThan(2);
  expect(new Set(geometry.map(item=>item.top)).size).toBe(1);
  for(const item of geometry){
   expect(item.height).toBe(40);
   if(item.iconWidth){expect(item.iconWidth).toBe(18);expect(item.iconHeight).toBe(18);}
  }
  const headerBox=await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.width).toBeLessThanOrEqual(viewport.width);
 });
}
