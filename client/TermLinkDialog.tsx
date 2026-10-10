import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,X} from 'lucide-react';
import type {Note} from '../shared/model';
import {dictionaryEntries,dictionaryFiles,relativeTermTarget,termLinkMarkdown} from './dictionary';
import {touchEditing} from './editor-focus';

type Props={source:Note;notes:Note[];selectedText:string;onCancel:()=>void;onInsert:(markdown:string)=>void};
export function TermLinkDialog({source,notes,selectedText,onCancel,onInsert}:Props){
 const dictionaries=useMemo(()=>dictionaryFiles(notes),[notes]);
 const [dictionaryId,setDictionaryId]=useState(dictionaries[0]?.id??'');
 const dictionary=dictionaries.find(n=>n.id===dictionaryId)??dictionaries[0];
 const entries=useMemo(()=>dictionary?dictionaryEntries(dictionary):[],[dictionary]);
 const [termAnchor,setTermAnchor]=useState(entries[0]?.anchor??'');
 const [query,setQuery]=useState('');
 const [label,setLabel]=useState(selectedText);
 useEffect(()=>{setTermAnchor(entries[0]?.anchor??'');},[dictionaryId]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onCancel();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onCancel]);
 const visible=entries.filter(e=>!query.trim()||(`${e.term} ${e.definition}`).toLowerCase().includes(query.trim().toLowerCase()));
 const chosen=entries.find(e=>e.anchor===termAnchor)??visible[0];
 return <div className="term-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}><section className="term-dialog" role="dialog" aria-modal="true" aria-label="Link to dictionary term"><header><div><small>SPIRE / DICTIONARY</small><h2>Link to term</h2><p>Your text stays portable as a regular Markdown link.</p></div><button aria-label="Close term link" onClick={onCancel}><X/></button></header>{dictionaries.length===0?<div className="term-empty"><BookOpen/><h3>No dictionary files yet</h3><p>Create a Markdown file with <code>spire_type: dictionary</code> in its frontmatter, then add each term as a heading.</p></div>:<form onSubmit={e=>{e.preventDefault();if(!dictionary||!chosen||!label.trim())return;const target=relativeTermTarget(source.path,dictionary.path,chosen.anchor);onInsert(termLinkMarkdown(label,target));}}><label>Dictionary<select aria-label="Dictionary file" value={dictionary?.id??''} onChange={e=>setDictionaryId(e.target.value)}>{dictionaries.map(n=><option key={n.id} value={n.id}>{n.path}</option>)}</select></label><label>Find a term<input aria-label="Find dictionary term" autoFocus={!touchEditing()} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search terms or definitions"/></label><label>Term<select aria-label="Dictionary term" value={chosen?.anchor??''} onChange={e=>setTermAnchor(e.target.value)}>{visible.map(e=><option key={e.anchor} value={e.anchor}>{e.term}</option>)}</select></label><label>Linked text<input aria-label="Linked text" value={label} onChange={e=>setLabel(e.target.value)} required/></label>{chosen&&<div className="term-definition"><strong>{chosen.term}</strong><p>{chosen.definition||'No definition has been written yet.'}</p></div>}<footer><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={!chosen||!label.trim()}>Insert term link</button></footer></form>}</section></div>;
}
