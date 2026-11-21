import {test,expect} from './fixtures';
for(const touch of [false,true])test.describe(touch?'mobile external map search':'desktop external map search',()=>{
 test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});
 test('search is below and outside the clean map and still highlights matching files',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').check();await page.getByRole('button',{name:'Back to writing'}).click();const sidebar=page.locator('.sidebar');if(!await sidebar.isVisible())await page.getByRole('button',{name:'Toggle folders',exact:true})[touch?'tap':'click']();
  const map=sidebar.getByRole('region',{name:'Reliquary mind map'}),surface=map.locator('canvas'),search=sidebar.getByLabel('Find a file in the map');
  await expect(map.locator('.mind-heading,.mind-status,.mind-tools,.mind-legend')).toHaveCount(0);await expect(map.getByLabel('Find a file in the map')).toHaveCount(0);await expect(search).toBeVisible();await expect(search).toHaveCount(1);await expect(map.getByLabel('Select a file in the map')).toBeVisible();
  const mapBox=(await map.boundingBox())!,searchBox=(await search.boundingBox())!,tabsBox=(await sidebar.getByRole('tab',{name:'General',exact:true}).boundingBox())!;expect(searchBox.y).toBeGreaterThanOrEqual(mapBox.y+mapBox.height);expect(searchBox.y+searchBox.height).toBeLessThanOrEqual(tabsBox.y);
  await search.fill('Observatory');await expect(surface).toHaveAttribute('data-matches','1');await search.fill('nothing-matches-this');await expect(surface).toHaveAttribute('data-matches','0');await search.fill('');await expect(surface).toHaveAttribute('data-matches','28');
  for(const tab of ['Tags','Templates','General']){await sidebar.getByRole('tab',{name:tab,exact:true})[touch?'tap':'click']();await expect(search).toBeVisible();await expect(map.getByLabel('Find a file in the map')).toHaveCount(0);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:`artifacts/sidebar-map-search-${touch?'mobile':'desktop'}.png`});
 });
});
