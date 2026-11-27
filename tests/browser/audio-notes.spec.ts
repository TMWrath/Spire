import {test,expect,type Page} from './fixtures';

async function signIn(page:Page,username:string){
 await page.goto('/');
 await page.getByLabel('Username',{exact:true}).fill(username);
 await page.getByLabel('Password',{exact:true}).fill('disposable-audio-note-password');
 const create=await page.getByRole('button',{name:'Create Reliquary',exact:true}).isVisible();
 await page.getByRole('button',{name:create?'Create Reliquary':'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
}

async function journey(page:Page,username:string){
 await signIn(page,username);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Add File',exact:true}).click();
 const name=page.getByRole('textbox',{name:'New name',exact:true});
 await expect(name).toBeFocused();
 await expect(name).toHaveValue('Untitled');
 await name.fill('Meeting audio');
 await name.press('Enter');
 await expect(page.getByRole('button',{name:'Rename Notes/Meeting audio.md',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Meeting audio',exact:true}).press('Enter');
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await page.getByLabel('Markdown source').fill('<!-- spire:audio-note {"audioPath":"Attachments/test.wav"} -->\n<audio controls src="../Attachments/test.wav"></audio>\n\n<!-- spire:audio-transcript -->\nOriginal words\n<!-- /spire:audio-transcript -->\n');
 await page.getByRole('button',{name:'Save file',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Audio Notes',exact:true}).click();
 await page.getByRole('button',{name:'More options for Meeting audio',exact:true}).click();
 await page.getByText('Open note',{exact:true}).click();
 await expect(page.getByRole('region',{name:'Audio Note'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Transcript',exact:true})).toHaveValue('Original words');
  await page.getByRole('textbox',{name:'Transcript',exact:true}).fill('Edited words');
 await page.getByRole('button',{name:'Save file',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Transcript',exact:true})).toHaveValue('Edited words');
 page.once('dialog',dialog=>dialog.accept('Writing/Meeting transcript.md'));
 await page.getByRole('button',{name:'Convert to normal file'}).click();
 await expect(page.getByRole('textbox',{name:'Document editor',exact:true})).toContainText('Edited words');
 await expect(page.locator('audio')).toHaveCount(1);
 await page.getByRole('button',{name:'Source',exact:true}).click();
 await expect(page.getByLabel('Markdown source')).toContainText('Edited words');
 await page.getByRole('button',{name:'Original Audio Note'}).click();
 await expect(page.getByRole('region',{name:'Audio Note'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Linked normal files'})).toContainText('Writing/Meeting transcript.md');
}

async function openComposer(page:Page){
 await page.getByRole('button',{name:'Audio Notes',exact:true}).click();
 await page.getByRole('button',{name:'New audio note',exact:true}).click();
}

async function composerLayout(page:Page,username:string){
 await signIn(page,username);
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await openComposer(page);
 const dialog=page.getByRole('dialog',{name:'New Audio Note'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByText('Markdown / Audio')).toBeVisible();
 await expect(dialog.getByText(/Whistle transcription runs privately on your self-hosted server/)).toBeVisible();
 await expect(dialog.getByText('00:00:00')).toBeVisible();
 await expect(dialog.getByRole('tab',{name:'Record'})).toHaveAttribute('aria-selected','true');
 await expect(dialog.getByRole('tab',{name:'Import File'})).toBeVisible();
 await expect(dialog.getByRole('tab',{name:'Existing Audio'})).toBeVisible();
 await expect(dialog.getByLabel('Transcription language')).toBeVisible();
 await expect(dialog.getByLabel('Transcript mode')).toHaveValue('verbatim');
 await expect(dialog.getByLabel('Vocabulary hints')).toBeVisible();
 await expect(dialog.getByLabel('Audio Note name')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Details & Limits'})).toHaveAttribute('aria-expanded','false');
 await dialog.getByRole('button',{name:'Details & Limits'}).click();
 await expect(dialog.getByText('Max 15 min')).toBeVisible();
 await expect(dialog.getByText('Max 10 MB')).toBeVisible();
 await expect(dialog.getByText('Private self-hosted server')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Save Audio Note'})).toBeDisabled();
}

test('Audio Note composer follows the canonical desktop layout',async({page})=>composerLayout(page,'audio-note-layout-desktop'));
test('Audio Note composer preserves the canonical structure on mobile',async({browser})=>{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await composerLayout(page,'audio-note-layout-mobile');await context.close();});
test('Quick audio records in place and creates the dated Audio Note on the second press',async({page})=>{
 await page.addInitScript(()=>{
  const track={enabled:true,stop(){}};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[track]})}});
  class FakeAudioContext{
   sampleRate=16000;destination={};
   async resume(){} async suspend(){} async close(){}
   createMediaStreamSource(){return {connect(){},disconnect(){}};}
   createScriptProcessor(){return {onaudioprocess:null,connect(){},disconnect(){}};}
  }
  Object.defineProperty(window,'AudioContext',{configurable:true,value:FakeAudioContext});
 });
 await page.route('**/api/voice/transcribe?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({engine:'whistle',text:'Quick recorded words',language:'en'})}));
 await signIn(page,'quick-audio');
 await page.getByRole('button',{name:'Add widget',exact:true}).click();
 await page.getByRole('dialog',{name:'Add widget'}).getByRole('button',{name:'Quick audio',exact:true}).click();
 const button=page.getByRole('button',{name:'Record quick audio'});
 await button.click();
 await expect(page.getByRole('dialog',{name:'New Audio Note'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Stop quick audio'})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.quick-audio-wave')).toBeVisible();
 await page.getByRole('button',{name:'Stop quick audio'}).click();
 await expect(page.getByRole('region',{name:'Audio Note'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Transcript',exact:true})).toHaveValue(/^# Quick Audio\s+## Full transcript\s+Quick recorded words\s*$/);
 await page.getByRole('button',{name:'Home'}).click();
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await openComposer(page);
 await expect(page.getByLabel('Audio Note name')).toHaveValue('Audio Note');
 await page.getByRole('button',{name:'Close Audio Note'}).click();
});
test('Audio Note is offered from Files and converts without replacing the original',async({page})=>journey(page,'audio-note-desktop'));
test('Audio Note edit and conversion works on mobile',async({browser})=>{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await journey(page,'audio-note-mobile');await context.close();});
