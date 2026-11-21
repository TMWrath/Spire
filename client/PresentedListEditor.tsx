import React,{useMemo,useState} from 'react';
import type {Note} from '../shared/model';
import {ListDialog,marker,type ListBuilderStyle} from './ListDialog';
import {documentLists,replaceDocumentStructure} from './document-structures';

export const settingsLine=/^<!-- spire:list-options (plain|checklist) ([01]) ([01])(?: (bullets|numbers|letters|dashes))? -->\r?$/m;
const markers={bullets:'bullets',numbered:'numbers',lettered:'letters',dash:'dashes',checkboxes:'bullets'} as const;
const metadata=/((?: <!-- spire:list-(?:hero|rating) [^<>]+ -->)+)$/;
export function PresentedListEditor({note,inline,onCancel,onSave}:{note:Note;inline?:boolean;onCancel?:()=>void;onSave:(content:string)=>Promise<void>}){
 const [source,setSource]=useState(note.content),[generation,reset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const {stored,list}=useMemo(()=>({stored:settingsLine.exec(source),list:documentLists(source)[0]}),[source]);
 const [heroes,setHeroes]=useState(stored?.[2]==='1'),[ratings,setRatings]=useState(stored?.[3]==='1');
 const style:ListBuilderStyle=stored?.[1]==='checklist'?'checkboxes':stored?.[1]==='plain'?stored[4]==='numbers'?'numbered':stored[4]==='letters'?'lettered':stored[4]==='dashes'?'dash':'bullets':list?.style??'checkboxes';
 const initial=useMemo(()=>{
  const rows=list?source.slice(list.start,list.end).split('\n').slice(-list.items.length):[];
  return {title:list?.title??'',style,items:list?.items.map((item,i)=>({...item,text:item.text.trimEnd().replace(metadata,''),metadata:metadata.exec(item.text.trimEnd())?.[0],checked:/^\s*-\s+\[[xX]\]/.test(rows[i])}))??[]};
 },[list,source,style]);
 const cancel=()=>{if(busy)return;if(onCancel)onCancel();else{setSource(note.content);const current=settingsLine.exec(note.content);setHeroes(current?.[2]==='1');setRatings(current?.[3]==='1');setError('');reset(n=>n+1);}};
 return <ListDialog key={generation} inline={inline} busy={busy} error={error} initialItems={[]} initial={initial} onCancel={cancel} extra={<fieldset className="page-layout-settings list-context-options" aria-label="Item display"><label><span>Item hero images</span><input type="checkbox" role="switch" checked={heroes} onChange={e=>setHeroes(e.target.checked)}/></label><label><span>Item ratings</span><input type="checkbox" role="switch" checked={ratings} onChange={e=>setRatings(e.target.checked)}/></label></fieldset>} onDraft={async(title,kind,items)=>{
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
   await onSave(next);setSource(next);if(onCancel)onCancel();else reset(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }}/>;
}
