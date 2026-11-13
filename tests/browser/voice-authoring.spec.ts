import {test,expect,type Page} from './fixtures';
import {selectDropdown} from './dropdown';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const temp=mkdtempSync(path.join(tmpdir(),'spire-voice-test-')),fixture=path.join(temp,'speech.wav');
test.beforeAll(()=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','flite=text=The house was silent. I opened the door and saw the morning light. This is the beginning of my story.:voice=slt','-ar','16000','-ac','1',fixture]));
test.afterAll(()=>rmSync(temp,{recursive:true,force:true}));
async function setup(page:Page){
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('voicewriter');await page.getByLabel('Password',{exact:true}).fill(randomUUID());
 await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New file/}).click();await page.getByRole('dialog',{name:'Create from file'}).getByRole('button',{name:/New blank file/}).click();await page.getByLabel('File name',{exact:true}).fill('Original');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Writing');await page.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source',{exact:true}).fill('Keep my writing.');
}
async function show(page:Page){
 if(!await page.locator('.sidebar').isVisible())await page.getByRole('button',{name:'Toggle folders'}).click();
 await page.getByRole('button',{name:'Create',exact:true}).click();const create=page.getByRole('dialog',{name:'Create from file',exact:true});
 await create.getByRole('button',{name:/^New file/}).click();await create.getByRole('button',{name:'From audio',exact:false}).click();return page.getByRole('dialog',{name:'Transcribe audio to file',exact:true});
}
async function fakeSpeech(page:Page,text='Spire heading one A new chapter. Spire new paragraph The house was silent.',failure=false){
 await page.addInitScript(({text,failure})=>{window.Worker=class{onmessage:((event:{data:unknown})=>void)|null=null;onerror:null=null;terminated=false;constructor(_url:URL|string,_options?:WorkerOptions){}postMessage(request:unknown){(window as any).__voiceRequest=request;setTimeout(()=>{if(!this.terminated)this.onmessage?.({data:failure?{error:'Test speech engine unavailable'}:{result:{text,language:'es',engine:'whistle'}}});},30);}terminate(){this.terminated=true;}} as unknown as typeof Worker;},{text,failure});
}
async function liveMic(page:Page){await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator();const gain=c.createGain();o.connect(gain);gain.connect(d);o.start();await c.resume();(window as any).__liveGain=gain;(window as any).__liveStream=d.stream;return d.stream;}});});}
test('dictation, conflict, and revision history each have their own Context tab',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Toggle context',exact:true}).click();
 const context=page.locator('aside.context');const normalWidth=(await context.boundingBox())!.width;
 await expect(page.getByRole('button',{name:'Revision history'})).toHaveCount(0);
 await page.getByRole('tab',{name:'Revisions',exact:true}).click();const revisions=page.getByRole('tabpanel',{name:'Revision history'});await expect(revisions).toBeVisible();await expect(revisions.getByRole('navigation',{name:'Revisions'})).toBeVisible();await expect(revisions.getByRole('heading',{name:/Revision \d+/})).toBeVisible();await expect(revisions.getByRole('button',{name:'Revision history'})).toHaveCount(0);await expect.poll(async()=>(await context.boundingBox())!.width).toBeGreaterThan(normalWidth*2);
 await context.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});const expandedWidth=(await context.boundingBox())!.width;await page.getByRole('tab',{name:'Details',exact:true}).click();const closingWidth=(await context.boundingBox())!.width;expect(closingWidth).toBeLessThanOrEqual(expandedWidth);
 const closingTransition=await context.evaluate(element=>{const style=getComputedStyle(element);return {property:style.transitionProperty,duration:style.transitionDuration,timing:style.transitionTimingFunction};});
 expect(closingTransition.property).toContain('width');expect(closingTransition.duration).toBe('0.18s');expect(closingTransition.timing).toBe('ease');
 await expect.poll(async()=>(await context.boundingBox())!.width).toBeLessThanOrEqual(normalWidth+2);
 await page.getByRole('tab',{name:'Dictation',exact:true}).click();const dictation=page.getByRole('tabpanel',{name:'Dictation audio and transcript'});await expect(dictation).toBeVisible();await expect(dictation.locator('details')).toHaveCount(0);await expect(dictation.getByRole('heading',{name:'Dictation audio and transcript'})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Conflicts (0)',exact:true})).toBeVisible();await page.getByRole('tab',{name:/^Conflicts/}).click();const conflicts=page.getByRole('tabpanel',{name:'Resolve conflicts'});await expect(conflicts).toBeVisible();await expect(conflicts.locator('details')).toHaveCount(0);await expect(conflicts.getByRole('heading',{name:'Resolve Conflicts (0)'})).toBeVisible();
});
test('editor waveform follows microphone sound, flattens in silence and disappears on stop',async({page})=>{
 await fakeSpeech(page);await setup(page);await page.setViewportSize({width:390,height:844});await liveMic(page);await page.getByRole('button',{name:'Start dictation',exact:true}).click();
 const wave=page.getByRole('img',{name:'Microphone audio waveform'});await expect(wave).toBeVisible();await expect(wave.locator('span')).toHaveCount(28);
 const peak=()=>wave.locator('span').evaluateAll(nodes=>Math.max(...nodes.map(n=>parseFloat((n as HTMLElement).style.height))));
 await expect.poll(peak).toBeGreaterThan(12);await page.evaluate(()=>(window as any).__liveGain.gain.value=0);await expect.poll(peak,{timeout:5000}).toBeLessThan(5);
 const dock=page.getByRole('region',{name:'Active dictation'});await expect(dock).toBeVisible();await expect(dock.getByLabel('Active dictation language')).toBeVisible();const bounds=await dock.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.y+bounds!.height).toBeGreaterThan(800);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);expect(await dock.evaluate(e=>e.parentElement===document.body)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Stop recording',exact:true}).click();await expect(wave).toHaveCount(0);await expect(dock).toHaveCount(0);
});
test('dictation language selector is absent from the editor toolbar',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('Live dictation language')).toHaveCount(0);await expect(page.getByRole('button',{name:'Start dictation',exact:true})).toBeVisible();
});
test('editor mic inserts directly and drains final audio without a review dialog',async({page})=>{
 await fakeSpeech(page,'Fresh spoken words.');await setup(page);await liveMic(page);
 await page.getByLabel('Markdown source',{exact:true}).evaluate((e:HTMLTextAreaElement)=>e.setSelectionRange(e.value.length,e.value.length));
 await page.getByRole('button',{name:'Start dictation',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.Fresh spoken words.',{timeout:20000});
 await page.getByRole('button',{name:'Stop dictation',exact:true}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/Keep my writing\.Fresh spoken words\./);
 await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__liveStream.getAudioTracks()[0].readyState)).toBe('ended');
});
test('holding editor mic latches command mode with help and inserts into rich editor',async({page})=>{
 await fakeSpeech(page,'Spire heading one A new chapter.');await setup(page);await liveMic(page);await page.getByRole('button',{name:'Editor',exact:true}).click();
 const mic=page.locator('.live-dictation-toggle');await mic.dispatchEvent('pointerdown',{button:0});await page.waitForTimeout(650);await mic.dispatchEvent('pointerup',{button:0});await mic.dispatchEvent('click');
 await expect(page.getByRole('dialog',{name:'Dictation commands'})).toBeVisible();await page.getByRole('button',{name:'Got it',exact:true}).click();await expect(page.getByRole('button',{name:'Stop dictation',exact:true})).toBeVisible();await page.waitForTimeout(900);await page.getByRole('button',{name:'Stop dictation',exact:true}).click();
 await expect(page.locator('.tiptap')).toContainText('A new chapter.');await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/# A new chapter/);
});
test('editing a file during dictation rejects delayed text',async({page})=>{
 await fakeSpeech(page,'Do not overwrite.');await setup(page);await liveMic(page);await page.getByRole('button',{name:'Start dictation',exact:true}).click();await page.waitForTimeout(900);await page.getByLabel('Markdown source',{exact:true}).fill('My newer writing.');await page.getByRole('button',{name:'Stop dictation',exact:true}).click();await expect(page.locator('.editor-tabs .live-dictation-status')).toHaveCount(0);await page.getByRole('button',{name:'Toggle context',exact:true}).click();await page.getByRole('tab',{name:'Dictation',exact:true}).click();await expect(page.locator('.context .dictation-context-details [role=alert]')).toBeVisible();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('My newer writing.');
});
test('microphone capture pauses, resumes, retains playable audio and stops its tracks',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const context=new AudioContext(),destination=context.createMediaStreamDestination(),osc=context.createOscillator();osc.connect(destination);osc.start();await context.resume();(window as any).__voiceStream=destination.stream;(window as any).__voiceContext=context;return destination.stream;}});});
 const dialog=await show(page);await dialog.getByRole('button',{name:'Record new audio',exact:true}).click();await expect(dialog.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.waitForTimeout(600);
 await dialog.getByRole('button',{name:'Pause',exact:true}).click();await expect(dialog.getByRole('button',{name:'Resume',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).__voiceStream.getAudioTracks()[0].enabled)).toBe(false);
 await dialog.getByRole('button',{name:'Resume',exact:true}).click();await expect(dialog.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.waitForTimeout(400);await dialog.getByRole('button',{name:'Stop recording',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__voiceStream.getAudioTracks()[0].readyState)).toBe('ended');await dialog.locator('audio').evaluate(async(el:HTMLAudioElement)=>{await el.play();});await expect.poll(()=>dialog.locator('audio').evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0);
 await dialog.getByRole('button',{name:'Close and keep local draft'}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');await page.evaluate(()=>(window as any).__voiceContext.close());
});
async function transcribe(page:Page,dialog:ReturnType<Page['getByRole']>){
 await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Transcribe on this device',exact:true}).click();
 await expect(dialog.getByLabel('Raw transcript',{exact:true}).or(dialog.getByRole('alert'))).toBeVisible({timeout:240000});
 await expect(dialog.getByRole('alert')).toHaveCount(0);
}
test('voice import offers persistent multilingual transcription and keyword hints',async({page})=>{
 await fakeSpeech(page,'Hola clase.');await setup(page);let dialog=await show(page);await expect(dialog).toContainText('Audio stays on this device');
 await expect(dialog.getByLabel('Transcription language')).toHaveValue('auto');await dialog.getByLabel('Transcription language').selectOption('es');await dialog.getByLabel('Vocabulary hints').fill('Siobhán, cálculo');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();dialog=await show(page);await expect(dialog.getByLabel('Transcription language')).toHaveValue('es');
 await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Transcribe on this device'}).click();await expect(dialog.getByLabel('Raw transcript')).toHaveValue('Hola clase.');
 await expect.poll(()=>page.evaluate(()=>(window as any).__voiceRequest)).toMatchObject({language:'es',keywords:['Siobhán','cálculo']});
});
test('bundled Whistle performs real offline English inference',async({page})=>{
 await setup(page);const dialog=await show(page);await dialog.getByLabel('Transcription language').selectOption('en');
 await page.route('https://**/*',route=>route.abort());
 await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Transcribe on this device'}).click();
 await expect(dialog.getByLabel('Raw transcript')).toHaveValue(/house|silent|door|morning|story/i,{timeout:120000});await expect(dialog).toContainText('Whistle');
});
test('About credits identify Whistle as the only speech model',async({page})=>{
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('voicewriter');await page.getByLabel('Password',{exact:true}).fill(randomUUID());await page.getByRole('button',{name:'Create Reliquary',exact:true}).click();await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'About',exact:true}).click();const credits=page.getByRole('tabpanel',{name:'About',exact:true});
 await expect(credits).toContainText('Whistle speech-to-text model');await expect(credits).toContainText('Cactus Needle browser runtime');await expect(credits).not.toContainText(/Whisper|Transformers\.js|ONNX Runtime/);
 await expect(credits.getByRole('link',{name:'Whistle Apache License 2.0'})).toHaveAttribute('href','/voice/licenses/model-Apache-2.0.txt');await expect(credits.getByRole('link',{name:'Cactus Needle Apache License 2.0'})).toHaveAttribute('href','/voice/licenses/cactus-needle-Apache-2.0.txt');
});
test('voice import preserves source on cancellation and exposes local processing and credits',async({page})=>{
 await setup(page);const dialog=await show(page);await expect(dialog).toContainText('Audio stays on this device');
 await dialog.getByText('Open-source credits',{exact:true}).click();
 await expect(dialog).toContainText('Whistle speech-to-text model');
 await expect(dialog).toContainText('Cactus Needle browser runtime');
 await expect(dialog.getByRole('link',{name:'Whistle speech-to-text model',exact:true})).toHaveAttribute('href','https://huggingface.co/Cactus-Compute/whistle');
 await expect(dialog.getByRole('link',{name:'Cactus Needle browser runtime',exact:true})).toHaveAttribute('href','https://github.com/cactus-compute/needle');
 await expect(dialog.getByRole('link',{name:'Whistle Apache License 2.0'})).toHaveAttribute('href','/voice/licenses/model-Apache-2.0.txt');
 await expect(dialog.getByRole('link',{name:'Cactus Needle Apache License 2.0'})).toHaveAttribute('href','/voice/licenses/cactus-needle-Apache-2.0.txt');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');
});
test('real audio is transcribed locally and creates a separate portable file',async({page,context})=>{
 test.setTimeout(300000);await setup(page);const external:string[]=[],uploads:string[]=[];
 context.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4179')&&!request.url().startsWith('blob:'))external.push(request.url());if(request.method()==='POST'&&request.url().includes('/attachments'))uploads.push(request.url());});
 const dialog=await show(page);await transcribe(page,dialog);await expect(dialog.getByLabel('Raw transcript',{exact:true})).toHaveValue(/house was silent/i);expect(uploads).toEqual([]);
 const raw=await dialog.getByLabel('Raw transcript',{exact:true}).inputValue();await dialog.getByLabel('Transcript file path',{exact:true}).fill('Writing/Voice transcript.md');
 await dialog.getByRole('button',{name:'Create transcript file',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Source',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/Full transcript/);await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/<audio controls src="\.\.\/Attachments\//);
 const snapshot=await (await page.request.get('/api/snapshot')).json();expect(snapshot.notes.find((n:any)=>n.path==='Writing/Original.md').content).toBe('Keep my writing.');expect(snapshot.notes.find((n:any)=>n.path.includes('Voice source ')).content).toContain(raw);expect(snapshot.attachments).toHaveLength(1);expect(external).toEqual([]);expect(uploads).toHaveLength(1);
});
test('imported audio survives close and recovery without upload or source changes',async({page})=>{
 await setup(page);const uploads:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/attachments'))uploads.push(r.url());});
 let dialog=await show(page);await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Close and keep local draft'}).click();
 await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');dialog=await show(page);await dialog.getByRole('button',{name:'Recover voice draft'}).click();await expect(dialog.getByRole('button',{name:'Download original audio'})).toBeVisible();expect(uploads).toEqual([]);
});
test('review edits never replace the preserved raw transcript',async({page})=>{
 await fakeSpeech(page,'Um, here is my complete original story.');await setup(page);const dialog=await show(page);await transcribe(page,dialog);await dialog.getByLabel('Transcript mode').selectOption('clean');await expect(dialog.getByLabel('Review Markdown')).toHaveValue(/Original transcript/);await dialog.getByLabel('Review Markdown').fill('# Edited reading copy\n\nOnly a reading copy.');await dialog.getByRole('button',{name:'Create transcript file',exact:true}).click();await page.getByRole('dialog',{name:'Unsaved changes',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
 const snapshot=await (await page.request.get('/api/snapshot')).json();expect(snapshot.notes.find((n:any)=>n.path.includes('Voice source ')).content).toContain('Um, here is my complete original story.');expect(snapshot.notes.find((n:any)=>n.path==='Writing/Transcript.md').content).toContain('Edited reading copy');
});
test('Media no longer duplicates Create audio conversion or live dictation',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Media',exact:true}).click();await expect(page.getByRole('button',{name:'Dictate into file',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Transcribe audio to file',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Record audio',exact:true})).toBeVisible();
});
test('speech failure retains original audio, offers retry, and never changes the source',async({page})=>{
 await fakeSpeech(page,'',true);await setup(page);const dialog=await show(page);await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Transcribe on this device'}).click();await expect(dialog.getByRole('alert')).toContainText('Test speech engine unavailable');await expect(dialog.getByRole('button',{name:'Download original audio'})).toBeVisible();await expect(dialog.getByRole('button',{name:'Transcribe on this device'})).toBeEnabled();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');
});
