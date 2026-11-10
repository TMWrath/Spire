import {expect,test} from './fixtures';

for(const touch of [false,true]){
 test.describe(touch?'touch':'desktop',()=>{
  test.use({hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:900}});

  test('Home quick note creates a dated Markdown file in Quick Notes and opens it',async({page})=>{
   await page.goto('/');
   await page.getByLabel('Username',{exact:true}).fill(`quick-note-${touch?'touch':'desktop'}`);
   await page.getByLabel('Password',{exact:true}).fill('disposable-quick-note-password');
   await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();

   const composer=page.getByRole('region',{name:'Quick note'});
   await expect(composer).toBeVisible();
   await expect(composer.getByRole('button',{name:'Add quick note'})).toBeDisabled();
   await composer.getByRole('textbox',{name:'Quick note text'}).fill('Remember the blueprints on the workbench.');
   await page.route('**/api/folders',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();},{times:1});
   await composer.getByRole('button',{name:'Add quick note'}).click();
   await expect(composer.getByRole('button',{name:'Saving quick note…'})).toBeVisible();

   await expect(page.getByLabel('File path',{exact:true})).toHaveValue(/^Quick Notes\/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}(?:-\d+)?\.md$/);
   if(touch){for(const width of [320,390,760]){
    await page.setViewportSize({width,height:844});
    const pathBox=(await page.getByLabel('File path',{exact:true}).boundingBox())!;
    const buttons=page.getByRole('toolbar',{name:'File actions'}).getByRole('button');
    let rowY:number|undefined;
    for(let i=0;i<await buttons.count();i++){
     const box=(await buttons.nth(i).boundingBox())!;
     expect(box.y).toBeGreaterThanOrEqual(pathBox.y+pathBox.height);
     if(rowY===undefined)rowY=box.y;else expect(box.y).toBeCloseTo(rowY,0);
     expect(box.x+box.width).toBeLessThanOrEqual(width);
    }
   }}
   await expect(page.locator('.network').filter({hasText:'Saved on server'})).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Show editing tools',exact:true})).toHaveAttribute('aria-expanded','false');
   await page.getByRole('button',{name:'Source',exact:true}).click();
   await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Remember the blueprints on the workbench.\n');

   const snapshot=await (await page.request.get('/api/snapshot')).json();
   expect(snapshot.folders).toContain('Quick Notes');
   expect(snapshot.notes).toHaveLength(1);
   expect(snapshot.notes[0].path).toMatch(/^Quick Notes\/\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}(?:-\d+)?\.md$/);
  });
 });
}
