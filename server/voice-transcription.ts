import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWhistle,type SpeechLanguage,type TranscriptionResult} from 'cactus-needle';

const RATE=16000,MAX_SECONDS=15*60,MAX_PCM_BYTES=RATE*MAX_SECONDS*4;
let active=false;
export type ServerVoiceOptions={language?:SpeechLanguage;keywords?:string[]};

function decode(input:string,output:string):Promise<void>{return new Promise((resolve,reject)=>{
 const child=spawn('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,'-vn','-ac','1','-ar',String(RATE),'-f','f32le','-acodec','pcm_f32le',output],{stdio:['ignore','ignore','pipe']});
 let error='';child.stderr.on('data',chunk=>{if(error.length<4000)error+=String(chunk)});const timer=setTimeout(()=>child.kill('SIGKILL'),120000);
 child.once('error',reject);child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(error.trim()||'Audio decoding failed.'));});
 });}
export async function transcribeOnServer(bytes:Buffer,options:ServerVoiceOptions={}){
 if(active)throw Object.assign(new Error('The server transcription engine is busy. Retry shortly.'),{status:429});
 active=true;const directory=await mkdtemp(path.join(tmpdir(),'spire-whistle-'));
 try{
  const input=path.join(directory,'input.audio'),output=path.join(directory,'audio.f32');await writeFile(input,bytes);await decode(input,output);const pcm=await readFile(output);
  if(!pcm.length)throw Object.assign(new Error('The audio is empty or could not be decoded.'),{status:400});
  if(pcm.length>MAX_PCM_BYTES)throw Object.assign(new Error('Audio is limited to 15 minutes per transcription.'),{status:413});
  const samples=new Float32Array(pcm.buffer,pcm.byteOffset,Math.floor(pcm.byteLength/4));const whistle=await createWhistle({modelPath:process.env.SPIRE_WHISTLE_MODEL??'/app/voice/models/whistle.cact'});
  try{const results:TranscriptionResult[]=[];for(let offset=0;offset<samples.length;offset+=RATE*30){const part=samples.slice(offset,Math.min(samples.length,offset+RATE*30));results.push(await whistle.transcribe(part,{language:options.language,keywords:options.keywords}));}
   return {text:results.map(result=>result.text.trim()).filter(Boolean).join(' '),language:results.find(result=>result.language)?.language??'',engine:'whistle' as const,chunks:results.map((result,index)=>({text:result.text,timestamp:[index*30,Math.min(samples.length/RATE,(index+1)*30)]}))};
  }finally{await whistle.close();}
 }finally{active=false;await rm(directory,{recursive:true,force:true});}
}
