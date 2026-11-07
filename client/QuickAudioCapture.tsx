import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
import {LocalTranscriber,VoiceCapture} from './voice-audio';
import {SpeechWaveform} from './SpeechWaveform';
import {transcriptFile} from './voice-authoring';

export type QuickAudioResult={blob:Blob;extension:'wav';raw:string;markdown:string;jobId:string};

export function QuickAudioCapture({onComplete,onError}:{onComplete:(value:QuickAudioResult)=>Promise<void>;onError:(message:string)=>void}){
 const [recording,setRecording]=useState(false),[saving,setSaving]=useState(false);
 const capture=useRef<VoiceCapture|null>(null),active=useRef(false),level=useRef(0);
 useEffect(()=>()=>{active.current=false;if(capture.current)capture.current.stop();capture.current=null;},[]);
 const stop=async()=>{
  if(!capture.current||!active.current)return;
  active.current=false;setRecording(false);level.current=0;setSaving(true);
  const {blob}=capture.current.stop();capture.current=null;
  const transcriber=new LocalTranscriber();let raw='';
  try{const result=await transcriber.transcribeBlob(blob,()=>{}, {language:'auto',keywords:[]});raw=result.text.trim();}
  catch(error){onError(error instanceof Error?`${error.message} Original audio was saved.`:'Transcription failed. Original audio was saved.');}
  try{await onComplete({blob,extension:'wav',raw,markdown:raw?transcriptFile('Quick Audio',raw,'verbatim'):'',jobId:crypto.randomUUID()});}
  catch(error){onError(error instanceof Error?error.message:String(error));}
  finally{setSaving(false);}
 };
 const start=async()=>{
  onError('');const recorder=new VoiceCapture();capture.current=recorder;active.current=true;
  try{await recorder.start(()=>{},()=>void stop(),value=>{level.current=value;});if(active.current)setRecording(true);}
  catch(error){active.current=false;capture.current=null;recorder.stop();onError(error instanceof Error?error.message:String(error));}
 };
 return <button className={'primary quick-audio-record'+(recording?' is-recording':'')} aria-label={recording?'Stop quick audio':'Record quick audio'} aria-pressed={recording} disabled={saving} onClick={()=>recording?void stop():void start()}>
  {recording?<Square/>:<Mic/>}
  <span>{saving?'Saving quick audio…':recording?'Stop quick audio':'Record quick audio'}</span>
  {recording&&<span className="quick-audio-wave" aria-hidden="true"><SpeechWaveform level={level}/></span>}
 </button>;
}
