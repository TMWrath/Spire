import {type Locator} from '@playwright/test';
export async function selectDropdown(trigger:Locator,option:string|{label:string}){
 const root=trigger.locator('..');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 const row=typeof option==='string'?root.locator('[role="option"][data-value='+JSON.stringify(option)+']'):root.getByRole('option',{name:option.label,exact:true});
 await row.click();
}
