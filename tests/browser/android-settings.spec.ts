import {test,expect} from './fixtures';
for(const android of [false,true])test(`integrated app settings ${android?'Android bridge':'ordinary browser'}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 if(android)await page.addInitScript(()=>{
  (window as any).appRequests=[];
  (window as any).SpireApp={postMessage(action:string){(window as any).appRequests.push(action);if(action==='info')queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({version:'0.1.1',server:'https://spire.example'})}));},onmessage:null};
 });
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('app-tester');await page.getByLabel('Password',{exact:true}).fill('disposable-app-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const tab=page.getByRole('tab',{name:'Android app',exact:true});
 if(!android){await expect(tab).toHaveCount(0);return;}
 await expect(tab).toBeVisible();await tab.click();
 await expect(page.getByText('Spire for Android · 0.1.1',{exact:true})).toBeVisible();
 await expect(page.getByText('https://spire.example',{exact:true})).toBeVisible();
 for(const [label,action] of [['Reload','reload'],['Print / Save PDF','print'],['Server connection','connection'],['About','about']]){await page.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>page.evaluate(()=> (window as any).appRequests.at(-1))).toBe(action);}
 await expect(page.getByRole('tabpanel',{name:'Android app'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
