import React,{useEffect,useState} from 'react';
import type {ListBuilderStyle} from './ListDialog';
import {PresentedListEditor,settingsLine,markers as styleMarkers,heroTag,ratingTag,metadata as tags,metadataPieces,itemLabels} from './PresentedListEditor';
import type {Note} from '../shared/model';
import {documentLists} from './document-structures';
import {attachmentUrl} from './attachment-urls';
import './list-view.css';
import {listTagLine,decodeListTags,normalizeListTags} from './list-tags';
import {ListTagEditor,TagFilter} from './ListTagEditor';

const checkbox=/^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;

export function ListView({note,onSave,uploadImage,embeddedTitle,readOnly=false}:{embeddedTitle?:string;readOnly?:boolean;note:Note;onSave:(content:string)=>Promise<void>;uploadImage:(file:File)=>Promise<string>}){
 const id=React.useId();
 const [item,setItem]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [preview,setPreview]=useState<ListBuilderStyle|null>(null);
 const [modeTab,setModeTab]=useState<'list'|'source'>('list');
 const {content}=note, stored=settingsLine.exec(content);
 const [filter,setFilter]=useState('');
 useEffect(()=>setFilter(''),[note.id]);
 const itemTags=normalizeListTags(Array.from(content.matchAll(/ <!-- spire:list-labels ([^<>]+) -->/g)).flatMap(m=>decodeListTags(m[1])));
 const activeFilter=itemTags.some(t=>t.toLowerCase()===filter)?filter:'';
 const mode=stored?.[1]??(documentLists(content)[0]?.style==='checkboxes'||!documentLists(content).length?'checklist':'plain'), heroes=stored?.[2]==='1', ratings=stored?.[3]==='1';
 const lists=documentLists(content),last=lists.at(-1);
 const markers=stored?.[4]??(last?.style==='numbered'?'numbers':last?.style==='lettered'?'letters':'bullets');
 const displayMode=preview?(preview==='checkboxes'?'checklist':'plain'):mode,displayMarkers=preview?styleMarkers[preview]:markers;
 const title=embeddedTitle??note.path.split('/').at(-1)?.replace(/\.md$/i,'');
 const disabled=readOnly||busy||!!note.deleted;
 const [saveStatus,setSaveStatus]=useState('');
 const saveWithFeedback=async(content:string)=>{setSaveStatus('Saving…');try{await onSave(content);setSaveStatus('Saved');}catch(e){setSaveStatus('');throw e;}};
 const save=async(next:string|(()=>Promise<string>),added=false)=>{setBusy(true);setError('');try{await saveWithFeedback(typeof next==='string'?next:await next());if(added)setItem('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="interactive-list" aria-label={`${title} list`}>
  {!readOnly&&<header className="presented-list-header">{embeddedTitle===undefined&&<h1>{title}</h1>}<div className="presented-list-tabs" role="tablist" aria-label="List view">{(['list','source'] as const).map((tab,index)=><button key={tab} id={`${id}-tab-${tab}`} role="tab" type="button" aria-selected={modeTab===tab} aria-controls={`${id}-panel-${tab}`} tabIndex={modeTab===tab?0:-1} onClick={()=>setModeTab(tab)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'list':event.key==='End'?'source':index===0?'source':'list';setModeTab(next);event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="${id}-tab-${next}"]`)?.focus();}}>{tab==='list'?'List':'Source'}</button>)}</div></header>}
  {!readOnly&&<div role="status">{saveStatus}</div>}
  {!readOnly&&<div role="tabpanel" id={`${id}-panel-source`} aria-labelledby={`${id}-tab-source`} hidden={modeTab!=='source'}>
   {!note.deleted?<PresentedListEditor key={content} note={note} inline uploadImage={uploadImage} onStylePreview={setPreview} onSave={saveWithFeedback} onDone={()=>setModeTab('list')}/>:<p>This list is read-only.</p>}
  </div>}
  <div role={readOnly?undefined:"tabpanel"} id={`${id}-panel-list`} aria-labelledby={readOnly?undefined:`${id}-tab-list`} hidden={modeTab!=='list'}>
  <ListTagEditor label="List tags" values={decodeListTags(listTagLine.exec(content)?.[1])} disabled readOnly onChange={()=>{}}/>
  <TagFilter label="Filter items by tag" tags={itemTags} value={activeFilter} onChange={setFilter}/>
  {!readOnly&&!note.deleted&&<form onSubmit={e=>{e.preventDefault();const value=item.trim();if(!value||disabled)return;const marker=mode==='checklist'?'- [ ]':last?.style==='numbered'?'1.':last?.style==='lettered'?'a.':last?.style==='bullets'?'*':'-';const at=last?.end??(stored?.index??content.length);const before=content.slice(0,at),after=content.slice(at);void save((last?before:before.trimEnd())+(last?'\n':'\n\n')+marker+' '+value+(after.startsWith('\n')?after:'\n'+(after?'\n'+after:'')),true);}}><input aria-label="New list item" placeholder="Add an item…" value={item} onChange={e=>setItem(e.target.value)} disabled={disabled}/><button className="primary" disabled={disabled||!item.trim()}>Add item</button></form>}
  {error&&<p role="alert">{error}</p>}
  {lists.map((list,i)=>{const lines=content.slice(list.start,list.end).split('\n'),skip=lines.length-list.items.length;let at=list.start+lines.slice(0,skip).reduce((n,s)=>n+s.length+1,0);const Items=displayMode==='plain'&&(displayMarkers==='numbers'||displayMarkers==='letters')?'ol':'ul';return <section key={i}>{list.title&&list.title!==title&&<h2>{list.title}</h2>}<Items className={displayMode==='plain'?`list-markers-${displayMarkers}`:undefined}>{lines.slice(skip).map((raw,j)=>{
   const offset=at;at+=raw.length+1;const line=raw.replace(/\r$/,''),cr=raw.endsWith('\r')?'\r':'';
   const check=checkbox.exec(line), entry=list.items[j];
   const [meta='']=tags.exec(line)??[];
   const pieces=metadataPieces(meta);
   const hero=pieces.map(s=>heroTag.exec(s)).find(Boolean),rating=pieces.map(s=>ratingTag.exec(s)?.[1]).find(Boolean);
   const x=Math.min(100,Number(hero?.[2]??50)),y=Math.min(100,Number(hero?.[3]??50));
   const text=entry.text.replace(tags,'');
   const replace=(updated:string)=>content.slice(0,offset)+updated+cr+content.slice(offset+raw.length);
   const labels=itemLabels(pieces);
   if(activeFilter&&!labels.some(t=>t.toLowerCase()===activeFilter))return null;
   return <li key={j} style={{marginInlineStart:`${Math.min(entry.depth,6)}rem`}}>
    {heroes&&hero&&<img className="list-item-hero" alt="" loading="lazy" src={attachmentUrl(hero[1])} style={{objectPosition:`${x}% ${y}%`}}/>}
    {displayMode==='checklist'?<label><input type="checkbox" checked={check?.[2].toLowerCase()==='x'} disabled={disabled||preview!==null} onChange={e=>{const mark=e.target.checked?'x':' ';const updated=check?line.slice(0,check[1].length)+mark+line.slice(check[1].length+1):line.replace(/^(\s*)(?:[-*+]|\d+[.)]|[a-z][.)])([ \t]+)/i,`$1- [${mark}]$2`);void save(replace(updated));}}/><span>{text}</span></label>:<span>{text}</span>}
    <ListTagEditor label={`Tags for ${text}`} values={labels} disabled readOnly onChange={()=>{}}/>
    {ratings&&rating&&rating!=='none'&&<span className="list-item-rating">Rating: {rating} / 5</span>}
   </li>;
  })}</Items></section>;})}
  {!lists.length&&<p className="muted">No items yet.</p>}
  </div>
 </section>;
}
