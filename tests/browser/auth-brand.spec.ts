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
