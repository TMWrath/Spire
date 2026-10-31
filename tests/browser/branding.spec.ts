import {test,expect} from '@playwright/test';

test('approved Spire artwork is wired to browser, Apple and PWA icons', async({page,request})=>{
 await page.goto('/');
 await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','/spire-icon-32.png');
 await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/spire-icon-180.png');
 const response=await request.get('/manifest.webmanifest');expect(response.ok()).toBeTruthy();
 const manifest=await response.json();expect(manifest.icons.map((icon:any)=>icon.sizes)).toEqual(['192x192','512x512']);
 for(const icon of manifest.icons){
  const asset=await request.get(icon.src);expect(asset.ok()).toBeTruthy();expect(asset.headers()['content-type']).toContain('image/png');
  const dimensions=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return `${image.naturalWidth}x${image.naturalHeight}`;},icon.src);
  expect(dimensions).toBe(icon.sizes);
 }
 const legacy=await request.get('/icon.svg');expect(legacy.ok()).toBeTruthy();expect(await legacy.text()).toContain('data:image/png;base64,');
});
