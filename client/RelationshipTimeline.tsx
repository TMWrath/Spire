import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronDown,ChevronLeft,ChevronRight,FileText,Maximize2,Minimize2} from 'lucide-react';
import type {Note} from '../shared/model';
import {buildTimeline,buildTimelineRows,type TimelineItem} from './mind-map-model';

const title=(note:Note)=>note.path.split('/').at(-1)!.replace(/\.md$/i,'');
const dateOf=(value:string)=>{const date=value?new Date(value):new Date();return Number.isNaN(date.valueOf())?new Date():date;};
const monthName=(date:Date)=>date.toLocaleDateString(undefined,{month:'short'}).toUpperCase();
const fileLabel=(item?:TimelineItem)=>item?`${dateOf(item.created).toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${title(item.note)}`:'—';

export function RelationshipTimeline({files,activeId,onOpen,compact=false}:{files:Note[];activeId?:string|null;onOpen:(file:Note)=>void;compact?:boolean}){
 const available=useMemo(()=>files.filter(note=>!note.deleted),[files]);
 const [anchorId,setAnchorId]=useState(activeId&&available.some(note=>note.id===activeId)?activeId:available[0]?.id??'');
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{if(activeId&&available.some(note=>note.id===activeId))setAnchorId(activeId);},[activeId,available]);
 const timeline=useMemo(()=>buildTimeline(available,anchorId),[available,anchorId]);
 if(!timeline)return <section className={'relationship-timeline'+(compact?' compact':'')} aria-label="Reliquary mind map"><div className="timeline-empty"><strong>Your timeline starts with your first file.</strong><span>Link files to see their relationships across time.</span></div></section>;
 const anchorDate=dateOf(timeline.current.created),year=anchorDate.getFullYear(),rows=buildTimelineRows(timeline.past,timeline.future);
 const recenter=(item?:TimelineItem)=>{if(item)setAnchorId(item.note.id);};
 const adjacent=(direction:-1|1)=>{const ordered=[...timeline.past,{note:timeline.current.note,created:timeline.current.created,direction:'mutual' as const},...timeline.future],index=ordered.findIndex(item=>item.note.id===timeline.current.id),next=ordered[index+direction];if(next)setAnchorId(next.note.id);};
 return <section className={'relationship-timeline mockup-timeline'+(compact?' compact':'')+(expanded?' expanded':'')} aria-label="Reliquary mind map" data-view="relationship-timeline" data-anchor={timeline.current.id}>
  <div className="mock-year-nav" aria-label="Timeline year"><button aria-label="Previous related file" onClick={()=>adjacent(-1)}><ChevronLeft/></button><span>{year-1}</span><i/><strong>{year}</strong><i/><span>{year+1}</span><button aria-label="Next related file" onClick={()=>adjacent(1)}><ChevronRight/></button><button className="mock-calendar" aria-label="Calendar"><CalendarDays/></button></div>
  <section className="mock-ruler-panel" aria-label="Creation date"><div className="mock-month">{monthName(anchorDate)}<ChevronDown/></div><div className="mock-ruler"><button aria-label="Previous point" onClick={()=>adjacent(-1)}><ChevronLeft/></button><div className="mock-ruler-line" aria-hidden="true"><span className="mock-date-marker"><b>{anchorDate.getDate()}</b><i/></span></div><button aria-label="Next point" onClick={()=>adjacent(1)}><ChevronRight/></button></div><time>{anchorDate.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false})}</time></section>
  <section className="mock-file-panel" aria-label="Related files">{rows.map((row,index)=><div className="mock-file-row" key={`${row.before?.note.id??'empty'}:${row.after?.note.id??'empty'}:${index}`}><FileText aria-hidden="true"/><button disabled={!row.before} onClick={()=>recenter(row.before)}>{fileLabel(row.before)}</button><span className="mock-link-box"/><span className="mock-link-box"/><button disabled={!row.after} onClick={()=>recenter(row.after)}>{fileLabel(row.after)}</button><ChevronRight aria-hidden="true"/></div>)}</section>
  <div className="mock-anchor-line" aria-hidden="true"><i/></div>
  <button className="mock-current-file" onClick={()=>onOpen(timeline.current.note)} aria-label={`Open ${title(timeline.current.note)}`}><FileText/><span><strong>{title(timeline.current.note)}.md</strong><small>{timeline.current.note.path.replace(/\//g,' / ')}</small></span></button>
  {compact&&<button className="mock-expand" aria-label={expanded?'Close fullscreen map':'Fullscreen mind map'} onClick={()=>setExpanded(value=>!value)}>{expanded?<Minimize2/>:<Maximize2/>}</button>}
  <label className="mock-file-picker">Select file<select aria-label="Select a file in the map" value={anchorId} onChange={event=>setAnchorId(event.target.value)}>{available.map(note=><option key={note.id} value={note.id}>{title(note)}</option>)}</select></label>
 </section>;
}
