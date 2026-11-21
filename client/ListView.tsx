import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {PresentedListEditor,settingsLine} from './PresentedListEditor';
import type {Note} from '../shared/model';
import {documentLists} from './document-structures';
import {attachmentUrl} from './attachment-urls';
import './list-view.css';

const checkbox=/^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;
const ratingTag=/ <!-- spire:list-rating (none|[1-5](?:\.5)?|0\.5) -->$/;
const heroTag=/ <!-- spire:list-hero (Attachments\/[\w./-]+) -->$/;
const tags=/((?: <!-- spire:list-(?:hero|rating) [^<>]+ -->)+)$/;

export function ListView({note,onSave,uploadImage,contextTarget}:{note:Note;contextTarget:HTMLDivElement|null;onSave:(content:string)=>Promise<void>;uploadImage:(file:File)=>Promise<string>}){
 const [item,setItem]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const {content}=note, stored=settingsLine.exec(content);
 const mode=stored?.[1]??(documentLists(content)[0]?.style==='checkboxes'||!documentLists(content).length?'checklist':'plain'), heroes=stored?.[2]==='1', ratings=stored?.[3]==='1';
 const lists=documentLists(content),last=lists.at(-1);
 const markers=stored?.[4]??(last?.style==='numbered'?'numbers':last?.style==='lettered'?'letters':'bullets');
 const title=note.path.split('/').at(-1)?.replace(/\.md$/i,'');
 const disabled=busy||!!note.deleted;
 const save=async(next:string|(()=>Promise<string>),added=false)=>{setBusy(true);setError('');try{await onSave(typeof next==='string'?next:await next());if(added)setItem('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="interactive-list" aria-label={`${title} list`}>
  <header><p className="muted">List</p><h1>{title}</h1></header>
  {!note.deleted&&contextTarget&&createPortal(<PresentedListEditor key={note.id} note={note} inline onSave={onSave}/>,contextTarget)}
  {!note.deleted&&<form onSubmit={e=>{e.preventDefault();const value=item.trim();if(!value||disabled)return;const marker=mode==='checklist'?'- [ ]':last?.style==='numbered'?'1.':last?.style==='lettered'?'a.':last?.style==='bullets'?'*':'-';const at=last?.end??(stored?.index??content.length);const before=content.slice(0,at),after=content.slice(at);void save((last?before:before.trimEnd())+(last?'\n':'\n\n')+marker+' '+value+(after.startsWith('\n')?after:'\n'+(after?'\n'+after:'')),true);}}><input aria-label="New list item" placeholder="Add an item…" value={item} onChange={e=>setItem(e.target.value)} disabled={disabled}/><button className="primary" disabled={disabled||!item.trim()}>Add item</button></form>}
  {error&&<p role="alert">{error}</p>}
  {lists.map((list,i)=>{const lines=content.slice(list.start,list.end).split('\n'),skip=lines.length-list.items.length;let at=list.start+lines.slice(0,skip).reduce((n,s)=>n+s.length+1,0);const Items=mode==='plain'&&(markers==='numbers'||markers==='letters')?'ol':'ul';return <section key={i}>{list.title&&list.title!==title&&<h2>{list.title}</h2>}<Items className={mode==='plain'?`list-markers-${markers}`:undefined}>{lines.slice(skip).map((raw,j)=>{
   const offset=at;at+=raw.length+1;const line=raw.replace(/\r$/,''),cr=raw.endsWith('\r')?'\r':'';
   const check=checkbox.exec(line), entry=list.items[j];
   const [meta='']=tags.exec(line)??[];
   const pieces=meta.match(/ <!-- spire:list-(?:hero|rating) [^<>]+ -->/g)??[];
   const hero=pieces.map(s=>heroTag.exec(s)?.[1]).find(Boolean),rating=pieces.map(s=>ratingTag.exec(s)?.[1]).find(Boolean);
   const text=entry.text.replace(tags,'');
   const replace=(updated:string)=>content.slice(0,offset)+updated+cr+content.slice(offset+raw.length);
   const setTag=(kind:string,value:string)=>replace((meta?line.slice(0,-meta.length):line)+pieces.filter(s=>!s.startsWith(` <!-- spire:list-${kind} `)).join('')+(value?` <!-- spire:list-${kind} ${value} -->`:''));
   return <li key={j} style={{marginInlineStart:`${Math.min(entry.depth,6)}rem`}}>
    {heroes&&hero&&<img className="list-item-hero" alt="" loading="lazy" src={attachmentUrl(hero)}/>}
    {mode==='checklist'?<label><input type="checkbox" checked={check?.[2].toLowerCase()==='x'} disabled={disabled} onChange={e=>{const mark=e.target.checked?'x':' ';const updated=check?line.slice(0,check[1].length)+mark+line.slice(check[1].length+1):line.replace(/^(\s*)(?:[-*+]|\d+[.)]|[a-z][.)])([ \t]+)/i,`$1- [${mark}]$2`);void save(replace(updated));}}/><span>{text}</span></label>:<span>{text}</span>}
    {(ratings||(heroes&&!note.deleted))&&<div className="list-item-options">
     {ratings&&<label>Rating <select aria-label={`Rating for ${text}`} disabled={disabled} value={rating??'none'} onChange={e=>void save(setTag('rating',e.target.value))}><option value="none">Not rated</option>{Array.from({length:10},(_,index)=>(index+1)/2).map(value=><option key={value} value={value}>{value} / 5</option>)}</select></label>}
     {heroes&&!note.deleted&&<><label className="list-image-upload">{hero?'Replace hero image':'Add hero image'}<input type="file" aria-label={`Hero image for ${text}`} accept="image/png,image/jpeg,image/webp,image/gif" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void save(async()=>setTag('hero',await uploadImage(file)));}}/></label>{hero&&<button type="button" disabled={disabled} onClick={()=>void save(setTag('hero',''))}>Remove hero image</button>}</>}
    </div>}
   </li>;
  })}</Items></section>;})}
  {!lists.length&&<p className="muted">No items yet.</p>}
 </section>;
}
