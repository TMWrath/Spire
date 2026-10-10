import {useRef} from 'react';
import {ChevronLeft,ChevronRight,FileText} from 'lucide-react';
import type {Note} from '../shared/model';
import {readRecent,recentFiles} from './recent-files';
export function RecentFiles({owner,notes,onOpen}:{owner:string;notes:Note[];onOpen:(note:Note)=>void}){
 const rail=useRef<HTMLDivElement>(null);const files=recentFiles(readRecent(owner),notes);
 const scroll=(direction:number)=>rail.current?.scrollBy({left:direction*rail.current.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <section className="recent-files" aria-label="Recent files"><header><div><h2>Recent files</h2><p className="muted">Pick up where you left off.</p></div>{files.length>1&&<div className="recent-file-controls"><button aria-label="Previous recent files" onClick={()=>scroll(-1)}><ChevronLeft/></button><button aria-label="Next recent files" onClick={()=>scroll(1)}><ChevronRight/></button></div>}</header>{files.length?<div ref={rail} className="recent-file-carousel" tabIndex={0} aria-label="Recently opened files" onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();scroll(event.key==='ArrowRight'?1:-1);}}}>{files.map(note=><button key={note.id} className="recent-file-card" onClick={()=>onOpen(note)}><FileText size={22}/><strong>{note.path.split('/').pop()?.replace(/\.md$/i,'')}</strong><small>{note.path.split('/').slice(0,-1).join('/')}</small></button>)}</div>:<p className="muted">Files you open on this device will appear here.</p>}</section>;
}
