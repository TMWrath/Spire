import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Minus,Plus} from 'lucide-react';
import type {Note} from '../shared/model';
import {buildTimeline,type TimelineItem} from './mind-map-model';

const title=(note:Note)=>note.path.split('/').at(-1)!.replace(/\.md$/i,'');
const day=(value:string)=>value?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Creation date unavailable';

export function RelationshipTimeline({files,activeId,onOpen,compact=false}:{files:Note[];activeId?:string|null;onOpen:(file:Note)=>void;compact?:boolean}){
 const available=useMemo(()=>files.filter(note=>!note.deleted),[files]);
 const [anchorId,setAnchorId]=useState(activeId&&available.some(note=>note.id===activeId)?activeId:available[0]?.id??'');
 const [zoom,setZoom]=useState(1);
 const [topic,setTopic]=useState<string|null>(null);
 const [expanded,setExpanded]=useState(false);
 const stage=useRef<HTMLDivElement>(null),anchor=useRef<HTMLDivElement>(null),pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<number|null>(null);
 useEffect(()=>{if(activeId&&available.some(note=>note.id===activeId))setAnchorId(activeId);},[activeId,available]);
 const timeline=useMemo(()=>buildTimeline(available,anchorId),[available,anchorId]);
 useEffect(()=>{requestAnimationFrame(()=>anchor.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center',inline:'center'}));},[anchorId]);
 const clamp=(value:number)=>Math.min(1.65,Math.max(.68,value));
 const zoomBy=(factor:number)=>setZoom(value=>clamp(value*factor));
 const onPointerDown=(event:React.PointerEvent)=>{pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});event.currentTarget.setPointerCapture(event.pointerId);if(pointers.current.size===2){const points=[...pointers.current.values()];pinch.current=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);}};
 const onPointerMove=(event:React.PointerEvent)=>{if(!pointers.current.has(event.pointerId))return;pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.current.size===2&&pinch.current){const points=[...pointers.current.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);zoomBy(distance/pinch.current);pinch.current=distance;}};
 const onPointerEnd=(event:React.PointerEvent)=>{pointers.current.delete(event.pointerId);if(pointers.current.size<2)pinch.current=null;};
 if(!timeline)return <section className={'relationship-timeline'+(compact?' compact':'')} aria-label="Reliquary mind map"><div className="timeline-empty"><strong>Your timeline starts with your first file.</strong><span>Link files to see their relationships across time.</span></div></section>;
 const visible=(item:TimelineItem)=>!topic||item.note.content.includes(`#${topic}`)||item.note.content.includes(topic);
 const ordered=[...timeline.past,{note:timeline.current.note,created:timeline.current.created,direction:'mutual' as const},...timeline.future];
 return <section className={'relationship-timeline'+(compact?' compact':'')+(expanded?' expanded':'')} aria-label="Reliquary mind map" data-view="relationship-timeline" data-anchor={timeline.current.id}>
  <header className="timeline-header"><div><small>SPIRE / RELATIONSHIPS</small><strong>Timeline</strong><span>{timeline.past.length+timeline.future.length} linked files</span></div><div className="timeline-zoom" role="group" aria-label="Timeline zoom">{compact&&<button aria-label={expanded?'Close fullscreen map':'Fullscreen mind map'} onClick={()=>setExpanded(value=>!value)}>{expanded?'Close':'Expand'}</button>}<button aria-label="Zoom timeline out" onClick={()=>zoomBy(.84)}><Minus size={16}/></button><button aria-label="Reset timeline zoom" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="Zoom timeline in" onClick={()=>zoomBy(1.19)}><Plus size={16}/></button></div></header>
  <div className="timeline-topics" aria-label="Relationship topics"><label className="timeline-picker">Select file<select aria-label="Select a file in the map" value={anchorId} onChange={event=>setAnchorId(event.target.value)}>{available.map(note=><option key={note.id} value={note.id}>{title(note)}</option>)}</select></label><button className={!topic?'active':''} onClick={()=>setTopic(null)}>All</button>{timeline.topics.map(value=><button key={value} className={topic===value?'active':''} aria-pressed={topic===value} onClick={()=>setTopic(topic===value?null:value)}>#{value}</button>)}</div>
  <div ref={stage} className="timeline-stage" onWheel={event=>{if(event.ctrlKey){event.preventDefault();zoomBy(event.deltaY<0?1.08:.92);}}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
   <div className="timeline-track" style={{'--timeline-zoom':zoom} as React.CSSProperties}>
    {ordered.map((item,index)=>{const current=item.note.id===timeline.current.id,shown=current||visible(item);return <div key={item.note.id} ref={current?anchor:undefined} className={'timeline-entry'+(current?' current':'')+(shown?'':' filtered')} style={{'--timeline-lane':(index%5)-2} as React.CSSProperties}>
     <time>{day(item.created)}</time><span className="timeline-stem" aria-hidden="true"/>
     <button className="timeline-file" aria-current={current?'true':undefined} onClick={()=>setAnchorId(item.note.id)}><span>{title(item.note)}</span><small>{current?'Current anchor':item.direction==='mutual'?'Mutual link':item.direction==='incoming'?'Links here':'Linked from here'}</small></button>
     {current&&<button className="timeline-open" onClick={()=>onOpen(item.note)}>Open file<ArrowUpRight size={14}/></button>}
    </div>;})}
   </div>
  </div>
  <div className="timeline-linked-strip" aria-label="Linked files">{[...timeline.past,...timeline.future].map(item=><button key={item.note.id} onClick={()=>setAnchorId(item.note.id)} title={item.note.path}><span aria-hidden="true"/>{title(item.note)}</button>)}</div>
  <p className="timeline-help">Swipe sideways through time · Move up or down through dense links · Pinch to zoom</p>
 </section>;
}
