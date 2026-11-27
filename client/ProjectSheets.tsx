import {useLayoutEffect,useRef,useState,useEffect} from 'react';
import './project-sheets.css';

import type {TaskBoard} from '../shared/project-tasks';
function CardInfo({name,board}:{name:string;board?:TaskBoard}){
 const root=useRef<HTMLSpanElement>(null),[description,setDescription]=useState('');
 useEffect(()=>{const abort=new AbortController();const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();void fetch('/api/project-overview/'+encodeURIComponent(name),{signal:abort.signal}).then(async r=>{if(r.ok){const data=await r.json();if(!abort.signal.aborted)setDescription(data.description);}}).catch(()=>{});},{root:root.current?.closest('.project-sheets-rail'),rootMargin:'0px 100px'});observer.observe(root.current!);return ()=>{observer.disconnect();abort.abort();};},[name]);
 const tasks=board?.tasks??[],done=tasks.filter(t=>t.done).length;
 const next=tasks.filter(t=>!t.done&&t.dueDate).sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!))[0];
 return <span ref={root} className="project-sheet-info"><span className="project-sheet-title">{name}</span>{description&&<span className="project-sheet-description">{description}</span>}<small>{tasks.length?`${done} of ${tasks.length} tasks complete`:'No tasks yet'}</small>{next&&<small className="project-sheet-deadline">Due {new Date(next.dueDate+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {next.title}</small>}</span>;
}
export function ProjectSheets({projects,onOpen,boards}:{boards:Record<string,TaskBoard>;projects:string[];onOpen:(name:string)=>void}){
 const rail=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const bar=rail.current;if(!bar)return;
  const cards=Array.from(bar.children) as HTMLElement[];let frame=0;
  const paint=()=>{frame=0;const center=bar.getBoundingClientRect().left+bar.clientWidth/2;
   const scales=cards.map(card=>{const box=card.getBoundingClientRect();const t=Math.max(0,1-Math.abs(box.left+box.width/2-center)/Math.max(1,card.offsetWidth+16));return .82+.18*t*t*(3-2*t);});
   cards.forEach((card,i)=>card.style.setProperty('--sheet-scale',scales[i].toFixed(4)));};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint);};
  const observer=new ResizeObserver(schedule);observer.observe(bar);if(cards[0])observer.observe(cards[0]);bar.addEventListener('scroll',schedule,{passive:true});paint();
  return ()=>{observer.disconnect();bar.removeEventListener('scroll',schedule);cancelAnimationFrame(frame);};
 },[projects]);
 return <section className="project-sheets" aria-label="Projects carousel">
  {!projects.length?<p>No projects yet.</p>:<div className="project-sheets-rail" ref={rail}>
   {projects.map((name,index)=><button key={name} aria-label={name} className="project-sheet" type="button" onClick={()=>onOpen(name)} onKeyDown={event=>{
    const target={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:projects.length-1}[event.key];
    if(target===undefined)return;
    event.preventDefault();
    const next=rail.current?.children[Math.max(0,Math.min(target,projects.length-1))] as HTMLButtonElement|undefined;
    next?.focus({preventScroll:true});
    next?.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
   }}>
    <img alt="" loading="lazy" draggable={false} src={'/api/project-overview/'+encodeURIComponent(name)+'/background'} onLoad={event=>{event.currentTarget.dataset.loaded='true';}}/>
    <CardInfo name={name} board={boards[name]}/>
   </button>)}
  </div>}
 </section>;
}
