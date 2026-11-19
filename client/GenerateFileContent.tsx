import React,{useRef,useState} from 'react';
import {FileText,Music2} from 'lucide-react';
import {convertDocument,documentAccept,type DocumentKind} from './document-conversion';
import {VoiceAuthoring,type VoiceAcceptance} from './VoiceAuthoring';
import './create-files.css';

const warning='Generating new content will overwrite any edits already made to this file. This cannot be undone after you save.';
export function GenerateFileContent({scope,path,attachments,disabled,onGenerate,onAudio}:{scope:string;path:string;attachments:string[];disabled?:boolean;onGenerate:(content:string)=>void;onAudio:(value:VoiceAcceptance)=>Promise<void>}){
 const[audio,setAudio]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inputs=useRef<Record<string,HTMLInputElement|null>>({});
 const approve=()=>confirm('This will overwrite any edits already made to this file. Continue?');
 const blank=()=>{if(approve())onGenerate('');};
 const begin=(kind:DocumentKind)=>{if(!approve())return;inputs.current[kind]?.click();};
 const choose=async(kind:DocumentKind,file?:File)=>{if(!file)return;setBusy(true);setError('');try{const result=await convertDocument(file,kind);onGenerate(result.markdown);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const beginAudio=()=>{if(approve())setAudio(true);};
 if(audio)return <VoiceAuthoring kind="file" scope={scope+':generate'} defaultPath={path} attachments={attachments} onAccept={onAudio} onClose={()=>setAudio(false)}/>;
 return <section className="generate-file-content" role="region" aria-label="Generate file content">
  <p className="generate-warning" role="note"><strong>Warning:</strong> {warning}</p>
  <div className="create-file-options">
   <button disabled={disabled||busy} onClick={blank}><FileText/><span><strong>New blank file</strong><small>Replace this file with a blank Markdown document</small></span></button>
   {([['pdf','From PDF','Extract readable text from a PDF'],['word','From Word','Import a .docx document'],['odf','From OpenDocument','Import .odt or .fodt text documents']] as const).map(([kind,title,description])=><React.Fragment key={kind}><button disabled={disabled||busy} onClick={()=>begin(kind)}><FileText/><span><strong>{title}</strong><small>{description}</small></span></button><input hidden ref={node=>{inputs.current[kind]=node;}} type="file" accept={documentAccept[kind]} onChange={event=>{const file=event.target.files?.[0];event.target.value='';void choose(kind,file);}}/></React.Fragment>)}
   <button disabled={disabled||busy} onClick={beginAudio}><Music2/><span><strong>From audio</strong><small>Transcribe audio into this file</small></span></button>
  </div>
  {busy&&<p role="status">Generating content…</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
