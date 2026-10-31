import {test,expect} from './fixtures';
import {selectDropdown} from './dropdown';

test('contents pages stay headerless while every manuscript page repeats its header and footer',async({page})=>{
 await page.setViewportSize({width:1600,height:1000});await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('page-chrome');await page.getByLabel('Password',{exact:true}).fill('disposable-page-password');await page.getByRole('button',{name:await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible()?'Create Reliquary':'Sign in',exact:true}).click();
 const folders=page.getByRole('button',{name:'Toggle folders',exact:true});if(await folders.getAttribute('aria-expanded')!=='true')await folders.click();await expect(page.getByRole('button',{name:'Create',exact:true})).toBeVisible();await page.getByRole('button',{name:'Create',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Create from file'});await dialog.getByRole('button',{name:/New file/}).click();await dialog.getByRole('button',{name:/New blank file/}).click();await page.getByLabel('File name',{exact:true}).fill('Page chrome');await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Writing');await page.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();const source=page.getByLabel('Markdown source');const body=Array.from({length:85},(_,index)=>`# Chapter ${index}\n\n${'Long manuscript prose. '.repeat(30)}`).join('\n\n');await source.fill(`---\nspire_page:\n  header:\n    enabled: true\n    text: MY RUNNING HEADER\n  footer:\n    enabled: true\n    text: MY RUNNING FOOTER\n  footnotes:\n    enabled: false\n    text: ''\n  toc:\n    enabled: true\n    text: ''\n---\n<!-- spire:header -->\nMY RUNNING HEADER\nSecond header line\nThird header line\nFourth header line\n<!-- /spire:header -->\n\n${body}\n\n<!-- spire:footer -->\nMY RUNNING FOOTER\n<!-- /spire:footer -->`);await page.getByRole('button',{name:'Editor',exact:true}).click();
 await expect.poll(()=>page.locator('.letter-page-sheet').count()).toBeGreaterThan(2);await expect(page.locator('.front-matter-page').first()).toBeVisible();expect(await page.locator('.front-matter-page .letter-running-header,.front-matter-page .letter-running-footer').count()).toBe(0);
 const count=await page.locator('.letter-page-sheet').count();const desktopSurface=await page.locator('.document-writing-surface').evaluate(el=>({width:el.clientWidth,text:el.textContent}));const headers=page.locator('.letter-running-header'),footers=page.locator('.letter-running-footer');await expect(headers).toHaveCount(count);await expect(footers).toHaveCount(count);await expect(headers.first()).toBeVisible();await expect(footers.first()).toBeVisible();await expect(headers.first()).toContainText('MY RUNNING HEADER');await expect(headers.first()).toContainText('Fourth header line');expect(await headers.first().textContent()).toBe('MY RUNNING HEADER\nSecond header line\nThird header line\nFourth header line');await expect(headers.first()).toHaveCSS('overflow','visible');const headerBox=(await headers.first().boundingBox())!,surfaceBox=(await page.locator('.document-writing-surface').boundingBox())!;expect(headerBox.y+headerBox.height).toBeLessThanOrEqual(surfaceBox.y);await expect(footers.first()).toContainText('MY RUNNING FOOTER');await expect(page.locator('.letter-page-sheets')).toHaveCSS('z-index','0');await expect(page.locator('.document-writing-surface')).toHaveCSS('z-index','1');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.letter-page-sheet')).toHaveCount(count);await expect(headers.first()).toBeVisible();await expect(footers.first()).toBeVisible();const mobileSheet=await page.locator('.letter-page-sheet').first().boundingBox(),mobileSurface=await page.locator('.document-writing-surface').boundingBox();expect(mobileSheet).not.toBeNull();expect(mobileSurface).not.toBeNull();expect(mobileSheet!.height/mobileSheet!.width).toBeCloseTo(11/8.5,2);expect(mobileSurface!.x).toBeGreaterThanOrEqual(mobileSheet!.x-1);expect(mobileSurface!.x+mobileSurface!.width).toBeLessThanOrEqual(mobileSheet!.x+mobileSheet!.width+1);await expect(page.locator('.document-writing-surface')).toHaveCSS('transform',/matrix\(0\.[0-9]+/);expect(await page.locator('.document-writing-surface').evaluate(el=>({width:el.clientWidth,text:el.textContent}))).toEqual(desktopSurface);
 await expect(page.locator('.page-section-editor')).toHaveCount(0);
 await expect(headers.first()).toHaveAttribute('contenteditable','plaintext-only');
 await expect(footers.first()).toHaveAttribute('contenteditable','plaintext-only');
 await page.getByRole('button',{name:'Header section',exact:true}).click();
 await expect(headers.first()).toBeFocused();
 const expandedHeader=Array.from({length:14},(_,index)=>`Direct header line ${index+1}`).join('\n');
 await headers.first().fill(expandedHeader);
 await expect(headers.first()).toBeFocused();
 await expect.poll(()=>page.locator('.letter-page-sheet').count()).toBeGreaterThan(count);
 await expect.poll(async()=>page.locator('.letter-page-sheet').evaluateAll((sheets)=>sheets.every((sheet)=>{
  const page=sheet.getBoundingClientRect(),header=sheet.querySelector('.letter-running-header')?.getBoundingClientRect(),footer=sheet.querySelector('.letter-running-footer')?.getBoundingClientRect();
  const bodyRects:Array<DOMRect>=[];const root=document.querySelector('.document-writing-surface')!;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text:Node|null;
  while((text=walker.nextNode())){if(!text.textContent?.length||text.parentElement?.closest('.letter-overflow-spacer'))continue;const range=document.createRange();range.selectNodeContents(text);bodyRects.push(...Array.from(range.getClientRects()));}
  return bodyRects.filter(rect=>rect.bottom>page.top&&rect.top<page.bottom).every(rect=>(!header||rect.top>=header.bottom-0.5)&&(!footer||rect.bottom<=footer.top+0.5));
 }))).toBe(true);
 await expect(headers.first()).toBeFocused();
 await headers.first().press('End');await headers.first().pressSequentially(' live');
 await expect(headers.first()).toContainText('Direct header line 14 live');
 await page.getByRole('button',{name:'Footer section',exact:true}).click();
 await headers.first().fill('Direct header line one\nDirect header line two');
 await expect.poll(async()=>headers.evaluateAll(elements=>elements.map(element=>(element as HTMLElement).innerText))).toEqual(Array(await page.locator('.letter-page-sheet').count()).fill('Direct header line one\nDirect header line two'));
 await page.getByRole('button',{name:'Footer section',exact:true}).click();
 await expect(footers.first()).toBeFocused();
 await footers.first().fill('');
 await expect(footers.first()).toBeVisible();
 const footerBaseline=await page.locator('.letter-page-sheet').count();
 const expandedFooter=Array.from({length:14},(_,index)=>`Direct footer line ${index+1}`).join('\n');
 await footers.first().fill(expandedFooter);
 await expect(footers.first()).toBeFocused();
 await expect.poll(()=>page.locator('.letter-page-sheet').count()).toBeGreaterThan(footerBaseline);
 await expect.poll(async()=>page.locator('.letter-page-sheet').evaluateAll((sheets)=>sheets.every((sheet)=>{const page=sheet.getBoundingClientRect(),footer=sheet.querySelector('.letter-running-footer')?.getBoundingClientRect();const root=document.querySelector('.document-writing-surface')!,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),rects:Array<DOMRect>=[];let text:Node|null;while((text=walker.nextNode())){if(!text.textContent?.length||text.parentElement?.closest('.letter-overflow-spacer'))continue;const range=document.createRange();range.selectNodeContents(text);rects.push(...Array.from(range.getClientRects()));}return rects.filter(rect=>rect.bottom>page.top&&rect.top<page.bottom).every(rect=>!footer||rect.bottom<=footer.top+0.5);}))).toBe(true);
 await footers.first().fill('Direct footer');
 await expect.poll(async()=>({pages:await page.locator('.letter-page-sheet').count(),values:await footers.allTextContents()})).toEqual({pages:await page.locator('.letter-page-sheet').count(),values:Array(await page.locator('.letter-page-sheet').count()).fill('Direct footer')});
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(source).toHaveValue(/<!-- spire:header -->\nDirect header line one\nDirect header line two\n<!-- \/spire:header -->/);
 await expect(source).toHaveValue(/<!-- spire:footer -->\nDirect footer\n<!-- \/spire:footer -->/);
});