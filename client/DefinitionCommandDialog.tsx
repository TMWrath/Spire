import React,{useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import type {Note} from '../shared/model';
import {dictionaryFiles} from './dictionary';
import {touchEditing} from './editor-focus';

type Props={
 notes:Note[];
 source:Note;
 term:string;
 onCancel:()=>void;
 onEnsureDictionary:(source:Note)=>Promise<string>;
 onDone:(location:'document'|'dictionary',dictionaryId:string,term:string,definition:string)=>Promise<void>;
};

export function DefinitionCommandDialog({notes,source,term:initialTerm,onCancel,onEnsureDictionary,onDone}:Props){
 const dictionaries=useMemo(()=>dictionaryFiles(notes),[notes]);
 const [dictionaryId,setDictionaryId]=useState(dictionaries[0]?.id??'');
 const [location,setLocation]=useState<'document'|'dictionary'>('document');
 const [term,setTerm]=useState(initialTerm);
 const [definition,setDefinition]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const ensurePromise=useRef<Promise<string>|null>(null);
 useEffect(()=>{if(location!=='dictionary'||dictionaryId)return;let active=true;setBusy(true);const ensure=ensurePromise.current??=onEnsureDictionary(source);ensure.then(id=>{if(active)setDictionaryId(id);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Unable to prepare the dictionary.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[location,dictionaryId,source.id]);
 const submit=(event:React.FormEvent)=>{event.preventDefault();if(busy||(location==='dictionary'&&!dictionaryId))return;setBusy(true);setError('');void onDone(location,dictionaryId,term,definition).catch(reason=>{setError(reason instanceof Error?reason.message:'Unable to add the definition.');setBusy(false);});};
 return <div className="term-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}>
  <section className="term-dialog definition-command-dialog" role="dialog" aria-modal="true" aria-label="Add definition">
   <header className="term-dialog-header"><div><small>SPIRE / @DEF</small><h2>Add definition</h2><p>The command becomes the term in your writing. Keep its definition in this file or add it to a separate dictionary.</p></div><button type="button" aria-label="Close add definition" disabled={busy} onClick={onCancel}><X/></button></header>
   <div className="term-dialog-body">{error&&<p className="term-error" role="alert">{error}</p>}<form onSubmit={submit}>
    <label>Definition location<select aria-label="Definition location" value={location} onChange={event=>setLocation(event.target.value as 'document'|'dictionary')}><option value="document">Current file</option><option value="dictionary">Dictionary file</option></select></label>
    {location==='dictionary'&&<label>Dictionary file<select aria-label="Dictionary file" value={dictionaryId} onChange={event=>setDictionaryId(event.target.value)} required disabled={busy}>{dictionaries.map(note=><option key={note.id} value={note.id}>{note.path}</option>)}{!dictionaryId&&<option value="">Preparing dictionary…</option>}</select></label>}
    <label>Word or term<input aria-label="Word or term" value={term} onChange={event=>setTerm(event.target.value)} required/></label>
    <label>Definition<textarea aria-label="Definition" autoFocus={!touchEditing()} value={definition} onChange={event=>setDefinition(event.target.value)} required/></label>
    <footer><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={busy||!term.trim()||!definition.trim()}>Done</button></footer>
   </form></div>
  </section>
 </div>;
}
