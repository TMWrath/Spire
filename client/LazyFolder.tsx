import React,{useState} from 'react';

// A closed folder must not materialize its potentially large descendant tree.
export function LazyFolder({summary,children,defaultOpen=false,...props}:{summary:React.ReactNode;children:()=>React.ReactNode;defaultOpen?:boolean}&Omit<React.HTMLAttributes<HTMLDetailsElement>,'children'>){
 const [open,setOpen]=useState(defaultOpen);
 return <details {...props} open={open} onToggle={event=>{if(event.target===event.currentTarget)setOpen(event.currentTarget.open);}}>{summary}{open?children():null}</details>;
}
