import React,{useEffect,useRef} from 'react';
import {FileText,Folder} from 'lucide-react';

/** Only the icon owns drag pickup. Names remain scrollable and independently renameable. */
export function ItemIcon({kind,path,onStart,onMove,onEnd}:{kind:'file'|'folder';path:string;onStart:(e:React.PointerEvent)=>void;onMove:(e:React.PointerEvent)=>void;onEnd:(e:React.PointerEvent)=>void}){
 return <span className={`item-drag-handle item-drag-handle-${kind}`} aria-label={`Drag ${kind} ${path}`} title="Hold and move to drag" onPointerDown={e=>{e.stopPropagation();onStart(e);}} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onContextMenu={e=>e.preventDefault()}>{kind==='file'?<FileText/>:<Folder/>}</span>;
}
export function ItemName({path,children,onRename}:{path:string;children:React.ReactNode;onRename:()=>void}){
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),start=useRef({x:0,y:0}),held=useRef(false);
 const cancel=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>cancel,[]);
 return <span className="item-name" data-item-name={path} title="Hold to rename · F2" onPointerDown={e=>{if(e.button!==0)return;cancel();held.current=false;start.current={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>{timer.current=null;held.current=true;onRename();},550);}} onPointerMove={e=>{if(Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>8)cancel();}} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onClick={e=>{if(held.current){e.preventDefault();e.stopPropagation();held.current=false;}}} onContextMenu={e=>{e.preventDefault();cancel();}}>{children}</span>;
}
