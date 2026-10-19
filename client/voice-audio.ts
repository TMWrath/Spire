export const VOICE_RATE=16000,MAX_VOICE_SECONDS=15*60;
export function joinSamples(chunks:Float32Array[]):Float32Array {const result=new Float32Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;}
export function resampleMono(input:Float32Array,rate:number):Float32Array {
 if(rate===VOICE_RATE)return input.slice();
 const ratio=rate/VOICE_RATE,result=new Float32Array(Math.floor(input.length/ratio));
 for(let i=0;i<result.length;i++){const start=Math.floor(i*ratio),end=Math.min(input.length,Math.max(start+1,Math.floor((i+1)*ratio)));let sum=0;for(let j=start;j<end;j++)sum+=input[j];result[i]=sum/(end-start);}return result;
}
export function encodeWave(samples:Float32Array):Blob {
 const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
 const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,VOICE_RATE,true);view.setUint32(28,VOICE_RATE*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
 samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*(s<0?32768:32767),true));return new Blob([buffer],{type:'audio/wav'});
}
export async function decodeVoice(blob:Blob):Promise<Float32Array> {
 if(blob.size>10_000_000)throw new Error('Choose audio smaller than 10 MB.');
 const context=new AudioContext();try{const audio=await context.decodeAudioData(await blob.arrayBuffer());if(audio.duration>MAX_VOICE_SECONDS)throw new Error('Audio is limited to 15 minutes per transcription. Split longer recordings first.');const mono=new Float32Array(audio.length);for(let ch=0;ch<audio.numberOfChannels;ch++){const source=audio.getChannelData(ch);for(let i=0;i<mono.length;i++)mono[i]+=source[i]/audio.numberOfChannels;}return resampleMono(mono,audio.sampleRate);}finally{await context.close();}
}
export type VoiceResult={text:string;chunks?:{text:string;timestamp:[number,number|null]}[]};
export class LocalTranscriber {
 private worker:Worker|null=null;
 private reject:((error:Error)=>void)|null=null;
 async transcribe(samples:Float32Array,onStatus:(status:string)=>void):Promise<VoiceResult>{
  if(this.reject)throw new Error('Transcription is already running.');
  this.worker??=new Worker(new URL('./voice.worker.ts',import.meta.url),{type:'module'});
  return new Promise((resolve,reject)=>{this.reject=reject;const worker=this.worker!;worker.onmessage=event=>{if(event.data.status)onStatus(event.data.status);if(event.data.error){this.reject=null;reject(new Error(event.data.error));}else if(event.data.result){this.reject=null;resolve(event.data.result);}};worker.onerror=()=>{this.reject=null;worker.terminate();this.worker=null;reject(new Error('The on-device speech engine could not start. Check speech assets and available memory.'));};worker.postMessage({samples});});
 }
 cancel(){this.worker?.terminate();this.worker=null;this.reject?.(new Error('Transcription cancelled. Your audio is retained for retry.'));this.reject=null;}
}
/** Microphone capture uses only Web Audio; no platform speech service is contacted. */
export class VoiceCapture {
 private context:AudioContext|null=null;private stream:MediaStream|null=null;private node:ScriptProcessorNode|null=null;private source:MediaStreamAudioSourceNode|null=null;
 private chunks:Float32Array[]=[];private batch:Float32Array[]=[];private batchLength=0;private count=0;private closed=false;
 async start(onChunk:(samples:Float32Array,seconds:number)=>void,onLimit:()=>void,onLevel?:(level:number)=>void){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone capture requires HTTPS and a supported browser.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(this.closed){stream.getTracks().forEach(t=>t.stop());return;}
  this.stream=stream;const context=new AudioContext({sampleRate:VOICE_RATE});this.context=context;await context.resume();
  this.source=context.createMediaStreamSource(stream);this.node=context.createScriptProcessor(4096,1,1);
  this.node.onaudioprocess=event=>{const samples=resampleMono(event.inputBuffer.getChannelData(0),context.sampleRate);let energy=0;for(const sample of samples)energy+=sample*sample;onLevel?.(Math.min(1,Math.sqrt(energy/Math.max(1,samples.length))*8));this.chunks.push(samples);this.batch.push(samples);this.batchLength+=samples.length;this.count+=samples.length;if(this.batchLength>=VOICE_RATE*8){onChunk(joinSamples(this.batch),this.count/VOICE_RATE);this.batch=[];this.batchLength=0;}if(this.count>=300*VOICE_RATE)onLimit();};
  this.source.connect(this.node);this.node.connect(context.destination);
 }
 async pause(paused:boolean){this.stream?.getTracks().forEach(t=>t.enabled=!paused);if(paused)await this.context?.suspend();else await this.context?.resume();}
 snapshot(){return encodeWave(joinSamples(this.chunks));}
 stop():{tail:Float32Array;blob:Blob}{this.closed=true;this.node?.disconnect();this.source?.disconnect();this.stream?.getTracks().forEach(t=>t.stop());void this.context?.close();this.context=null;this.node=null;const result={tail:joinSamples(this.batch),blob:this.snapshot()};this.batch=[];this.batchLength=0;return result;}
}
