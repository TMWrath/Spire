import React,{useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Check,ListFilter} from 'lucide-react';
// Shared Spire dropdown: the Source type picker's visual and interaction contract.
export function ThemedSelect({children,value,defaultValue,onChange,disabled,...props}:React.SelectHTMLAttributes<HTMLSelectElement>){
 const [localValue,setLocalValue]=useState(String(defaultValue??''));
 const currentValue=String(value??localValue);
 const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const options=React.Children.toArray(children).filter(React.isValidElement).map(child=>{
  const p=(child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>).props;
  return {value:String(p.value??p.children??''),label:p.children,disabled:p.disabled};
 });
 const selected=options.find(o=>o.value===currentValue);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[open]);
 useEffect(()=>{if(open)(root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)')??root.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)'))?.focus();},[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const label=props['aria-label']??props.title??'Choose option';
 return <div className="source-type-picker themed-select" ref={root} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open){setOpen(true);return;}const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')??[]);const current=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
 }}><button id={props.id} ref={trigger} type="button" autoFocus={props.autoFocus} disabled={disabled} className="source-type-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><ListFilter aria-hidden="true"/><span>{selected?.label??'Choose option'}</span><ChevronDown aria-hidden="true" className={open?'expanded':''}/></button>{open&&<div id={id} role="listbox" aria-label={label} className="source-type-options">{options.map((o,index)=><button key={o.value+'-'+index} type="button" role="option" data-value={o.value} disabled={o.disabled} aria-selected={o.value===currentValue} onClick={()=>{setLocalValue(o.value);onChange?.({target:{value:o.value},currentTarget:{value:o.value}} as React.ChangeEvent<HTMLSelectElement>);setOpen(false);trigger.current?.focus();}}><ListFilter aria-hidden="true"/><span>{o.label}</span>{o.value===currentValue&&<Check aria-hidden="true"/>}</button>)}</div>}</div>;
}
