import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';

async function openLetterDocument(page:any){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill('editor-zoom');
 await page.getByLabel('Password',{exact:true}).fill('disposable-editor-zoom-password');
 await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();
 const folders=page.getByRole('button',{name:'Toggle folders',exact:true});
 if(await folders.getAttribute('aria-expanded')!=='true')await folders.click();
 await expect(page.getByRole('button',{name:'Create',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create from file'});
 await dialog.getByRole('button',{name:/New file/}).click();
 await dialog.getByRole('button',{name:/New blank file/}).click();
 await page.getByLabel('File name',{exact:true}).fill('Editor zoom');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');
 await page.getByLabel('New folder path').fill('Writing');
 await page.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await page.getByLabel('Markdown source',{exact:true}).fill('---\nspire_page:\n  header:\n    enabled: true\n    text: Running header\n  footer:\n    enabled: true\n    text: Running footer\n  footnotes:\n    enabled: false\n    text: ""\n  toc:\n    enabled: false\n    text: ""\n---\n<!-- spire:header -->\nRunning header\n<!-- /spire:header -->\n\nZoom belongs to this Letter page.\n\n'+('Stable pagination and chrome. '.repeat(180))+'\n\n<!-- spire:footer -->\nRunning footer\n<!-- /spire:footer -->');
 await page.getByRole('button',{name:'Editor',exact:true}).click();
 await expect(page.locator('.document-editor.letter-paginated')).toBeVisible();
}

test('browser viewport is locked while ctrl-wheel zooms only the Letter canvas',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await openLetterDocument(page);
 const canvas=page.locator('.canvas.editor');
 const letter=page.locator('.document-editor.letter-paginated');
 const app=page.locator('.app');
 const before=await app.boundingBox();
 const pages=await page.locator('.letter-page-sheet').count();
 expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('user-scalable=no');
 await expect(letter).toHaveAttribute('data-editor-zoom','1.000');
 const box=(await letter.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+120);
 await page.keyboard.down('Control');await page.mouse.wheel(0,-300);await page.keyboard.up('Control');
 await expect.poll(async()=>Number(await letter.getAttribute('data-editor-zoom'))).toBeGreaterThan(1);
 expect(await page.locator('.letter-page-sheet').count()).toBe(pages);
 expect(await app.boundingBox()).toEqual(before);
 expect(await page.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}))).toEqual({width:1280,height:900,scrollWidth:1280,scrollHeight:900});
 expect(await canvas.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
});

test('a two-touch editor gesture changes editor zoom around the pinch midpoint without scaling app chrome',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 const canvas=page.locator('.canvas.editor');
 const letter=page.locator('.document-editor.letter-paginated');
 const sheet=page.locator('.letter-page-sheet').first();
 const header=page.locator('.app>header');
 const before=await header.boundingBox();
 const sheetBefore=(await sheet.boundingBox())!;
 const pinch={x:sheetBefore.x+sheetBefore.width*.72,y:sheetBefore.y+Math.min(250,sheetBefore.height*.3)};
 const contentPoint={x:.72,y:(pinch.y-sheetBefore.y)/sheetBefore.height};
 await letter.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:pinch.x-40,clientY:pinch.y},{identifier:2,clientX:pinch.x+40,clientY:pinch.y}]});
 await letter.dispatchEvent('touchmove',{touches:[{identifier:1,clientX:pinch.x-80,clientY:pinch.y},{identifier:2,clientX:pinch.x+80,clientY:pinch.y}]});
 await letter.dispatchEvent('touchend',{touches:[]});
 await expect.poll(async()=>Number(await letter.getAttribute('data-editor-zoom'))).toBeGreaterThan(1);
 const sheetAfter=(await sheet.boundingBox())!;
 expect(Math.abs(sheetAfter.x+sheetAfter.width*contentPoint.x-pinch.x)).toBeLessThan(3);
 expect(Math.abs(sheetAfter.y+sheetAfter.height*contentPoint.y-pinch.y)).toBeLessThan(3);
 expect(await header.boundingBox()).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 expect(await canvas.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
});

