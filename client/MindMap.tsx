import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Minus,Maximize,Pause,Play,ArrowUpRight,X,Search} from 'lucide-react';
import type {Note} from '../shared/model';
import {buildGraph,demoFiles} from './mind-map-model';
import {createDotMap,type DotMapController} from './dot-map/renderer.mjs';
import './mind-map.css';
const title=(n:Note)=>n.path.split('/').at(-1)!.replace(/\.md$/i,'');
export function MindMap({files,demo,onOpen,compact=false,visible=true,graphOverride,relation='files'}:{files:Note[];demo:boolean;onOpen:(file:Note)=>void;compact?:boolean;visible?:boolean;graphOverride?:ReturnType<typeof buildGraph>;relation?:'files'|'tags'|'templates'|'sources'}){
 const graph=useMemo(()=>graphOverride??buildGraph(demo?demoFiles:files),[files,demo,graphOverride]);
 const [selected,setSelected]=useState<string|null>(null),[query,setQuery]=useState(''),[paused,setPaused]=useState(false),[unavailable,setUnavailable]=useState(false);
 const graphKey=JSON.stringify([graph.nodes.map(n=>[n.id,n.path]),graph.edges]);
 const graphRef=useRef(graph);graphRef.current=graph;
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<DotMapController|null>(null),open=useRef(onOpen);
 open.current=onOpen;
 useEffect(()=>{
  if(!canvas.current)return;setSelected(null);setUnavailable(false);
  let controller:DotMapController;
  try{controller=createDotMap(canvas.current,{files:graph.nodes.map(n=>({id:n.id,path:n.path,name:title(n)})),edges:graph.edges,onSelect:setSelected,onOpen:id=>{const file=graphRef.current.nodes.find(n=>n.id===id);if(file&&!demo)open.current(file);}});}
  catch{setUnavailable(true);return;}
  engine.current=controller;controller.search(query);controller.pause(paused||!visible);
  return()=>{controller.destroy();engine.current=null;};
  // Query and motion updates below preserve the approved camera between control changes.
 },[graphKey,demo]);
 useEffect(()=>engine.current?.search(query),[query]);
 useEffect(()=>engine.current?.pause(paused||!visible),[paused,visible]);
 const active=graph.nodes.find(n=>n.id===selected);
 return <><section className={'mind-map'+(compact?' compact':'')} data-map-mode={relation} data-file-count={graph.nodes.filter(n=>!n.id.startsWith('template:')&&!n.id.startsWith('source:')).length} data-connection-count={graph.edges.length} aria-label="Reliquary mind map">
  {!compact&&<div className="mind-heading"><div><small>SPIRE / RELIQUARY</small><h1>Mind map<span className="mind-live" aria-hidden="true"/></h1><p>{graph.nodes.filter(n=>!n.id.startsWith('template:')&&!n.id.startsWith('source:')).length} files{relation==='templates'?` · ${graph.nodes.filter(n=>n.id.startsWith('template:')).length} templates`:''} <span> / </span>{graph.edges.length} connections</p></div><span className="mind-status">{demo?'Demo data':relation==='sources'?'Source citations':relation==='tags'?'Shared tags':relation==='templates'?'Template usage':'Your files'}</span></div>}
  {!compact&&<div className="mind-tools"><label className="mind-search"><Search size={16}/><input aria-label="Find a file in the map" placeholder="Find a file…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button aria-label="Zoom out" onClick={()=>engine.current?.zoom(.8)}><Minus size={18}/></button><button aria-label="Zoom in" onClick={()=>engine.current?.zoom(1.25)}><Plus size={18}/></button><button aria-label="Fit map" title="Reset view" onClick={()=>engine.current?.reset()}><Maximize size={18}/></button><button aria-label={paused?'Resume animation':'Pause animation'} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={18}/>:<Pause size={18}/>}</button></div>}
  <div className="mind-stage"><canvas ref={canvas} className="mind-surface" aria-label="File connections" tabIndex={0} aria-describedby={compact?'sidebar-mind-controls':'mind-controls'}/>
   {!!graph.nodes.length&&<label className="mind-picker">Select file<select aria-label="Select a file in the map" value={selected??''} onChange={e=>engine.current?.select(e.target.value||null)}><option value="">No selection</option>{graph.nodes.map(n=><option className="mind-node" key={n.id} value={n.id}>{title(n)}</option>)}</select></label>}
   {!graph.nodes.length&&<div className="mind-empty"><span className="mind-empty-dot" aria-hidden="true"/><h2>Your connections start here.</h2><p>{relation==='sources'?'Cite sources to connect them to your files.':relation==='tags'?'Files sharing tags connect here.':relation==='templates'?'Insert a template to connect it to its files.':'Link files to bring your map to life.'}</p><small>Explore a sample in Settings → Mind map → Show demo data.</small></div>}
   {unavailable&&<div className="mind-empty" role="status"><h2>The map could not be drawn.</h2><p>Your files are unchanged. Refresh to try again.</p></div>}
   {active&&<div className="mind-detail"><div><small>{demo?'DEMO FILE':active.id.startsWith('source:')?'SELECTED SOURCE':active.id.startsWith('template:')?'SELECTED TEMPLATE':'SELECTED FILE'}</small><strong>{title(active)}</strong><span>{demo?'Demonstration only — no files are created.':active.path}</span><p>{relation==='files'?`${graph.edges.filter(e=>e.target===active.id).length} references · ${graph.edges.filter(e=>e.source===active.id).length} referencing files`:`${graph.edges.filter(e=>e.source===active.id||e.target===active.id).length} connections`}</p></div>{!demo&&<button onClick={()=>onOpen(active)}>{active.id.startsWith('source:')?'Open source':active.id.startsWith('template:')?'Open template':'Open file'}<ArrowUpRight size={16}/></button>}<button aria-label="Clear map selection" onClick={()=>engine.current?.select(null)}><X size={16}/></button></div>}
  </div>
  <p className="mind-sr" role="status" aria-live="polite">{active?`Selected ${title(active)}`:'No file selected'}</p>
  <div className={compact?'mind-sr':'mind-legend'} id={compact?'sidebar-mind-controls':'mind-controls'}><span className="mind-legend-line"/>{relation==='sources'?'Source → citing files':relation==='tags'?'Files sharing tags':relation==='templates'?'Template → files using it':'Referenced file → referencing file'}<span className="mind-hint mind-mouse-hint">Drag to orbit · Wheel to zoom · Middle/Shift-drag to move</span><span className="mind-hint mind-touch-hint">One finger to orbit · Pinch to zoom · Two fingers to move/twist</span><span className="mind-sr">Arrow keys orbit. Shift and arrows move. Plus and minus zoom. Home resets. Escape clears selection. Use Select file to choose a file with the keyboard.</span></div>
 </section>{compact&&<label className="mind-search sidebar-map-search"><Search size={16} aria-hidden="true"/><input aria-label="Find a file in the map" placeholder="Find a file…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}</>;
}
