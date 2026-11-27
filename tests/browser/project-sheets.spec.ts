import {test,expect} from '@playwright/test';
import {emptyOverview} from '../../shared/project-overview';

test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test('Projects swipes to a centered sheet and opens its existing Overview',async({page,request})=>{
 const path='/api/project-overview/Ember/background';
 expect((await request.get(path)).status()).toBe(401);
 const auth=await page.request.post('/api/setup',{headers:{origin:'http://127.0.0.1:4179'},data:{username:'tester',password:'disposable-test-password',reliquary:'Projects test'}});
 expect(auth.ok()).toBeTruthy();
 const {csrf}=await auth.json();const headers={'x-csrf-token':csrf,origin:'http://127.0.0.1:4179'};
 for(const name of ['Atlas','Ember','Fieldwork'])expect((await page.request.post('/api/folders',{headers,data:{path:`Projects/${name}`}})).ok()).toBeTruthy();
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
 expect((await page.request.put('/api/project-overview/Ember',{headers,data:{...emptyOverview('Ember Overview'),background:`data:image/png;base64,${png}`,content:'<p>Overview-only text</p>'}})).ok()).toBeTruthy();
 expect(await (await page.request.get(path)).body()).toEqual(Buffer.from(png,'base64'));
 expect((await page.request.get('/api/project-overview/Atlas/background')).status()).toBe(204);
 await page.goto('/');await page.getByRole('button',{name:'Toggle folders'}).click();await page.getByRole('tab',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'Toggle folders'}).click();
 const rail=page.getByRole('region',{name:'Projects carousel'});const ember=rail.getByRole('button',{name:'Ember',exact:true});
 await expect(rail.getByRole('button')).toHaveCount(3);await expect(rail).not.toContainText('Overview-only text');
 const box=(await rail.boundingBox())!;const cdp=await page.context().newCDPSession(page);const y=Math.round(box.y+box.height/2);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:325,y}]});
 for(let x=310;x>=55;x-=15)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(async()=>{const r=(await ember.boundingBox())!;return Math.abs(r.x+r.width/2-box.x-box.width/2);}).toBeLessThan(2);
 const r=(await ember.boundingBox())!;expect(Math.abs(r.y+r.height/2-box.y-box.height/2)).toBeLessThan(2);expect(Math.abs(r.height-r.width*11/8)).toBeLessThan(1);
 await expect(ember.locator('img')).toHaveAttribute('data-loaded','true');await ember.tap();
 await expect(page.getByRole('heading',{name:'Ember Overview',exact:true})).toBeVisible();await expect(rail).toHaveCount(0);
 await page.getByRole("button",{name:"Back to Projects"}).tap();await expect(rail).toBeVisible();await expect(ember).toHaveCount(1);
});
