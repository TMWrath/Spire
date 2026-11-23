import React,{useMemo,useState} from 'react';
import {attachmentUrl} from './attachment-urls';
import {ListTagEditor} from './ListTagEditor';
import {decodeListTags,encodeListTags,listTagLine,setListLabels} from './list-tags';
import type {Note} from '../shared/model';
import {ListDialog,marker,type ListBuilderStyle} from './ListDialog';
import {documentLists,replaceDocumentStructure} from './document-structures';

export const settingsLine=/^<!-- spire:list-options (plain|checklist) ([01]) ([01])(?: (bullets|numbers|letters|dashes))? -->\r?$/m;
export const markers={bullets:'bullets',numbered:'numbers',lettered:'letters',dash:'dashes',checkboxes:'bullets'} as const;
export const heroTag=/ <!-- spire:list-hero (Attachments\/[\w./-]+)(?: (\d{1,3}) (\d{1,3}))? -->$/;
export const ratingTag=/ <!-- spire:list-rating (none|[1-5](?:\.5)?|0\.5) -->$/;
export const metadata=/((?: <!-- spire:list-(?:hero|rating|labels) [^<>]+ -->)+)$/;
export function PresentedListEditor({note,inline,onCancel,onSave,onStylePreview,onDone,uploadImage}:{note:Note;uploadImage:(file:File)=>Promise<string>;inline?:boolean;onCancel?:()=>void;onDone?:()=>void;onStylePreview?:(style:ListBuilderStyle|null)=>void;onSave:(content:string)=>Promise<void>}){
 const [source,setSource]=useState(note.content),[generation,reset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const {stored,list}=useMemo(()=>({stored:settingsLine.exec(source),list:documentLists(source)[0]}),[source]);
 const [heroes,setHeroes]=useState(stored?.[2]==='1'),[ratings,setRatings]=useState(stored?.[3]==='1');
 const style:ListBuilderStyle=stored?.[1]==='checklist'?'checkboxes':stored?.[1]==='plain'?stored[4]==='numbers'?'numbered':stored[4]==='letters'?'lettered':stored[4]==='dashes'?'dash':'bullets':list?.style??'checkboxes';
 const initial=useMemo(()=>{
  const rows=list?source.slice(list.start,list.end).split('\n').slice(-list.items.length):[];
  return {title:list?.title??'',style,items:list?.items.map((item,i)=>({...item,text:item.text.trimEnd().replace(metadata,''),metadata:metadata.exec(item.text.trimEnd())?.[0],checked:/^\s*-\s+\[[xX]\]/.test(rows[i])}))??[]};
 },[list,source,style]);
 const [labels,setLabels]=useState(()=>decodeListTags(listTagLine.exec(note.content)?.[1]));
 const cancel=()=>{if(busy)return;onStylePreview?.(null);if(onCancel)onCancel();else{setSource(note.content);setLabels(decodeListTags(listTagLine.exec(note.content)?.[1]));const current=settingsLine.exec(note.content);setHeroes(current?.[2]==='1');setRatings(current?.[3]==='1');setError('');reset(n=>n+1);onDone?.();}};
 return <ListDialog key={generation} inline={inline} busy={busy} error={error} initialItems={[]} initial={initial} onStylePreview={onStylePreview} onCancel={cancel} renderItemOptions={(item,index,update)=><ItemOptions key={item.id} text={item.text.trim()||`Item ${index+1}`} metadata={item.metadata??''} update={update} heroes={heroes} ratings={ratings} busy={busy} upload={async file=>{setBusy(true);setError('');try{return await uploadImage(file);}catch(e){setError(e instanceof Error?e.message:String(e));return null;}finally{setBusy(false);}}}/>} extra={<><ListTagEditor label="List tags" values={labels} disabled={busy} readOnly={false} onChange={setLabels}/><fieldset className="page-layout-settings list-context-options" aria-label="Item display"><label><span>Item hero images</span><input type="checkbox" role="switch" checked={heroes} onChange={e=>setHeroes(e.target.checked)}/></label><label><span>Item ratings</span><input type="checkbox" role="switch" checked={ratings} onChange={e=>setRatings(e.target.checked)}/></label></fieldset></>} onDraft={async(title,kind,items)=>{
  if(busy)return;
  if(source!==note.content){setError('The list changed while editing. Cancel and reopen to load the latest items.');return;}
  setBusy(true);setError('');
  try{
   const originalHeading=list&&/^(#{1,6})\s/.exec(source.slice(list.start,list.end))?.[1];
   const counts:number[]=[];
   const replacement=(title.trim()?`${originalHeading||'##'} ${title.trim()}\n\n`:'')+items.filter(item=>item.text.trim()).map(item=>{counts.length=item.depth+1;const index=counts[item.depth]??0;counts[item.depth]=index+1;const prefix=item.checked?'- [x]':marker(kind,index,item.depth);return `${'  '.repeat(item.depth)}${prefix} ${item.text.trim()}${item.metadata??''}`;}).join('\n');
   const body=list?replaceDocumentStructure(source,list,replacement):source.trimEnd()+'\n\n'+replacement+'\n';
   const settings=`<!-- spire:list-options ${kind==='checkboxes'?'checklist':'plain'} ${Number(heroes)} ${Number(ratings)} ${kind==='checkboxes'?stored?.[4]??'bullets':markers[kind]} -->`;
   const next=settingsLine.test(body)?body.replace(settingsLine,settings):body.trimEnd()+'\n\n'+settings+'\n';
   const updated=JSON.stringify(labels)===JSON.stringify(decodeListTags(listTagLine.exec(source)?.[1]))?next:setListLabels(next,labels);
   await onSave(updated);onStylePreview?.(null);setSource(updated);if(onCancel)onCancel();else{reset(n=>n+1);onDone?.();}
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }}/>;
}


export const metadataPieces=(value:string)=>value.match(/ <!-- spire:list-(?:hero|rating|labels) [^<>]+ -->/g)??[];
export const itemLabels=(pieces:string[])=>decodeListTags(pieces.find(s=>s.startsWith(' <!-- spire:list-labels '))?.slice(' <!-- spire:list-labels '.length,-4));
function ItemOptions({text,metadata,update,heroes,ratings,busy,upload}:{text:string;metadata:string;update:(change:(metadata:string)=>string)=>void;heroes:boolean;ratings:boolean;busy:boolean;upload:(file:File)=>Promise<string|null>}){
 const [framing,setFraming]=useState(false);
 const pieces=metadataPieces(metadata),hero=pieces.map(s=>heroTag.exec(s)).find(Boolean),rating=pieces.map(s=>ratingTag.exec(s)?.[1]).find(Boolean);
 const x=Math.min(100,Number(hero?.[2]??50)),y=Math.min(100,Number(hero?.[3]??50));
 const setTag=(kind:string,value:string)=>update(current=>metadataPieces(current).filter(s=>!s.startsWith(` <!-- spire:list-${kind} `)).join('')+(value?` <!-- spire:list-${kind} ${value} -->`:''));
 return <details className="list-source-item-options"><summary>Item details</summary>
  {heroes&&hero&&<img className="list-item-hero" alt="" src={attachmentUrl(hero[1])} style={{objectPosition:`${x}% ${y}%`}}/>}
  <ListTagEditor label={`Tags for ${text}`} values={itemLabels(pieces)} disabled={busy} readOnly={false} onChange={values=>setTag('labels',values.length?encodeListTags(values):'')}/>
  <fieldset className="list-item-options" disabled={busy} aria-label={`Image and rating for ${text}`}>
   {ratings&&<label>Rating <select aria-label={`Rating for ${text}`} value={rating??'none'} onChange={e=>setTag('rating',e.target.value==='none'?'':e.target.value)}><option value="none">Not rated</option>{Array.from({length:10},(_,index)=>(index+1)/2).map(value=><option key={value} value={value}>{value} / 5</option>)}</select></label>}
   {heroes&&<><label className="list-image-upload">{hero?'Replace hero image':'Add hero image'}<input type="file" aria-label={`Hero image for ${text}`} accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const path=await upload(file);if(path){setTag('hero',path);setFraming(true);}}}/></label>{hero&&<><button type="button" aria-expanded={framing} onClick={()=>setFraming(!framing)}>Reposition hero image</button><button type="button" onClick={()=>{setFraming(false);setTag('hero','');}}>Remove hero image</button></>}</>}
  </fieldset>
  {heroes&&hero&&framing&&<fieldset className="list-hero-framing" disabled={busy}><legend>Hero image position</legend>
   <label>Horizontal position<input type="range" min="0" max="100" value={x} onChange={e=>setTag('hero',`${hero[1]} ${e.target.value} ${y}`)}/></label>
   <label>Vertical position<input type="range" min="0" max="100" value={y} onChange={e=>setTag('hero',`${hero[1]} ${x} ${e.target.value}`)}/></label>
  </fieldset>}
 </details>;
}
