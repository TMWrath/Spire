import {test,expect} from './fixtures';

test('desktop keeps a 1:3:1 workspace and returns to mobile drawers on resize',async({page})=>{
 await page.setViewportSize({width:1500,height:950});
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('owner');
 await page.getByLabel('Password',{exact:true}).fill('correct horse battery staple');
 const setup=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:setup?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.locator('.context')).toBeVisible();
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeHidden();
 const check=async()=>{
  const widths=await page.locator('.workspace').evaluate(el=>Array.from(el.children).filter(n=>n.matches('.sidebar,.main,.context')).map(n=>n.getBoundingClientRect().width));
  expect(widths).toHaveLength(3);
  expect(widths[0]).toBeCloseTo(300,0);expect(widths[1]).toBeCloseTo(900,0);expect(widths[2]).toBeCloseTo(300,0);
 };
 await check();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Reliquary settings'})).toBeVisible();
 await check();
 await page.getByRole('button',{name:'Back to writing',exact:true}).click();
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 await expect(page.getByRole('region',{name:'File tasks',exact:true})).toBeVisible();
 await check();
 await page.getByRole('button',{name:'Back to files',exact:true}).click();
 // Android browsers commonly use a 980 CSS-pixel viewport for Desktop site.
 await page.setViewportSize({width:980,height:900});
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeHidden();
 await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.locator('.context')).toBeVisible();
 const phoneDesktopWidths=await page.locator('.workspace').evaluate(el=>Array.from(el.children).filter(n=>n.matches('.sidebar,.main,.context')).map(n=>n.getBoundingClientRect().width));
 expect(phoneDesktopWidths).toHaveLength(3);
 expect(phoneDesktopWidths[0]).toBeCloseTo(196,0);expect(phoneDesktopWidths[1]).toBeCloseTo(588,0);expect(phoneDesktopWidths[2]).toBeCloseTo(196,0);
 await page.setViewportSize({width:390,height:900});
 await expect(page.getByRole('button',{name:'Toggle folders',exact:true})).toBeVisible();
 await expect(page.locator('.context')).toHaveCount(0);
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Toggle folders',exact:true}).click();
 await expect(page.locator('.sidebar')).toBeVisible();
});
