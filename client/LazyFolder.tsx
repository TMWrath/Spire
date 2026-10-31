import React,{useEffect,useState} from 'react';

// A closed folder must not materialize its potentially large descendant tree.
export function LazyFolder({summary,children,defaultOpen=false,...props}:{summary:React.ReactNode;children:()=>React.ReactNode;defaultOpen?:boolean}&Omit<React.HTMLAttributes<HTMLDetailsElement>,'children'>){
 const [open,setOpen]=useState(defaultOpen),[error,setError]=useState('');
 const path=(props as Record<string,unknown>)['data-folder'];
 useEffect(()=>{if(!open||typeof path!=='string'||React.isValidElement(summary)&&(summary.props as any)['data-mounted-drag'])return;let active=true;const browse=(globalThis as any).spireListFolder;if(browse)void browse(path).then(()=>{if(active)setError('');}).catch((e:Error)=>{if(active)setError(e.message);});return()=>{active=false;};},[open,path]);
 useEffect(()=>{if(defaultOpen)setOpen(true);},[defaultOpen]);
 return <details {...props} open={open} onToggle={event=>{if(event.target===event.currentTarget)setOpen(event.currentTarget.open);}}>{summary}{open&&error?<p role="alert">{error}<button onClick={()=>{setOpen(false);}}>Close and retry</button></p>:null}{open?children():null}</details>;
}
