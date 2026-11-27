import {test,expect} from '@playwright/test';

for (const [width,height,visible] of [[390,844,490],[673,850,500],[844,390,200]]) {
  test.describe(`${width}x${height}`,()=>{
    test.use({viewport:{width,height},isMobile:true,hasTouch:true});
    test('keyboard reveals the focused dialog field and resets without losing text',async({page})=>{
      await page.addInitScript(()=>{
        const viewport=window.visualViewport!;
        Object.defineProperty(viewport,'height',{get:()=>Number(document.documentElement.dataset.simulatedHeight ?? innerHeight)});
      });
      await page.goto('/');
      await page.evaluate(()=>{
        const host=document.createElement('div');
        host.className='template-backdrop';
        host.innerHTML='<section class="file-dialog"><div style="height:260px"></div><textarea aria-label="Keyboard fixture"></textarea></section>';
        document.body.append(host);
        host.querySelector('textarea')!.focus({preventScroll:true});
      });
      const field=page.getByRole('textbox',{name:'Keyboard fixture'});
      const viewport=async(size:number)=>page.evaluate(h=>{
        document.documentElement.dataset.simulatedHeight=String(h);
        visualViewport!.dispatchEvent(new Event('resize'));
      },size);
      await viewport(visible);
      await expect(page.locator('html')).toHaveAttribute('data-keyboard-open','');
      await expect.poll(async()=> (await field.boundingBox())!.y+(await field.boundingBox())!.height).toBeLessThanOrEqual(visible);
      await page.keyboard.type('Still visible');
      await viewport(height);
      await expect(page.locator('html')).not.toHaveAttribute('data-keyboard-open','');
      await expect(field).toHaveValue('Still visible');
      expect(await page.evaluate(()=>scrollY)).toBe(0);
    });
    test('reacts when Chromium resizes both viewports',async({page})=>{
      await page.goto('/');
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content',/interactive-widget=resizes-content/);
      await page.evaluate(()=>{
        const input=document.createElement('input');
        input.setAttribute('aria-label','Resize fixture');
        document.body.append(input);
        input.focus({preventScroll:true});
      });
      await page.setViewportSize({width,height:visible});
      await expect(page.locator('html')).toHaveAttribute('data-keyboard-open','');
      await page.keyboard.type('Draft');
      await page.setViewportSize({width,height});
      await expect(page.locator('html')).not.toHaveAttribute('data-keyboard-open','');
      await expect(page.getByRole('textbox',{name:'Resize fixture'})).toHaveValue('Draft');
    });
    test('keeps the caret visible inside a long rich-text editor',async({page})=>{
      await page.goto('/');
      await page.evaluate(size=>{
        const host=document.createElement('div');
        host.className='app';
        host.style.cssText='position:fixed;top:0;left:0;right:0;z-index:1000';
        host.innerHTML='<div class="canvas"><div contenteditable="true" style="width:100%"><div style="height:950px"></div><p>Last line</p></div></div>';
        document.body.append(host);
        host.querySelector<HTMLElement>('[contenteditable]')!.focus({preventScroll:true});
        const text=host.querySelector('p')!.firstChild!;
        getSelection()!.collapse(text,text.textContent!.length);
        Object.defineProperty(visualViewport!,'height',{value:size});
        visualViewport!.dispatchEvent(new Event('resize'));
      },visible);
      await expect.poll(()=>page.evaluate(()=>getSelection()!.getRangeAt(0).getBoundingClientRect().bottom)).toBeLessThanOrEqual(visible);
      await page.keyboard.type(' edited');
      await expect(page.locator('[contenteditable] p')).toHaveText('Last line edited');
    });
  });
}
