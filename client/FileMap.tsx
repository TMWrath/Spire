import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Minus,Plus,Maximize} from 'lucide-react';
import type {Note} from '../shared/model';
import {buildFileSlice} from './mind-map-model';
import {createDotMap,type DotMapController} from './dot-map/renderer.mjs';
import './file-map.css';
export function FileMap({note,files,onOpen}:{note:Note;files:Note[];onOpen:(file:Note)=>void}){
 const graph=useMemo(()=>buildFileSlice(files.map(file=>file.id===note.id?note:file),note.id),[files,note]);
 const key=JSON.stringify([note.id,graph.nodes.map(n=>[n.id,n.path]),graph.edges]);
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<DotMapController|null>(null),open=useRef(onOpen),graphRef=useRef(graph);
 open.current=onOpen;graphRef.current=graph;
 const [unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  if(!canvas.current||!graph.nodes.length)return;setUnavailable(false);
  try{const controller=createDotMap(canvas.current,{files:graph.nodes.map(n=>({id:n.id,path:n.path,name:n.path.split('/').at(-1)!.replace(/\.md$/i,'')})),edges:graph.edges,onSelect:()=>{},onOpen:id=>{const target=graphRef.current.nodes.find(n=>n.id===id);if(target&&target.id!==note.id)open.current(target);}});engine.current=controller;controller.select(note.id);return()=>{controller.destroy();engine.current=null;};}
  catch{setUnavailable(true);}
 },[key]);
 return <section className="file-map" aria-label="Current file mind map" data-current-file={note.id}><div className="file-map-heading"><h3>Mind map</h3><div><button aria-label="Zoom file map out" onClick={()=>engine.current?.zoom(.8)}><Minus size={15}/></button><button aria-label="Zoom file map in" onClick={()=>engine.current?.zoom(1.25)}><Plus size={15}/></button><button aria-label="Reset file map" onClick={()=>{engine.current?.reset();engine.current?.select(note.id);}}><Maximize size={15}/></button></div></div><div className="file-map-stage"><canvas ref={canvas} aria-label="Current file connections" tabIndex={0}/>{unavailable&&<p className="file-map-fallback" role="status">Map unavailable. Use Linked files below.</p>}</div><p className="muted">{graph.nodes.length?graph.nodes.length-1:0} connected files · current file selected</p>{graph.edges.length===0&&<p className="muted">No connections yet. Link a file to grow this map.</p>}<small>Referenced file → referencing file. Drag to orbit, pinch or scroll to zoom. Double-tap a connected file to open it, or use Linked files below.</small></section>;
}
