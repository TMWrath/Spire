import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const text=(path:string)=>readFileSync(join(root,path),'utf8');

function pathsBelow(relative:string):string[]{
 const base=join(root,relative);
 try{return readdirSync(base,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>join(entry.parentPath,entry.name));}
 catch{return [];}
}

test('voice transcription ships Whistle only without the retired Whisper fallback',()=>{
 const packageJson=JSON.parse(text('package.json'));
 const lock=JSON.parse(text('documents/voice-assets.lock.json'));
 assert.equal(packageJson.dependencies['@huggingface/transformers'],undefined);
 assert.equal(text('client/voice-audio.ts').includes('voice-whisper.worker'),false);
 assert.equal(pathsBelow('client/').some(path=>path.includes('voice-whisper.worker')),false);
 assert.equal(lock.files.some((entry:{path:string})=>/whisper|transformers|onnxruntime|tokenizers|jinja/i.test(entry.path)),false);
 assert.equal(pathsBelow('public/voice/').some(path=>/whisper-tiny|whisper-MIT/i.test(path)),false);
});
