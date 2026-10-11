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
 onDone:(dictionaryId:string,term:string,definition:string)=>Promise<void>;
};

export function DefinitionCommandDialog({notes,source,term:initialTerm,onCancel,onEnsureDictionary,onDone}:Props){
 const dictionaries=useMemo(()=>dictionaryFiles(notes),[notes]);
 const [dictionaryId,setDictionaryId]=useState(dictionaries[0]?.id??'');
 const [term,setTerm]=useState(initialTerm);
 const [definition,setDefinition]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const ensurePromise=useRef<Promise<string>|null>(null);
 useEffect(()=>{let active=true;setBusy(true);const ensure=ensurePromise.current??=onEnsureDictionary(source);ensure.then(id=>{if(active)setDictionaryId(id);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Unable to prepare the dictionary.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[source.id]);
 const submit=(event:React.FormEvent)=>{event.preventDefault();if(busy||!dictionaryId)return;setBusy(true);setError('');void onDone(dictionaryId,term,definition).catch(reason=>{setError(reason instanceof Error?reason.message:'Unable to add the definition.');setBusy(false);});};
 return <div className="term-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}>
  <section className="term-dialog definition-command-dialog" role="dialog" aria-modal="true" aria-label="Add definition">
   <header className="term-dialog-header"><div><small>SPIRE / @DEF</small><h2>Add definition</h2><p>The command is removed from your writing and this entry is added to the selected dictionary file.</p></div><button type="button" aria-label="Close add definition" disabled={busy} onClick={onCancel}><X/></button></header>
   <div className="term-dialog-body">{error&&<p className="term-error" role="alert">{error}</p>}{dictionaries.length&&dictionaryId?<form onSubmit={submit}>
    <label>Dictionary file<select aria-label="Dictionary file" value={dictionaryId} onChange={event=>setDictionaryId(event.target.value)} required>{dictionaries.map(note=><option key={note.id} value={note.id}>{note.path}</option>)}</select></label>
    <label>Word or term<input aria-label="Word or term" value={term} onChange={event=>setTerm(event.target.value)} required/></label>
    <label>Definition<textarea aria-label="Definition" autoFocus={!touchEditing()} value={definition} onChange={event=>setDefinition(event.target.value)} required/></label>
    <footer><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={busy||!term.trim()||!definition.trim()}>Done</button></footer>
   </form>:<div className="term-empty"><h3>Preparing dictionary…</h3><p>Spire is creating a portable dictionary beside this file.</p></div>}</div>
  </section>
 </div>;
}
