import React,{useState} from 'react';
import type {Note} from '../shared/model';
import {documentLists} from './document-structures';
import './list-view.css';

const checkbox=/^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;
export function ListView({note,onSave}:{note:Note;onSave:(content:string)=>Promise<void>}){
 const [item,setItem]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lists=documentLists(note.content), last=lists.at(-1);
 const title=note.path.split('/').at(-1)?.replace(/\.md$/i,'');
 const save=async(content:string,added=false)=>{setBusy(true);setError('');try{await onSave(content);if(added)setItem('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="interactive-list" aria-label={`${title} list`}><header><p className="muted">List</p><h1>{title}</h1></header>
 {!note.deleted&&<form onSubmit={e=>{e.preventDefault();const value=item.trim();if(!value||busy)return;const marker=last?.style==='numbered'?'1.':last?.style==='lettered'?'a.':last?.style==='bullets'?'*':last?.style==='dash'?'-':'- [ ]';const at=last?.end??note.content.trimEnd().length;const before=note.content.slice(0,at);const after=note.content.slice(at);void save(before+(last?'\n':'\n\n')+marker+' '+value+(after||'\n'),true);}}><input aria-label="New list item" placeholder="Add an item…" value={item} onChange={e=>setItem(e.target.value)} disabled={busy}/><button className="primary" disabled={busy||!item.trim()}>Add item</button></form>}
 {error&&<p role="alert">{error}</p>}{lists.map((list,i)=>{const block=note.content.slice(list.start,list.end);const lines=block.split('\n');let at=list.start;return <section key={i}>{list.title&&list.title!==title&&<h2>{list.title}</h2>}<ul>{lines.slice(lines.length-list.items.length).map((line,j)=>{if(j===0)at+=lines.slice(0,lines.length-list.items.length).reduce((n,s)=>n+s.length+1,0);const offset=at;at+=line.length+1;const check=checkbox.exec(line),entry=list.items[j];return <li key={j} style={{marginInlineStart:`${Math.min(entry.depth,6)}rem`}}>{check?<label><input type="checkbox" checked={check[2].toLowerCase()==='x'} disabled={busy||note.deleted} onChange={e=>{const index=offset+check[1].length;void save(note.content.slice(0,index)+(e.target.checked?'x':' ')+note.content.slice(index+1));}}/><span>{entry.text}</span></label>:<span>{entry.text}</span>}</li>;})}</ul></section>;})}
 {!lists.length&&<p className="muted">No items yet.</p>}</section>;
}
