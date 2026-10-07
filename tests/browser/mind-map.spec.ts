import {test,expect} from './fixtures';
test('home mind map demo settings persist without creating files and respects reduced motion',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:/^(Create Reliquary|Sign in)$/}).click();
 const map=page.getByRole('region',{name:'Reliquary mind map'});await expect(map).toBeVisible();await expect(map.locator('.mind-node')).toHaveCount(0);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').check();await page.getByRole('button',{name:'Back to writing'}).click();await expect(map.getByText('Demo data',{exact:true})).toBeVisible();await expect(map.locator('.mind-node')).toHaveCount(28);await expect(map.locator('canvas.mind-surface')).toHaveAttribute('data-motion','animated');
 await map.getByLabel('Select a file in the map').selectOption({label:'The Observatory'});await expect(map.getByRole('button',{name:'Open file'})).toHaveCount(0);await expect(map.getByText('Demonstration only — no files are created.')).toBeVisible();
 await page.reload();await expect(map.locator('.mind-node')).toHaveCount(28);await page.emulateMedia({reducedMotion:'reduce'});await expect(map.locator('canvas.mind-surface')).toHaveAttribute('data-motion','static');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/mind-map-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/mind-map-desktop.png'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').uncheck();await page.getByRole('button',{name:'Back to writing'}).click();await expect(map.locator('.mind-node')).toHaveCount(0);
});

test('3D orbit and pan survive rapid release and cancellation without blanking the app',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('tester');await page.getByLabel('Password',{exact:true}).fill('disposable-test-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Mind map',exact:true}).click();await page.getByLabel('Show demo data').check();await page.getByRole('button',{name:'Back to writing'}).click();
 const map=page.getByRole('region',{name:'Reliquary mind map'}),surface=map.locator('.mind-surface');
 const initial=await surface.getAttribute('data-rotation');
 const bounds=(await surface.boundingBox())!;for(let i=0;i<12;i++){await page.mouse.move(bounds.x+15,bounds.y+15);await page.mouse.down();await page.mouse.move(bounds.x+65+i*4,bounds.y+60+i*2,{steps:3});if(i%2===0)await surface.dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();}
 await expect(surface).not.toHaveAttribute('data-rotation',initial!);await expect(map.locator('.mind-node')).toHaveCount(28);expect(errors).toEqual([]);
 await map.getByRole('button',{name:'Fit map'}).click();await expect(surface).toHaveAttribute('data-rotation',initial!);
 await expect(map.getByRole('button',{name:/Switch to (pan|orbit)/})).toHaveCount(0);const box=(await surface.boundingBox())!;await page.mouse.move(box.x+15,box.y+15);await page.mouse.down({button:'middle'});await page.mouse.move(box.x+80,box.y+65,{steps:12});await page.mouse.up({button:'middle'});
 await expect(surface).toHaveAttribute('data-rotation','1,0,0,0,1,0,0,0,1');await expect(surface).not.toHaveAttribute('data-pan','0,0');await expect(map).toBeVisible();expect(errors).toEqual([]);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-180);await expect.poll(async()=>Number(await surface.getAttribute('data-zoom'))).toBeGreaterThan(1);
 await map.getByRole('button',{name:'Fit map'}).click();await expect(surface).toHaveAttribute('data-zoom','1.0000');await expect(surface).toHaveAttribute('data-pan','0,0');
 await surface.focus();await page.keyboard.press('ArrowRight');await expect(surface).not.toHaveAttribute('data-rotation','1,0,0,0,1,0,0,0,1');await page.keyboard.press('Home');await expect(surface).toHaveAttribute('data-rotation','1,0,0,0,1,0,0,0,1');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
