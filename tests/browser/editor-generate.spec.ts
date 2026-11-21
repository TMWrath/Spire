import {selectDropdown} from './dropdown';
import {test,expect} from './fixtures';

function pdf(){const stream='BT /F1 12 Tf 50 750 Td (Generated PDF text.) Tj ET',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let out='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(out));out+=`${index+1} 0 obj\n${object}\nendobj\n`;});const start=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(out);}

test('Generate offers only import actions and preserves the open draft',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('generate-editor');
 await page.getByLabel('Password',{exact:true}).fill('disposable-generate-password');
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const create=page.getByRole('dialog',{name:'Create from file'});
 await expect(create.getByRole('button',{name:/From PDF/})).toHaveCount(0);
 await create.getByRole('button',{name:/New file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('Generated draft');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();

 const editor=page.getByRole('textbox',{name:'Document editor',exact:true});
 await editor.fill('Keep this unsaved writing');
 for(const [width,height] of [[390,844],[673,375],[844,390],[1024,768],[1280,800]]){
  await page.setViewportSize({width,height});
  if(await page.locator('.sidebar-backdrop').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
  const rail=page.locator('.editor-tabs');
  const generate=page.getByRole('region',{name:'Generate file content'});
  const before=(await rail.boundingBox())!;
  await rail.getByRole('button',{name:'Generate',exact:true}).click();
  const after=(await rail.boundingBox())!, panel=(await generate.boundingBox())!;
  expect(after.y).toBeCloseTo(before.y,0);
  expect(panel.y).toBeGreaterThanOrEqual(after.y+after.height-1);
  expect(await page.locator('.main').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(generate.locator('.create-file-options > button')).toHaveCount(4);
  for(const mode of ['Source','Split','Editor'])await rail.getByRole('button',{name:mode,exact:true}).click();
  await rail.getByRole('button',{name:'Generate',exact:true}).click();
 }
 await expect(editor).toHaveText('Keep this unsaved writing');
});

test('Generate converts a selected PDF into the current draft after confirmation',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('generate-pdf');
 await page.getByLabel('Password',{exact:true}).fill('disposable-generate-password');
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('PDF draft');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Document editor',exact:true});
 await editor.fill('Replace this text');
 await page.getByRole('button',{name:'Generate',exact:true}).click();
 const generate=page.getByRole('region',{name:'Generate file content'});
 page.once('dialog',dialog=>dialog.accept());
 const chooser=page.waitForEvent('filechooser');
 await generate.getByRole('button',{name:/From PDF/}).click();
 await (await chooser).setFiles({name:'source.pdf',mimeType:'application/pdf',buffer:pdf()});
 await expect(editor).toContainText('Generated PDF text.',{timeout:30000});
});
