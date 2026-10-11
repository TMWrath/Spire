import {selectDropdown} from './dropdown';
import {test,expect} from './fixtures';
for(const touch of [false,true])test.describe(touch?'touch quick actions':'desktop quick actions',()=>{
 test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});
 test('settings CRUD, ordering, template creation, unique names and persistence',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('actions-tester');await page.getByLabel('Password',{exact:true}).fill('disposable-actions-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Manage quick actions',exact:true}).click();await expect(page.getByRole('tab',{name:'Actions',exact:true})).toHaveAttribute('aria-selected','true');
 const template=page.getByLabel('Action template');
 await expect(template).toHaveClass(/source-type-trigger/);
 await expect(template).toHaveCSS('background-color','rgb(24, 24, 24)');
 await template.click();await expect(page.getByRole('listbox',{name:'Action template'})).toBeVisible();await page.keyboard.press('Escape');await expect(template).toBeFocused();
 await template.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Home');await page.keyboard.press('Enter');await expect(template).toContainText('Blank file');
 await template.click();await page.getByLabel('Button label',{exact:true}).click();await expect(page.getByRole('listbox',{name:'Action template'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add action',exact:true})).toHaveCSS('background-color','rgb(26, 26, 26)');
 await page.getByLabel('Action destination folder').focus();
 await expect(page.getByLabel('Action destination folder')).toHaveCSS('outline-color','rgb(136, 136, 136)');
 const add=async(label:string,pattern:string)=>{await page.getByLabel('Button label',{exact:true}).fill(label);await page.getByLabel('Action destination folder').fill('Writing/Journal');await page.getByLabel('Default name pattern').fill(pattern);await selectDropdown(page.getByLabel('Action template'),'journal');await page.getByRole('button',{name:'Add action',exact:true}).click();await expect(page.getByRole('button',{name:'Edit '+label,exact:true})).toBeVisible();};
 await add('Daily entry','Entry');await add('Ideas','Idea');await page.getByRole('button',{name:'Move Ideas up',exact:true}).click();await expect(page.locator('.quick-action-row').first()).toContainText('Ideas');
 await page.getByRole('button',{name:'Edit Daily entry',exact:true}).click();await page.getByLabel('Button label').fill('New journal');await page.getByRole('button',{name:'Save action',exact:true}).click();await expect(page.getByRole('button',{name:'Edit New journal',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Remove Ideas',exact:true}).click();await expect(page.getByRole('button',{name:'Edit Ideas',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Back to writing',exact:true}).click();const actionButton=page.locator('.quick-action-tiles button');await expect(actionButton).toHaveCount(1);await expect(actionButton).toHaveClass(/quick-action-button/);await expect(actionButton).toHaveCSS('background-color','rgb(24, 24, 24)');await expect(actionButton).toHaveCSS('border-top-style','dashed');await expect(actionButton.locator('.quick-action-icon')).toBeVisible();await expect(actionButton.locator('.quick-action-chevron')).toBeVisible();const actionBox=await actionButton.boundingBox(),manageButton=page.getByRole('button',{name:'Manage quick actions',exact:true});await expect(manageButton).toHaveCSS('border-top-style','solid');const manageBox=await manageButton.boundingBox();expect(actionBox).not.toBeNull();expect(manageBox).not.toBeNull();expect(actionBox!.height).toBeGreaterThanOrEqual(68);expect(actionBox!.height).toBeLessThan(90);expect(manageBox!.width).toBeLessThan(actionBox!.width);
 if(touch)await page.locator('.quick-action-tiles button').tap();else await page.locator('.quick-action-tiles button').click();await expect(page.getByLabel('File path',{exact:true})).toHaveValue('Writing/Journal/Entry.md');await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source')).toHaveValue(/# Journal/);
 await page.reload();await expect(page.locator('.quick-action-tiles button')).toHaveCount(1);await page.locator('.quick-action-tiles button').click();await expect(page.getByLabel('File path',{exact:true})).toHaveValue('Writing/Journal/Entry-2.md');
 const snapshot=await page.request.get('/api/snapshot');const data=await snapshot.json();expect(data.notes).toHaveLength(2);expect(data.quickActions).toHaveLength(1);expect(data.folders).toContain('Writing/Journal');expect(data.notes.every((n:any)=>n.templateIds.includes('journal'))).toBe(true);
 });
});
