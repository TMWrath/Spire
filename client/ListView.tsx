import React,{useEffect,useState} from 'react';
import type {ListBuilderStyle} from './ListDialog';
import {createPortal} from 'react-dom';
import {PresentedListEditor,settingsLine,markers as styleMarkers} from './PresentedListEditor';
import type {Note} from '../shared/model';
import {documentLists} from './document-structures';
import {attachmentUrl} from './attachment-urls';
import './list-view.css';
import {listTagLine,decodeListTags,encodeListTags,normalizeListTags,setListLabels} from './list-tags';
import {ListTagEditor,TagFilter} from './ListTagEditor';

const checkbox=/^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;
const ratingTag=/ <!-- spire:list-rating (none|[1-5](?:\.5)?|0\.5) -->$/;
const heroTag=/ <!-- spire:list-hero (Attachments\/[\w./-]+)(?: (\d{1,3}) (\d{1,3}))? -->$/;
const tags=/((?: <!-- spire:list-(?:hero|rating|labels) [^<>]+ -->)+)$/;

export function ListView({note,onSave,uploadImage,contextTarget}:{note:Note;contextTarget:HTMLDivElement|null;onSave:(content:string)=>Promise<void>;uploadImage:(file:File)=>Promise<string>}){
 const [item,setItem]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [framing,setFraming]=useState<{row:string;x:number;y:number}|null>(null);
 useEffect(()=>{setFraming(null);},[note.id]);
 const [preview,setPreview]=useState<ListBuilderStyle|null>(null);
 useEffect(()=>{if(!contextTarget)setPreview(null);},[contextTarget]);
 const {content}=note, stored=settingsLine.exec(content);
 const [filter,setFilter]=useState('');
 useEffect(()=>setFilter(''),[note.id]);
 const itemTags=normalizeListTags(Array.from(content.matchAll(/ <!-- spire:list-labels ([^<>]+) -->/g)).flatMap(m=>decodeListTags(m[1])));
 const activeFilter=itemTags.some(t=>t.toLowerCase()===filter)?filter:'';
 const mode=stored?.[1]??(documentLists(content)[0]?.style==='checkboxes'||!documentLists(content).length?'checklist':'plain'), heroes=stored?.[2]==='1', ratings=stored?.[3]==='1';
 const lists=documentLists(content),last=lists.at(-1);
 const markers=stored?.[4]??(last?.style==='numbered'?'numbers':last?.style==='lettered'?'letters':'bullets');
 const displayMode=preview?(preview==='checkboxes'?'checklist':'plain'):mode,displayMarkers=preview?styleMarkers[preview]:markers;
 const title=note.path.split('/').at(-1)?.replace(/\.md$/i,'');
 const disabled=busy||!!note.deleted;
 const save=async(next:string|(()=>Promise<string>),added=false,positionSaved=false)=>{setBusy(true);setError('');try{await onSave(typeof next==='string'?next:await next());if(added)setItem('');if(positionSaved)setFraming(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="interactive-list" aria-label={`${title} list`}>
  <header><h1>{title}</h1></header>
  <ListTagEditor label="List tags" values={decodeListTags(listTagLine.exec(content)?.[1])} disabled={disabled} readOnly={!!note.deleted} onChange={values=>void save(setListLabels(content,values))}/>
  <TagFilter label="Filter items by tag" tags={itemTags} value={activeFilter} onChange={setFilter}/>
  {!note.deleted&&contextTarget&&createPortal(<PresentedListEditor key={note.id} note={note} inline onStylePreview={setPreview} onSave={onSave}/>,contextTarget)}
  {!note.deleted&&<form onSubmit={e=>{e.preventDefault();const value=item.trim();if(!value||disabled)return;const marker=mode==='checklist'?'- [ ]':last?.style==='numbered'?'1.':last?.style==='lettered'?'a.':last?.style==='bullets'?'*':'-';const at=last?.end??(stored?.index??content.length);const before=content.slice(0,at),after=content.slice(at);void save((last?before:before.trimEnd())+(last?'\n':'\n\n')+marker+' '+value+(after.startsWith('\n')?after:'\n'+(after?'\n'+after:'')),true);}}><input aria-label="New list item" placeholder="Add an item…" value={item} onChange={e=>setItem(e.target.value)} disabled={disabled}/><button className="primary" disabled={disabled||!item.trim()}>Add item</button></form>}
  {error&&<p role="alert">{error}</p>}
  {lists.map((list,i)=>{const lines=content.slice(list.start,list.end).split('\n'),skip=lines.length-list.items.length;let at=list.start+lines.slice(0,skip).reduce((n,s)=>n+s.length+1,0);const Items=displayMode==='plain'&&(displayMarkers==='numbers'||displayMarkers==='letters')?'ol':'ul';return <section key={i}>{list.title&&list.title!==title&&<h2>{list.title}</h2>}<Items className={displayMode==='plain'?`list-markers-${displayMarkers}`:undefined}>{lines.slice(skip).map((raw,j)=>{
   const offset=at;at+=raw.length+1;const line=raw.replace(/\r$/,''),cr=raw.endsWith('\r')?'\r':'';
   const check=checkbox.exec(line), entry=list.items[j];
   const [meta='']=tags.exec(line)??[];
   const pieces=meta.match(/ <!-- spire:list-(?:hero|rating|labels) [^<>]+ -->/g)??[];
   const hero=pieces.map(s=>heroTag.exec(s)).find(Boolean),rating=pieces.map(s=>ratingTag.exec(s)?.[1]).find(Boolean);
   const row=`${i}:${j}`,frame=framing?.row===row?framing:null;
   const x=frame?.x??Math.min(100,Number(hero?.[2]??50)),y=frame?.y??Math.min(100,Number(hero?.[3]??50));
   const text=entry.text.replace(tags,'');
   const replace=(updated:string)=>content.slice(0,offset)+updated+cr+content.slice(offset+raw.length);
   const setTag=(kind:string,value:string)=>replace((meta?line.slice(0,-meta.length):line)+pieces.filter(s=>!s.startsWith(` <!-- spire:list-${kind} `)).join('')+(value?` <!-- spire:list-${kind} ${value} -->`:''));
   const labels=decodeListTags(pieces.find(s=>s.startsWith(' <!-- spire:list-labels '))?.slice(' <!-- spire:list-labels '.length,-4));
   if(activeFilter&&!labels.some(t=>t.toLowerCase()===activeFilter))return null;
   return <li key={j} style={{marginInlineStart:`${Math.min(entry.depth,6)}rem`}}>
    {heroes&&hero&&<img className="list-item-hero" alt="" loading="lazy" src={attachmentUrl(hero[1])} style={{objectPosition:`${x}% ${y}%`}}/>}
    {displayMode==='checklist'?<label><input type="checkbox" checked={check?.[2].toLowerCase()==='x'} disabled={disabled||preview!==null} onChange={e=>{const mark=e.target.checked?'x':' ';const updated=check?line.slice(0,check[1].length)+mark+line.slice(check[1].length+1):line.replace(/^(\s*)(?:[-*+]|\d+[.)]|[a-z][.)])([ \t]+)/i,`$1- [${mark}]$2`);void save(replace(updated));}}/><span>{text}</span></label>:<span>{text}</span>}
    <ListTagEditor label={`Tags for ${text}`} values={labels} disabled={disabled} readOnly={!!note.deleted} onChange={values=>void save(setTag('labels',values.length?encodeListTags(values):''))}/>
    {(ratings||(heroes&&!note.deleted))&&<div className="list-item-options">
     {ratings&&<label>Rating <select aria-label={`Rating for ${text}`} disabled={disabled} value={rating??'none'} onChange={e=>void save(setTag('rating',e.target.value))}><option value="none">Not rated</option>{Array.from({length:10},(_,index)=>(index+1)/2).map(value=><option key={value} value={value}>{value} / 5</option>)}</select></label>}
     {heroes&&!note.deleted&&<><label className="list-image-upload">{hero?'Replace hero image':'Add hero image'}<input type="file" aria-label={`Hero image for ${text}`} accept="image/png,image/jpeg,image/webp,image/gif" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void save(async()=>{const path=await uploadImage(file);setFraming({row,x:50,y:50});return setTag('hero',path);});}}/></label>{hero&&<><button type="button" disabled={disabled} onClick={()=>setFraming({row,x,y})}>Reposition hero image</button><button type="button" disabled={disabled} onClick={()=>{setFraming(null);void save(setTag('hero',''));}}>Remove hero image</button></>}</>}
    </div>}
    {heroes&&hero&&frame&&!note.deleted&&<fieldset className="list-hero-framing" disabled={disabled}><legend>Hero image position</legend>
     <label>Horizontal position<input type="range" min="0" max="100" value={x} onChange={e=>setFraming({...frame,x:Number(e.target.value)})}/></label>
     <label>Vertical position<input type="range" min="0" max="100" value={y} onChange={e=>setFraming({...frame,y:Number(e.target.value)})}/></label>
     <button type="button" onClick={()=>void save(setTag('hero',`${hero[1]} ${x} ${y}`),false,true)}>Save position</button>
     <button type="button" onClick={()=>setFraming(null)}>Cancel</button>
    </fieldset>}
   </li>;
  })}</Items></section>;})}
  {!lists.length&&<p className="muted">No items yet.</p>}
 </section>;
}
