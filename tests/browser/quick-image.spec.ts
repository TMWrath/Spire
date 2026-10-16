import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';
test('image commands open immediately, cancel without mutation, replace captured ranges and round-trip alignment',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('imagewriter');await page.getByLabel('Password',{exact:true}).fill('disposable-image-password');await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New file'}).click();await page.getByLabel('File name',{exact:true}).fill('Images');await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Writing/Nested');await page.getByRole('button',{name:'Create file',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Document editor',exact:true});
 const image={name:'snow 雪 (1).png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};
 for(const [code,alignment] of [['img',''],['imgl','left'],['imgc','center'],['imgr','right']]){
  await editor.click();await editor.press('ControlOrMeta+A');await editor.press('Backspace');await editor.pressSequentially('before @'+code);const picker=page.waitForEvent('filechooser');await editor.pressSequentially(' ');const chooser=await picker;
  await expect(editor).toHaveText('before @'+code);await chooser.setFiles(image);await expect(editor.locator('img')).toHaveCount(1);await expect(editor).not.toContainText('@'+code);
  if(alignment)await expect(editor.locator('div[align]')).toHaveAttribute('align',alignment);
  await page.getByRole('button',{name:'Source',exact:true}).click();const source=page.getByLabel('Markdown source',{exact:true});const value=await source.inputValue();expect(value).toContain('before');expect(value).toContain('../../Attachments/');expect(value).toContain('%E9%9B%AA');if(alignment)expect(value).toContain('align="'+alignment+'"');else expect(value).toContain('![');
  await page.getByRole('button',{name:'Editor',exact:true}).click();await expect(editor.locator('img')).toHaveCount(1);if(alignment)await expect(editor.locator('div[align]')).toHaveAttribute('align',alignment);
 }
 await editor.fill('keep @img');const picker=page.waitForEvent('filechooser');await editor.pressSequentially(' ');await picker;await page.getByLabel('Choose image',{exact:true}).dispatchEvent('cancel');await expect(editor).toHaveText('keep @img');
 await editor.fill('stale @img');const stale=page.waitForEvent('filechooser');await editor.pressSequentially(' ');const chooser=await stale;await editor.fill('changed');await chooser.setFiles(image);await expect(editor).toHaveText('changed');await expect(editor.locator('img')).toHaveCount(0);
 await editor.fill('saved @imgc');const savePicker=page.waitForEvent('filechooser');await editor.pressSequentially(' ');await (await savePicker).setFiles(image);await expect(editor.locator('img')).toHaveCount(1);await page.getByRole('button',{name:'Save file',exact:true}).click();await expect(page.locator('footer')).toContainText(/Revision \d+/);await page.reload();await page.getByRole('region',{name:'Recent files'}).getByRole('button').filter({hasText:'Images'}).first().click();await expect(editor.locator('div[align="center"] img')).toHaveCount(1);
});
