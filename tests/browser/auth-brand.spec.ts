import {test,expect} from './fixtures';

test('authentication screen centers the Spire mark and name above the form',async({page})=>{
 await page.setViewportSize({width:412,height:915});
 await page.goto('/');
 const brand=page.locator('.auth-brand');
 await expect(brand).toBeVisible();
 await expect(brand.locator('img[src="/spire-mark-192.png"]')).toBeVisible();
 await expect(brand.getByText('Spire',{exact:true})).toBeVisible();
 const geometry=await brand.evaluate(el=>{
  const box=el.getBoundingClientRect();
  const image=el.querySelector('img')!.getBoundingClientRect();
  const text=el.querySelector('span')!.getBoundingClientRect();
  return {center:box.left+box.width/2,viewport:innerWidth/2,imageCenter:image.left+image.width/2,textCenter:text.left+text.width/2};
 });
 expect(Math.abs(geometry.center-geometry.viewport)).toBeLessThan(1);
 expect(Math.abs(geometry.imageCenter-geometry.viewport)).toBeLessThan(1);
 expect(Math.abs(geometry.textCenter-geometry.viewport)).toBeLessThan(1);
});

test('desktop authentication content uses the same card surface as Home sections',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const auth=page.locator('.auth');
 await expect(auth).toBeVisible();
 const surface=await auth.evaluate(el=>{
  const style=getComputedStyle(el);
  const box=el.getBoundingClientRect();
  return {
   background:style.backgroundColor,
   borderColor:style.borderTopColor,
   borderWidth:style.borderTopWidth,
   radius:style.borderTopLeftRadius,
   shadow:style.boxShadow,
   center:box.left+box.width/2,
   viewport:innerWidth/2,
  };
 });
 expect(surface.background).toBe('rgb(24, 24, 24)');
 expect(surface.borderColor).toBe('rgb(54, 54, 54)');
 expect(surface.borderWidth).toBe('1px');
 expect(surface.radius).toBe('16px');
 expect(surface.shadow).not.toBe('none');
 expect(Math.abs(surface.center-surface.viewport)).toBeLessThan(1);
});
