import {Whistle} from 'cactus-needle/browser';
import type {SpeechLanguage} from 'cactus-needle/browser';

type Request={samples:Float32Array;language?:SpeechLanguage;keywords?:string[]};
const MAX_SAMPLES=30*16000;
let recognizer:Whistle|null=null;
self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  self.postMessage({status:'Loading Whistle on this device…'});
  recognizer??=new Whistle({
   model:'/voice/models/whistle.cact',
   modelSha256:'b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb',
   wasmUrl:'/voice/whistle/needle.wasm',
   cache:true,
   onDownloadProgress:({percentage})=>{if(percentage!==undefined)self.postMessage({status:`Loading Whistle on this device… ${Math.round(percentage)}%`});},
  });
  self.postMessage({status:'Transcribing locally with Whistle…'});
  const texts:string[]=[],languages=new Map<string,number>();let words:unknown[]=[];
  for(let offset=0;offset<event.data.samples.length;offset+=MAX_SAMPLES){
   const samples=event.data.samples.slice(offset,Math.min(offset+MAX_SAMPLES,event.data.samples.length));
   const result=await recognizer.transcribe(samples,{language:event.data.language,keywords:event.data.keywords,wordTimestamps:true});
   if(result.text.trim())texts.push(result.text.trim());
   if(result.language)languages.set(result.language,(languages.get(result.language)??0)+samples.length);
   if(result.words)words=words.concat(result.words.map(word=>({...word,start:word.start+offset/16000,end:word.end+offset/16000})));
  }
  const language=[...languages].sort((a,b)=>b[1]-a[1])[0]?.[0]??'';
  self.postMessage({result:{text:texts.join(' '),language,words,engine:'whistle'}});
 }catch(error){void recognizer?.close().catch(()=>{});recognizer=null;self.postMessage({error:error instanceof Error?error.message:'Whistle transcription failed.'});}
};
