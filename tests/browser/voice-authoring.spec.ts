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
 await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'New file'}).click();await page.getByLabel('File name',{exact:true}).fill('Original');
 await selectDropdown(page.getByLabel('Save in folder'),'__new__');await page.getByLabel('New folder path').fill('Writing');await page.getByRole('button',{name:'Create file',exact:true}).click();
 await page.getByRole('button',{name:'Source',exact:true}).click();await page.getByLabel('Markdown source',{exact:true}).fill('Keep my writing.');
}
async function show(page:Page,kind:'file'|'dictate'='file'){
 const name=kind==='file'?'Transcribe audio to file':'Dictate into file';await page.getByRole('button',{name:'Media',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();return page.getByRole('dialog',{name,exact:true});
}
async function fakeSpeech(page:Page,text='Spire heading one A new chapter. Spire new paragraph The house was silent.',failure=false){
 await page.addInitScript(({text,failure})=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url:URL|string,options?:WorkerOptions){if(!String(url).includes('voice.worker')){super(url,options);return;}const mock:{onmessage:((event:{data:unknown})=>void)|null;onerror:null;terminated:boolean;postMessage:()=>void;terminate:()=>void}={onmessage:null,onerror:null,terminated:false,postMessage(){setTimeout(()=>{if(!mock.terminated)mock.onmessage?.({data:failure?{error:'Test speech engine unavailable'}:{result:{text}}});},30);},terminate(){mock.terminated=true;}};return mock as unknown as Worker;}} as typeof Worker;},{text,failure});
}
async function liveMic(page:Page){await page.evaluate(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator();o.connect(d);o.start();await c.resume();(window as any).__liveStream=d.stream;return d.stream;}});});}
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
 await fakeSpeech(page,'Do not overwrite.');await setup(page);await liveMic(page);await page.getByRole('button',{name:'Start dictation',exact:true}).click();await page.waitForTimeout(900);await page.getByLabel('Markdown source',{exact:true}).fill('My newer writing.');await page.getByRole('button',{name:'Stop dictation',exact:true}).click();await expect(page.locator('.live-dictation-status summary')).toContainText('details');await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('My newer writing.');
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
test('voice dialog preserves source on cancellation and exposes local processing and credits',async({page})=>{
 await setup(page);const dialog=await show(page,'dictate');await expect(dialog).toContainText('Audio stays on this device');await expect(dialog.getByRole('checkbox',{name:'Spoken formatting commands'})).not.toBeChecked();
 await dialog.getByText('Open-source credits',{exact:true}).click();await expect(dialog).toContainText('Apache-2.0');await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');
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
 await fakeSpeech(page,'Um, here is my complete original story.');await setup(page);const dialog=await show(page);await transcribe(page,dialog);await dialog.getByLabel('Transcript mode').selectOption('clean');await expect(dialog.getByLabel('Review Markdown')).toHaveValue(/Original transcript/);await dialog.getByLabel('Review Markdown').fill('# Edited reading copy\n\nOnly a reading copy.');await dialog.getByRole('button',{name:'Create transcript file',exact:true}).click();await expect(dialog).toHaveCount(0);
 const snapshot=await (await page.request.get('/api/snapshot')).json();expect(snapshot.notes.find((n:any)=>n.path.includes('Voice source ')).content).toContain('Um, here is my complete original story.');expect(snapshot.notes.find((n:any)=>n.path==='Writing/Transcript.md').content).toContain('Edited reading copy');
});
test('explicit spoken commands insert at the captured source selection with a recoverable original',async({page})=>{
 await fakeSpeech(page);await setup(page);await page.getByLabel('Markdown source',{exact:true}).evaluate((field:HTMLTextAreaElement)=>field.setSelectionRange(5,7));const dialog=await show(page,'dictate');await transcribe(page,dialog);await expect(dialog.getByLabel('Review Markdown')).toHaveValue(/^Spire heading one/);await dialog.getByRole('checkbox',{name:'Spoken formatting commands'}).check();await expect(dialog.getByLabel('Review Markdown')).toHaveValue(/^# A new chapter\./);await dialog.getByRole('button',{name:'Insert reviewed dictation'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/^Keep # A new chapter\./);await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue(/ writing\.$/);
});
test('speech failure retains original audio, offers retry, and never changes the source',async({page})=>{
 await fakeSpeech(page,'',true);await setup(page);const dialog=await show(page);await dialog.getByLabel('Audio file',{exact:true}).setInputFiles(fixture);await dialog.getByRole('button',{name:'Transcribe on this device'}).click();await expect(dialog.getByRole('alert')).toContainText('Test speech engine unavailable');await expect(dialog.getByRole('button',{name:'Download original audio'})).toBeVisible();await expect(dialog.getByRole('button',{name:'Transcribe on this device'})).toBeEnabled();await expect(page.getByLabel('Markdown source',{exact:true})).toHaveValue('Keep my writing.');
});
