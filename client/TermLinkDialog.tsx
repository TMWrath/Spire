import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Plus,X} from 'lucide-react';
import type {Note} from '../shared/model';
import {dictionaryEntries,dictionaryFiles,relativeTermTarget,termLinkMarkdown} from './dictionary';
import {touchEditing} from './editor-focus';

type Props={
 source:Note;
 notes:Note[];
 selectedText:string;
 onCancel:()=>void;
 onInsert:(markdown:string)=>void;
 onCreateDictionary:(name:string)=>Promise<string>;
 onAddTerm:(dictionaryId:string,term:string,definition:string)=>Promise<string>;
};

type View='browse'|'create'|'add';

export function TermLinkDialog({source,notes,selectedText,onCancel,onInsert,onCreateDictionary,onAddTerm}:Props){
 const dictionaries=useMemo(()=>dictionaryFiles(notes),[notes]);
 const [dictionaryId,setDictionaryId]=useState(dictionaries[0]?.id??'');
 const [preferredDictionaryId,setPreferredDictionaryId]=useState('');
 const dictionary=dictionaries.find(n=>n.id===dictionaryId)??dictionaries.find(n=>n.id===preferredDictionaryId)??dictionaries[0];
 const entries=useMemo(()=>dictionary?dictionaryEntries(dictionary):[],[dictionary]);
 const [termAnchor,setTermAnchor]=useState(entries[0]?.anchor??'');
 const [pendingAnchor,setPendingAnchor]=useState('');
 const [query,setQuery]=useState('');
 const [label,setLabel]=useState(selectedText);
 const [view,setView]=useState<View>('browse');
 const [pageName,setPageName]=useState('Dictionary');
 const [term,setTerm]=useState(selectedText.trim());
 const [definition,setDefinition]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{if(!dictionaryId&&dictionaries[0])setDictionaryId(preferredDictionaryId||dictionaries[0].id);},[dictionaries,dictionaryId,preferredDictionaryId]);
 useEffect(()=>{const next=pendingAnchor&&entries.some(entry=>entry.anchor===pendingAnchor)?pendingAnchor:entries[0]?.anchor??'';setTermAnchor(next);if(next===pendingAnchor)setPendingAnchor('');},[dictionaryId,entries,pendingAnchor]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')view==='browse'?onCancel():setView('browse');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onCancel,view]);
 const visible=entries.filter(entry=>!query.trim()||(`${entry.term} ${entry.definition}`).toLowerCase().includes(query.trim().toLowerCase()));
 const chosen=entries.find(entry=>entry.anchor===termAnchor)??visible[0];
 const perform=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(reason){setError(reason instanceof Error?reason.message:'Unable to update the dictionary.');}finally{setBusy(false);}};
 const createPage=(event:React.FormEvent)=>{event.preventDefault();void perform(async()=>{const id=await onCreateDictionary(pageName);setPreferredDictionaryId(id);setDictionaryId(id);setView('add');setTerm(selectedText.trim());});};
 const saveTerm=(event:React.FormEvent)=>{event.preventDefault();if(!dictionary)return;void perform(async()=>{const anchor=await onAddTerm(dictionary.id,term,definition);setPendingAnchor(anchor);setQuery('');setView('browse');setDefinition('');});};
 return <div className="term-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel();}}>
  <section className="term-dialog" role="dialog" aria-modal="true" aria-label="Link to dictionary term">
   <header className="term-dialog-header"><div><small>SPIRE / DICTIONARY</small><h2>{view==='create'?'Create dictionary page':view==='add'?'Add word':'Link to term'}</h2><p>{view==='browse'?'Your text stays portable as a regular Markdown link.':view==='create'?'Create a portable Markdown dictionary without leaving your writing.':'Add a heading and definition to the selected dictionary page.'}</p></div><button aria-label="Close term link" onClick={onCancel}><X/></button></header>
   <div className="term-dialog-body">
    {error&&<p className="term-error" role="alert">{error}</p>}
    {view==='create'?<form onSubmit={createPage}><label>Dictionary page name<input aria-label="Dictionary page name" value={pageName} onChange={event=>setPageName(event.target.value)} autoFocus={!touchEditing()} required/></label><p className="term-help">Saved as a regular Markdown file in the Dictionary folder.</p><footer><button type="button" onClick={()=>setView('browse')}>Back</button><button className="primary" type="submit" disabled={busy||!pageName.trim()}>Create page</button></footer></form>:
    view==='add'?<form onSubmit={saveTerm}><label>Dictionary<select aria-label="Dictionary file for new word" value={dictionary?.id??''} onChange={event=>setDictionaryId(event.target.value)}>{dictionaries.map(note=><option key={note.id} value={note.id}>{note.path}</option>)}</select></label><label>Word or term<input aria-label="Word or term" value={term} onChange={event=>setTerm(event.target.value)} autoFocus={!touchEditing()} required/></label><label>Definition<textarea aria-label="Definition" value={definition} onChange={event=>setDefinition(event.target.value)} rows={5} required/></label><footer><button type="button" onClick={()=>setView('browse')}>Back</button><button className="primary" type="submit" disabled={busy||!dictionary||!term.trim()||!definition.trim()}>Save word</button></footer></form>:
    dictionaries.length===0?<div className="term-empty"><BookOpen/><div><h3>No dictionary pages yet</h3><p>Create one here, then add your first word and definition. It stays a normal portable Markdown file.</p></div><button className="primary" type="button" onClick={()=>setView('create')}><Plus/>Create dictionary page</button></div>:
    <form onSubmit={event=>{event.preventDefault();if(!dictionary||!chosen||!label.trim())return;const target=relativeTermTarget(source.path,dictionary.path,chosen.anchor);onInsert(termLinkMarkdown(label,target));}}><div className="term-dictionary-row"><label>Dictionary<select aria-label="Dictionary file" value={dictionary?.id??''} onChange={event=>setDictionaryId(event.target.value)}>{dictionaries.map(note=><option key={note.id} value={note.id}>{note.path}</option>)}</select></label><button type="button" onClick={()=>{setTerm(selectedText.trim());setView('add');}}><Plus/>Add word</button></div><label>Find a term<input aria-label="Find dictionary term" autoFocus={!touchEditing()} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search terms or definitions"/></label><label>Term<select aria-label="Dictionary term" value={chosen?.anchor??''} onChange={event=>setTermAnchor(event.target.value)}>{visible.map(entry=><option key={entry.anchor} value={entry.anchor}>{entry.term}</option>)}</select></label><label>Linked text<input aria-label="Linked text" value={label} onChange={event=>setLabel(event.target.value)} required/></label>{chosen&&<div className="term-definition"><strong>{chosen.term}</strong><p>{chosen.definition||'No definition has been written yet.'}</p></div>}<footer><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={!chosen||!label.trim()}>Insert term link</button></footer></form>}
   </div>
  </section>
 </div>;
}
