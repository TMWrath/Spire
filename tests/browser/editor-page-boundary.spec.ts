import {test,expect} from './fixtures';
import {readFileSync} from 'node:fs';
const css=readFileSync('client/document-editor.css','utf8');
for(const width of [390,740,980,1600])test(`writing page boundary at ${width}px preserves content geometry`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.setContent(`<style>body{margin:0;background:#101010}.canvas{height:900px;width:100%}${css}</style><main class="canvas editor"><div class="preview document-editor"><div class="document-writing-surface" role="textbox" contenteditable="true"><p>Keep writing here.</p></div></div></main>`);
 const frame=page.locator('.document-editor'),surface=page.getByRole('textbox');
 const before=await surface.boundingBox();
 const visual=await frame.evaluate(el=>{const s=getComputedStyle(el,'::before');return {content:s.content,display:s.display,width:parseFloat(s.width),border:s.borderTopWidth,color:s.borderTopColor,pointer:s.pointerEvents,background:s.backgroundColor};});
 if(width>=760){expect(visual.content).toBe('""');expect(visual.border).toBe('1px');expect(visual.color).toBe('rgb(52, 52, 52)');expect(visual.background).toBe('rgb(20, 20, 20)');expect(visual.pointer).toBe('none');expect(visual.width).toBeLessThanOrEqual(964);}else expect(visual.content==='none'||visual.display==='none').toBeTruthy();
 // Turning off containment disables the decoration without changing the text box.
 await page.locator('.canvas').evaluate(el=>(el as HTMLElement).style.containerType='normal');
 const unframed=await surface.boundingBox();expect(before!.width).toBeCloseTo(unframed!.width,2);expect(before!.x).toBeCloseTo(unframed!.x,2);
 await page.locator('.canvas').evaluate(el=>(el as HTMLElement).style.removeProperty('container-type'));
 await surface.click();await page.keyboard.press('End');await page.keyboard.type(' Still writing.');await expect(surface).toContainText('Still writing.');
 await surface.fill(Array.from({length:90},(_,i)=>`Line ${i}`).join('\n'));
 expect((await frame.boundingBox())!.height).toBeGreaterThan(900);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`/tmp/spire-page-boundary-${width}.png`,fullPage:false});
 if(width>=760){await page.emulateMedia({media:'print'});expect(await frame.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');}
});
test('page sections share one outline and narrow desktop panes remain unframed',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.setContent(`<style>body{margin:0}.canvas{height:900px;width:100%}${css}</style><main class="canvas editor"><div class="page-document"><section class="page-section"><div class="document-editor"><div class="document-writing-surface">Header</div></div></section><section class="page-body"><div class="document-editor"><div class="document-writing-surface">Body</div></div></section></div></main>`);
 expect(await page.locator('.page-document').evaluate(el=>getComputedStyle(el,'::before').borderTopWidth)).toBe('1px');
 for(const editor of await page.locator('.document-editor').all())expect(await editor.evaluate(el=>getComputedStyle(el,'::before').content)).toBe('none');
 await page.locator('.canvas').evaluate(el=>(el as HTMLElement).style.width='700px');expect(await page.locator('.page-document').evaluate(el=>getComputedStyle(el,'::before').content)).toBe('none');
});
