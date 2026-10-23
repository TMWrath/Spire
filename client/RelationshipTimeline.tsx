import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronDown,ChevronLeft,ChevronRight,FileText,Maximize2,Minimize2} from 'lucide-react';
import type {Note} from '../shared/model';
import {buildTimeline,buildTimelineRows,buildWorkspaceChronology,type ChronologyItem,type TimelineItem} from './mind-map-model';

const title=(note:Note)=>note.path.split('/').at(-1)!.replace(/\.md$/i,'');
const dateOf=(value:string)=>{const date=value?new Date(value):new Date();return Number.isNaN(date.valueOf())?new Date():date;};
const monthName=(date:Date)=>date.toLocaleDateString(undefined,{month:'short'}).toUpperCase();
const fileLabel=(item?:TimelineItem)=>item?`${dateOf(item.created).toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${title(item.note)}`:'—';
const months=Array.from({length:12},(_,month)=>new Date(2024,month,1).toLocaleDateString(undefined,{month:'short'}).toUpperCase());
const localDateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function RelationshipTimeline({files,activeId,onOpen,compact=false}:{files:Note[];activeId?:string|null;onOpen:(file:Note)=>void;compact?:boolean}){
 const available=useMemo(()=>files.filter(note=>!note.deleted),[files]);
 const chronology=useMemo(()=>buildWorkspaceChronology(available),[available]);
 const [anchorId,setAnchorId]=useState(activeId&&available.some(note=>note.id===activeId)?activeId:available[0]?.id??'');
 const [expanded,setExpanded]=useState(false);
 const calendarInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(activeId&&available.some(note=>note.id===activeId))setAnchorId(activeId);},[activeId,available]);
 const timeline=useMemo(()=>buildTimeline(available,anchorId),[available,anchorId]);
 if(!timeline)return <section className={'relationship-timeline'+(compact?' compact':'')} aria-label="Reliquary mind map"><div className="timeline-empty"><strong>Your timeline starts with your first file.</strong><span>Link files to see their relationships across time.</span></div></section>;
 const anchorDate=dateOf(timeline.current.created),year=anchorDate.getFullYear(),rows=buildTimelineRows(timeline.past,timeline.future);
 const recenter=(item?:TimelineItem|ChronologyItem)=>{if(item)setAnchorId(item.note.id);};
 const closest=(items:ChronologyItem[],target=anchorDate)=>items.reduce<ChronologyItem|undefined>((best,item)=>!best||Math.abs(dateOf(item.created).valueOf()-target.valueOf())<Math.abs(dateOf(best.created).valueOf()-target.valueOf())?item:best,undefined);
 const adjacent=(direction:-1|1)=>{const index=chronology.findIndex(item=>item.note.id===timeline.current.id),next=chronology[index+direction];if(next)recenter(next);};
 const chooseYear=(nextYear:number)=>recenter(closest(chronology.filter(item=>dateOf(item.created).getFullYear()===nextYear),new Date(nextYear,anchorDate.getMonth(),anchorDate.getDate(),anchorDate.getHours(),anchorDate.getMinutes())));
 const chooseMonth=(month:number)=>recenter(closest(chronology.filter(item=>{const date=dateOf(item.created);return date.getFullYear()===year&&date.getMonth()===month;}),new Date(year,month,anchorDate.getDate(),anchorDate.getHours(),anchorDate.getMinutes())));
 const chooseDate=(value:string)=>{if(!value)return;const target=new Date(`${value}T${String(anchorDate.getHours()).padStart(2,'0')}:${String(anchorDate.getMinutes()).padStart(2,'0')}:00`),sameDay=chronology.filter(item=>localDateValue(dateOf(item.created))===value);recenter(closest(sameDay.length?sameDay:chronology,target));};
 return <section className={'relationship-timeline mockup-timeline'+(compact?' compact':'')+(expanded?' expanded':'')} aria-label="Reliquary mind map" data-view="relationship-timeline" data-anchor={timeline.current.id}>
  <div className="mock-year-nav" aria-label="Timeline year"><button aria-label="Previous year" onClick={()=>chooseYear(year-1)}><ChevronLeft/></button><button className="mock-year-option" onClick={()=>chooseYear(year-1)}>{year-1}</button><i/><button className="mock-year-option current" aria-current="date">{year}</button><i/><button className="mock-year-option" onClick={()=>chooseYear(year+1)}>{year+1}</button><button aria-label="Next year" onClick={()=>chooseYear(year+1)}><ChevronRight/></button><button className="mock-calendar" aria-label="Choose date" onClick={()=>calendarInput.current?.showPicker?.()}><CalendarDays/></button><input ref={calendarInput} className="mock-calendar-input" aria-label="Timeline date" type="date" value={localDateValue(anchorDate)} onChange={event=>chooseDate(event.target.value)}/></div>
  <section className="mock-ruler-panel" aria-label="Creation date"><label className="mock-month"><select aria-label="Timeline month" value={anchorDate.getMonth()} onChange={event=>chooseMonth(Number(event.target.value))}>{months.map((month,index)=><option key={month} value={index}>{month}</option>)}</select><ChevronDown/></label><div className="mock-ruler"><button aria-label="Previous file by creation date" onClick={()=>adjacent(-1)}><ChevronLeft/></button><div className="mock-ruler-line" aria-hidden="true"><span className="mock-date-marker"><b>{anchorDate.getDate()}</b><i/></span></div><button aria-label="Next file by creation date" onClick={()=>adjacent(1)}><ChevronRight/></button></div><time dateTime={timeline.current.created}>{anchorDate.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false})}</time></section>
  <section className="mock-file-panel" aria-label="Related files">{rows.map((row,index)=><div className="mock-file-row" key={`${row.before?.note.id??'empty'}:${row.after?.note.id??'empty'}:${index}`}><FileText aria-hidden="true"/><button disabled={!row.before} onClick={()=>recenter(row.before)}>{fileLabel(row.before)}</button><span className={'mock-link-box'+(row.before?' active':'')} aria-hidden="true"/><span className={'mock-link-box'+(row.after?' active':'')} aria-hidden="true"/><button disabled={!row.after} onClick={()=>recenter(row.after)}>{fileLabel(row.after)}</button><ChevronRight aria-hidden="true"/></div>)}</section>
  <div className="mock-anchor-line" aria-hidden="true"><i/></div>
  <button className="mock-current-file" onClick={()=>onOpen(timeline.current.note)} aria-label={`Open ${title(timeline.current.note)}`}><FileText/><span><strong>{title(timeline.current.note)}.md</strong><small>{timeline.current.note.path.replace(/\//g,' / ')}</small></span></button>
  {compact&&<button className="mock-expand" aria-label={expanded?'Close fullscreen map':'Fullscreen mind map'} onClick={()=>setExpanded(value=>!value)}>{expanded?<Minimize2/>:<Maximize2/>}</button>}
  <label className="mock-file-picker">Select file<select aria-label="Select a file in the map" value={anchorId} onChange={event=>setAnchorId(event.target.value)}>{available.map(note=><option key={note.id} value={note.id}>{title(note)}</option>)}</select></label>
 </section>;
}
