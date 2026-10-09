import React, {useEffect, useRef, useState} from 'react';
import {BookOpen, Globe, Image, Headphones, Video, FileText, MoreHorizontal, ChevronDown, Check} from 'lucide-react';
import type {SourceInput} from '../shared/sources';
const types = [
 {value:'book',label:'Book',description:'Books, editions and published works',icon:BookOpen},
 {value:'website',label:'Website',description:'Web pages and online articles',icon:Globe},
 {value:'image',label:'Image',description:'Photographs, artwork and illustrations',icon:Image},
 {value:'audio',label:'Audio',description:'Podcasts, music and recordings',icon:Headphones},
 {value:'video',label:'Video',description:'Films, clips and recorded talks',icon:Video},
 {value:'document',label:'Document',description:'Reports, papers and other documents',icon:FileText},
 {value:'other',label:'Other',description:'Any other reference material',icon:MoreHorizontal}
] as const;
export function SourceTypePicker({value,onChange}:{value:SourceInput['kind'];onChange:(value:SourceInput['kind'])=>void}) {
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
 const selected=types.find(t=>t.value===value)!; const Icon=selected.icon;
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>{if(open)root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();},[open]);
 return <div className="source-type-picker" ref={root} onKeyDown={e=>{
 if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}
 if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]);const current=buttons.indexOf(document.activeElement as HTMLButtonElement);const index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();}
 }}><span id="source-type-label">Source type</span><button ref={trigger} type="button" className="source-type-trigger" aria-label="Source type" aria-haspopup="listbox" aria-expanded={open} aria-controls="source-type-options" onClick={()=>setOpen(!open)}><Icon aria-hidden="true"/><span>{selected.label}</span><ChevronDown aria-hidden="true" className={open?'expanded':''}/></button>{open&&<div id="source-type-options" role="listbox" aria-labelledby="source-type-label" className="source-type-options">{types.map(t=>{const TypeIcon=t.icon;return <button type="button" role="option" aria-selected={t.value===value} key={t.value} onClick={()=>{onChange(t.value);setOpen(false);trigger.current?.focus();}}><TypeIcon aria-hidden="true"/><span>{t.label}<small>{t.description}</small></span>{t.value===value&&<Check aria-hidden="true"/>}</button>;})}</div>}</div>;
}
