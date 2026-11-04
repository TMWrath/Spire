import React from 'react';
import {createRoot} from 'react-dom/client';
import {AudioTrack} from './AudioTrack';

export type AudioDisplay='default'|'simple';
export function setAudioDisplay(source:string,index:number,display:AudioDisplay){
 let seen=-1;
 return source.replace(/<audio\b[^>]*>/gi,tag=>{seen++;if(seen!==index)return tag;const clean=tag.replace(/\s+data-spire-display\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,'');return display==='simple'?clean.replace(/>$/, ' data-spire-display="simple">'):clean;});
}

/** Enhance rendered nodes while reporting document-backed display changes. */
export function mountEditorAudio(view:HTMLElement,onDisplayChange?:(index:number,display:AudioDisplay)=>void){
 const cleanup:Array<()=>void>=[];
 view.querySelectorAll('audio').forEach((original,index)=>{
  const url=original.getAttribute('src')||original.querySelector('source')?.getAttribute('src');
  if(!url)return;
  let name=original.getAttribute('title')||'Audio';
  try{const parsed=new URL(url,location.href);name=original.getAttribute('title')||(parsed.searchParams.get('path')||decodeURIComponent(parsed.pathname)).split('/').pop()||'Audio';}catch{/* Keep the safe display fallback. */}
  const host=document.createElement('div');host.className='media-audio-list editor-audio-player';original.replaceWith(host);
  const root=createRoot(host);
  let audio:HTMLAudioElement|null=null;
  const adjacent=(direction:number)=>{const scope=view.closest('.document-writing-surface')||view;const tracks=Array.from(scope.querySelectorAll('audio'));const current=tracks.indexOf(audio!);if(tracks.length)void tracks[(current+direction+tracks.length)%tracks.length].play().catch(()=>{});};
  const initialDisplay:AudioDisplay=original.getAttribute('data-spire-display')==='simple'?'simple':'default';
  root.render(<AudioTrack item={{key:`editor-audio-${index}`,kind:'audio',name,url,missing:false}} initialDisplay={initialDisplay} onDisplayChange={display=>onDisplayChange?.(index,display)} onReady={node=>{audio=node;}} previous={()=>adjacent(-1)} next={()=>adjacent(1)}/>);
  cleanup.push(()=>{audio?.pause();root.unmount();});
 });
 return ()=>cleanup.forEach(dispose=>dispose());
}
