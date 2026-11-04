import React,{useRef,useState,useEffect} from 'react';
import {Music2,Volume2,VolumeX,SkipBack,SkipForward,Pause,Play,MoreVertical,ExternalLink} from 'lucide-react';
import type {FileMedia} from './file-media';
import './compact-audio.css';
const clock=(n:number)=>Number.isFinite(n)?`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`:'--:--';
export function AudioTrack({item,onReady,previous,next}:{item:FileMedia;onReady:(node:HTMLAudioElement|null)=>void;previous:()=>void;next:()=>void}){
 const ref=useRef<HTMLAudioElement>(null),hold=useRef<number|undefined>(undefined),held=useRef(false);
 const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false),[failed,setFailed]=useState(item.missing),[compact,setCompact]=useState(false),[displayMenu,setDisplayMenu]=useState(false);
 useEffect(()=>{onReady(ref.current);return()=>{if(hold.current!==undefined)clearTimeout(hold.current);onReady(null);};},[onReady]);
 const toggle=()=>{const a=ref.current;if(a)playing?a.pause():void a.play().catch(()=>setFailed(true));};
 const endHold=()=>{if(hold.current!==undefined){clearTimeout(hold.current);hold.current=undefined;}};
 const progress=duration>0?Math.min(100,position/duration*100):0;
 return <article className={`media-audio-row${compact?' media-audio-row-speaker':''}`}>
  <div className="media-audio-art"><Music2 aria-hidden="true"/></div>
  <div className="media-audio-title"><strong title={item.name}>{item.name}</strong><span className="media-audio-duration">{clock(duration)}</span></div>
  <audio ref={ref} src={item.url} preload="metadata" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onDurationChange={e=>setDuration(e.currentTarget.duration)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onVolumeChange={e=>setMuted(e.currentTarget.muted)} onError={()=>setFailed(true)}/>
  <input className="media-audio-seek" style={{'--audio-progress':`${progress}%`} as React.CSSProperties} type="range" aria-label={`Seek ${item.name}`} min={0} max={Number.isFinite(duration)?duration:0} step="0.1" value={position} disabled={!duration||failed} onChange={e=>{if(ref.current)ref.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}/>
  <small className="media-audio-time">{clock(position)} / {clock(duration)}</small>
  <div className="media-audio-controls">
   <button type="button" aria-label={`Previous audio before ${item.name}`} onClick={previous}><SkipBack/></button>
   <button className="media-play" type="button" disabled={failed} aria-label={`${playing?'Pause':'Play'} ${item.name}`} onClick={toggle}>{playing?<Pause/>:<Play/>}</button>
   <button type="button" aria-label={`Next audio after ${item.name}`} onClick={next}><SkipForward/></button>
   <button type="button" aria-label={`${muted?'Unmute':'Mute'} ${item.name}`} onClick={()=>{if(ref.current)ref.current.muted=!muted;}}>{muted?<VolumeX/>:<Volume2/>}</button>
   <details className="media-audio-menu"><summary aria-label={`More options for ${item.name}`}><MoreVertical/></summary><div><a href={item.url} target="_blank" rel="noopener noreferrer">Open original <ExternalLink/></a><button type="button" onClick={e=>{setCompact(true);(e.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open');}}>Show speaker button</button></div></details>
  </div>
  {compact&&<div className="media-audio-compact"><button type="button" className="media-audio-speaker" disabled={failed} aria-label={`${playing?'Pause':'Play'} ${item.name}`} aria-pressed={playing} aria-haspopup="menu" aria-expanded={displayMenu} title="Tap to play or pause. Hold for display options." onPointerDown={()=>{held.current=false;hold.current=window.setTimeout(()=>{held.current=true;setDisplayMenu(true);},500);}} onPointerUp={endHold} onPointerCancel={endHold} onPointerLeave={endHold} onContextMenu={e=>{e.preventDefault();held.current=true;setDisplayMenu(true);}} onClick={()=>{if(held.current){held.current=false;return;}toggle();}}><Volume2/></button>{displayMenu&&<div className="media-audio-display-menu" role="menu"><button type="button" role="menuitem" onClick={()=>{setDisplayMenu(false);setCompact(false);}}>Show full player</button></div>}</div>}
  {failed&&<small className="media-error" role="status">Audio unavailable. Check the source file or connection.</small>}
 </article>;
}