test('mobile editing bar matches the raised central microphone reference',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 const letter=page.locator('.document-editor.letter-paginated');
 const footer=page.locator('.main footer');
 const actions=page.getByLabel('Editing actions',{exact:true});
 const zoom=actions.locator('.workspace-zoom-value');
 const microphone=actions.getByRole('button',{name:'Start dictation',exact:true});
 await expect(actions).toBeVisible();
 await expect(zoom).toBeVisible();
 await expect(microphone).toBeVisible();
 await expect(actions.getByRole('button',{name:'Paste from clipboard',exact:true})).toBeVisible();
 await expect(actions.getByRole('button',{name:'Cut selection',exact:true})).toBeVisible();
 await expect(page.locator('.editor-topbar').getByRole('button',{name:'Start dictation',exact:true})).toHaveCount(0);
 await expect(page.locator('.workspace-status')).toHaveCount(0);
 await expect(footer.locator(':scope > *')).toHaveCount(2);
 expect(await footer.locator(':scope > *').evaluateAll(nodes=>nodes.map(node=>node.textContent?.trim()))).toEqual([
  expect.stringMatching(/Revision|Unsaved changes|pending sync/),
  expect.stringMatching(/\d+ words/),
 ]);
 const geometry=await actions.evaluate(bar=>{const box=bar.getBoundingClientRect();const mic=bar.querySelector('.live-dictation-toggle')!.getBoundingClientRect();return {radius:getComputedStyle(bar).borderRadius,border:getComputedStyle(bar).borderTopWidth,barTop:box.top,barHeight:box.height,micTop:mic.top,micWidth:mic.width,micHeight:mic.height};});
 expect(parseFloat(geometry.radius)).toBeGreaterThanOrEqual(20);
 expect(geometry.border).toBe('1px');
 expect(geometry.micTop).toBeLessThan(geometry.barTop);
 expect(Math.abs(geometry.micWidth-geometry.micHeight)).toBeLessThan(1);
 expect(geometry.micWidth).toBeGreaterThanOrEqual(64);
 await expect(actions.locator('.mobile-edit-label')).toHaveCount(0);
 await expect(zoom).toHaveAccessibleName('Zoom in to 200%');
 await expect(zoom.locator('.lucide-zoom-in')).toBeVisible();
 const editor=letter.locator('.ProseMirror');
 await editor.click({position:{x:220,y:320}});
 const caretAnchor=await page.evaluate(()=>{const selection=getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null,caret=range?.getBoundingClientRect(),sheets=Array.from(document.querySelectorAll<HTMLElement>('.letter-page-sheet')),sheet=caret?sheets.find(element=>{const rect=element.getBoundingClientRect();return caret.top>=rect.top&&caret.top<=rect.bottom;}):undefined,rect=sheet?.getBoundingClientRect();return caret&&rect?{clientX:caret.left,clientY:caret.top,page:sheets.indexOf(sheet!),x:(caret.left-rect.left)/rect.width,y:(caret.top-rect.top)/rect.height}:null;});
 expect(caretAnchor).not.toBeNull();
 await zoom.click();
 await expect(zoom).toHaveAccessibleName('Zoom out to 100%');
 await expect(zoom.locator('.lucide-zoom-out')).toBeVisible();
 await expect(letter).toHaveAttribute('data-editor-zoom','2.000');
 const anchoredPoint=await page.locator('.letter-page-sheet').nth(caretAnchor!.page).evaluate((sheet,anchor)=>{const rect=sheet.getBoundingClientRect();return {x:rect.left+rect.width*anchor.x,y:rect.top+rect.height*anchor.y};},caretAnchor!);
 expect(Math.abs(anchoredPoint.x-caretAnchor!.clientX)).toBeLessThan(4);
 expect(Math.abs(anchoredPoint.y-caretAnchor!.clientY)).toBeLessThan(4);
 await expect(page.getByRole('dialog',{name:'Adjust zoom',exact:true})).toHaveCount(0);
 await zoom.click();
 await expect(zoom).toHaveAccessibleName('Zoom in to 200%');
 await expect(zoom.locator('.lucide-zoom-in')).toBeVisible();
 await expect(letter).toHaveAttribute('data-editor-zoom','1.000');
});

test('mobile editor tools can collapse and reopen without hiding the toggle',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 const toolbar=page.getByRole('toolbar',{name:'Editor formatting',exact:true});
 await expect(toolbar).toBeVisible();
 await page.getByRole('button',{name:'Hide editing tools',exact:true}).click();
 await expect(toolbar).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Show editing tools',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Show editing tools',exact:true}).click();
 await expect(toolbar).toBeVisible();
});

test('top sync button animates only while synchronization is active',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/me',async route=>{await held;await route.continue();},{times:1});
 const sync=page.getByRole('button',{name:'Sync now',exact:true});
 await sync.click();
 await expect(sync).toHaveClass(/sync-active/);
 release();
 await expect(sync).not.toHaveClass(/sync-active/);
});

test('mobile Context writing controls zoom to the cursor at 200 percent',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 const editor=page.locator('.document-editor.letter-paginated .ProseMirror');
 await editor.click({position:{x:72,y:90}});
 await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 await page.getByRole('tab',{name:'Writing',exact:true}).click();
 await page.getByRole('button',{name:'Zoom to cursor 200%',exact:true}).click();
 await expect(page.locator('.document-editor.letter-paginated')).toHaveAttribute('data-editor-zoom','2.000');
 await expect(page.locator('.workspace-zoom-value')).toHaveAccessibleName('Zoom out to 100%');
 await expect(page.locator('.workspace-zoom-value .lucide-zoom-out')).toBeVisible();
});

test('header and footer section controls remain centered in the editor viewport while the page pans',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openLetterDocument(page);
 const canvas=page.locator('.canvas.editor');
 const letter=page.locator('.document-editor.letter-paginated');
 const dock=page.locator('.page-section-dock');
 await expect(dock).toBeVisible();
 const box=(await letter.boundingBox())!;
 await letter.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:box.x+110,clientY:300},{identifier:2,clientX:box.x+210,clientY:300}]});
 await letter.dispatchEvent('touchmove',{touches:[{identifier:1,clientX:box.x+50,clientY:300},{identifier:2,clientX:box.x+270,clientY:300}]});
 await letter.dispatchEvent('touchend',{touches:[]});
 await expect.poll(async()=>Number(await letter.getAttribute('data-editor-zoom'))).toBeGreaterThan(1);
 const assertDock=async()=>{
  const viewport=(await canvas.boundingBox())!,controls=(await dock.boundingBox())!;
  expect(Math.abs((controls.x+controls.width/2)-(viewport.x+viewport.width/2))).toBeLessThan(3);
  expect(controls.x).toBeGreaterThanOrEqual(viewport.x-1);
  expect(controls.x+controls.width).toBeLessThanOrEqual(viewport.x+viewport.width+1);
 };
 await assertDock();
 await canvas.evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=Math.min(el.scrollHeight-el.clientHeight,600);});
 await page.waitForTimeout(50);
 await assertDock();
});