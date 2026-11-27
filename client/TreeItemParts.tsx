import React,{useEffect,useRef,useContext,useState} from 'react';
import {FileText,Folder,Trash2} from 'lucide-react';

export function CollectionFileRow({path,name,icon,onOpen,onRename,onDelete}:{path:string;name:string;icon:React.ReactNode;onOpen:()=>void;onRename:()=>void;onDelete:()=>void}){
 return <div className="tree-file-row"><div className="note-link" role="button" tabIndex={0} aria-label={name} title={path} onClick={onOpen} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onOpen();}}}><span className="item-drag-handle item-drag-handle-file" aria-hidden="true">{icon}</span><ItemName direct path={path} onRename={onRename}>{name}</ItemName></div><button type="button" className="tree-trash" aria-label={'Delete file '+path} title={'Move '+name+' to Trash'} onClick={onDelete}><Trash2 size={14}/></button></div>;
}

/** Only the icon owns drag pickup. Names remain scrollable and independently renameable. */
export function ItemIcon({kind,path,onStart,onMove,onEnd}:{kind:'file'|'folder';path:string;onStart:(e:React.PointerEvent)=>void;onMove:(e:React.PointerEvent)=>void;onEnd:(e:React.PointerEvent)=>void}){
 return <span className={`item-drag-handle item-drag-handle-${kind}`} aria-label={`Drag ${kind} ${path}`} title="Hold and move to drag" onPointerDown={e=>{e.stopPropagation();onStart(e);}} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onContextMenu={e=>e.preventDefault()}>{kind==='file'?<FileText/>:<Folder/>}</span>;
}
export const InlineRename=React.createContext<{path:string;name:string;setName:(name:string)=>void;save:()=>Promise<void>;cancel:()=>void}|null>(null);
function RenameInput({edit}:{edit:NonNullable<React.ContextType<typeof InlineRename>>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const saving=useRef(false);
 const submit=async()=>{if(saving.current)return;saving.current=true;setBusy(true);setError('');try{await edit.save();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{saving.current=false;setBusy(false);}};
 return <span className="inline-rename" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><input aria-label="New name" enterKeyHint="done" autoFocus onFocus={e=>e.currentTarget.select()} value={edit.name} readOnly={busy} onChange={e=>{setError('');edit.setName(e.target.value);}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Enter'){e.preventDefault();void submit();}if(e.key==='Escape'&&!busy){e.preventDefault();edit.cancel();}}}/><button type="button" aria-label="Save name" disabled={busy} onClick={()=>void submit()}>✓</button><button type="button" aria-label="Cancel rename" disabled={busy} onClick={edit.cancel}>×</button>{error&&<small role="alert">{error}</small>}</span>;
}
export function ItemName({path,children,onRename,direct=false}:{path:string;children:React.ReactNode;onRename:()=>void;direct?:boolean}){
 const inline=useContext(InlineRename);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),start=useRef({x:0,y:0}),held=useRef(false);
 const cancel=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>cancel,[]);
 if(inline?.path===path)return <RenameInput edit={inline}/>;
 return <span className="item-name" data-item-name={path} role={direct?'button':undefined} tabIndex={direct?0:undefined} aria-label={direct?`Rename ${path}`:undefined} title={direct?'Rename':'Hold to rename · F2'} onKeyDown={e=>{if(direct&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();onRename();}}} onPointerDown={e=>{if(e.button!==0)return;cancel();held.current=false;start.current={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>{timer.current=null;held.current=true;onRename();},550);}} onPointerMove={e=>{if(Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>8)cancel();}} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onClick={e=>{if(direct||held.current){e.preventDefault();e.stopPropagation();if(!held.current)onRename();held.current=false;}}} onContextMenu={e=>{e.preventDefault();cancel();}}>{children}</span>;
}
