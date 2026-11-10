import React,{useState,useRef,useEffect} from 'react';
import {RotateCcw,Square} from 'lucide-react';
import {audioNoteData,audioNoteTranscript,replaceAudioNoteTranscript} from '../shared/audio-notes';
import {StandaloneAudioTrack} from './StandaloneAudioTrack';
import {setAudioDisplay} from './editor-audio';
import {attachmentUrl} from './attachment-urls';
import {LocalTranscriber} from './voice-audio';
import {normalizeVoiceLanguage,parseVoiceKeywords,VOICE_KEYWORDS_KEY,VOICE_LANGUAGE_KEY} from './voice-language';
import './audio-note.css';
type File={id:string;path:string;content:string;deleted?:boolean};
export function AudioNoteView({note,linked,onSave,onChange,onOpen}:{note:File;linked:File[];onSave:(content:string)=>Promise<void>;onChange:(content:string)=>void;onOpen:(file:File)=>void}){
 const [busy,B]=useState(false),[error,F]=useState(''),[status,S]=useState('');
 const latest=useRef(note);latest.current=note;
 const active=useRef<{cancel:()=>void}|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.cancel();};},[]);
 const data=audioNoteData(note.content)!,name=data.audioPath.split('/').pop()||'Audio';
 const display=/<audio\b[^>]*\bdata-spire-display=["']simple["']/i.test(note.content)?'simple':'default';
 const change=(text:string)=>{try{onChange(replaceAudioNoteTranscript(note.content,text));F('');}catch(e){F(e instanceof Error?e.message:String(e));}};
 const saveDisplay=async(next:'simple'|'default')=>{if(busy||note.deleted)return;B(true);F('');try{await onSave(setAudioDisplay(note.content,0,next));}catch(e){if(mounted.current)F(e instanceof Error?e.message:String(e));}finally{if(mounted.current)B(false);}};
 const retranscribe=async()=>{
  if(active.current||busy||note.deleted)return;
  if(audioNoteTranscript(note.content).trim()&&!confirm('Replace the current transcript with a new transcription of the original recording? You can undo the replacement before saving.'))return;
  const expected=note,controller=new AbortController(),transcriber=new LocalTranscriber();
  const job={cancel:()=>{controller.abort();transcriber.cancel();}};active.current=job;B(true);F('');S('Loading original recording…');
  try{
   const response=await fetch(attachmentUrl(data.audioPath),{signal:controller.signal});if(!response.ok)throw Error('The original recording could not be loaded. Your transcript is unchanged.');
   const blob=await response.blob();if(controller.signal.aborted)return;
   const result=await transcriber.transcribeBlob(blob,message=>{if(mounted.current&&!controller.signal.aborted)S(message);},{language:normalizeVoiceLanguage(localStorage.getItem(VOICE_LANGUAGE_KEY)),keywords:parseVoiceKeywords(localStorage.getItem(VOICE_KEYWORDS_KEY)??'')});
   if(!mounted.current||controller.signal.aborted)return;
   if(latest.current.id!==expected.id||latest.current.path!==expected.path||latest.current.content!==expected.content||latest.current.deleted)throw Error('The Audio Note changed while transcribing. Nothing was replaced.');
   onChange(replaceAudioNoteTranscript(expected.content,result.text));S('Transcript replaced. Save the file to keep it.');
  }catch(e){if(mounted.current&&!controller.signal.aborted)F(e instanceof Error?e.message:String(e));}
  finally{if(active.current===job)active.current=null;if(mounted.current){B(false);if(controller.signal.aborted)S('Re-transcription canceled. Your transcript is unchanged.');}}
 };
 return <section className="audio-note-view" aria-label="Audio Note"><h1>{note.path.split('/').pop()?.replace(/\.md$/i,'')}</h1><StandaloneAudioTrack key={note.id} name={name} url={attachmentUrl(data.audioPath)} initialDisplay={display} onDisplayChange={next=>void saveDisplay(next)}/><div className="audio-note-transcript-heading"><label htmlFor="audio-note-transcript">Transcript</label><button disabled={busy||note.deleted} onClick={()=>void retranscribe()}><RotateCcw aria-hidden="true"/> Re-transcribe</button>{busy&&active.current&&<button onClick={()=>active.current?.cancel()}><Square aria-hidden="true"/> Cancel</button>}</div><textarea id="audio-note-transcript" aria-label="Transcript" value={audioNoteTranscript(note.content)} onChange={e=>change(e.target.value)} rows={14} disabled={busy||note.deleted} spellCheck/><p className="muted">Edit the transcript directly. Use Save in the top bar to keep your changes. The original recording is retained.</p>{linked.length>0&&<nav aria-label="Linked normal files"><h3>Linked files</h3>{linked.map(file=><button key={file.id} disabled={busy} onClick={()=>onOpen(file)}>{file.path}</button>)}</nav>}{status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
