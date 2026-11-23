import React,{useState} from 'react';
import {normalizeListTags} from './list-tags';

export function TagFilter({label,tags,value,onChange}:{label:string;tags:string[];value:string;onChange:(value:string)=>void}){
 if(!tags.length)return null;
 return <label>{label} <select value={value} onChange={e=>onChange(e.target.value)}><option value="">All</option>{tags.map(tag=><option key={tag} value={tag.toLowerCase()}>{tag}</option>)}</select></label>;
}

export function ListTagEditor({label,values,disabled,readOnly,onChange}:{label:string;values:string[];disabled:boolean;readOnly:boolean;onChange:(values:string[])=>void}){
 const [input,setInput]=useState('');
 return <div aria-label={label} role="group">
  {values.map((tag,i)=><span key={tag}>{tag}{!readOnly&&<button type="button" disabled={disabled} aria-label={`Remove ${tag}`} onClick={()=>onChange(values.filter((_,j)=>j!==i))}>×</button>}</span>)}
  {!readOnly&&<details><summary>{label}</summary><form onSubmit={e=>{e.preventDefault();const next=normalizeListTags([...values,input]);if(disabled||next.length===values.length)return;onChange(next);setInput('');}}><input aria-label={`New tag: ${label}`} maxLength={60} value={input} onChange={e=>setInput(e.target.value)} disabled={disabled}/><button disabled={disabled||!input.trim()}>Add tag</button></form></details>}
 </div>;
}
