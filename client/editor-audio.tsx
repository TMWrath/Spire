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
  // An audio element is phrasing content, so keep its enhanced host inline-safe.
  // CSS promotes the default player to a block grid while simple mode remains inline.
  const host=document.createElement('span');host.className='media-audio-list editor-audio-player';original.replaceWith(host);
  const root=createRoot(host);
  let audio:HTMLAudioElement|null=null;
  const adjacent=(direction:number)=>{const scope=view.closest('.document-writing-surface')||view;const tracks=Array.from(scope.querySelectorAll('audio'));const current=tracks.indexOf(audio!);if(tracks.length)void tracks[(current+direction+tracks.length)%tracks.length].play().catch(()=>{});};
  const initialDisplay:AudioDisplay=original.getAttribute('data-spire-display')==='simple'?'simple':'default';
  root.render(<AudioTrack item={{key:`editor-audio-${index}`,kind:'audio',name,url,missing:false}} initialDisplay={initialDisplay} onDisplayChange={display=>onDisplayChange?.(index,display)} onReady={node=>{audio=node;}} previous={()=>adjacent(-1)} next={()=>adjacent(1)}/>);
  // Standalone raw blocks cannot participate in the following paragraph's inline
  // formatting context. Align their floated control to its actual first text run,
  // accounting for the paginated editor's transform scale instead of pixel nudges.
  let frame=0,disposed=false;
  const align=()=>{frame=0;if(disposed)return;
   const block=host.closest<HTMLElement>('.preserved-document-block');
   const button=host.querySelector<HTMLElement>('.media-audio-row-speaker .media-audio-speaker');
   if(!block)return;
   if(!button){block.style.removeProperty('margin-block-start');return;}
   const paragraph=block.nextElementSibling;
   if(!paragraph?.matches('p')){block.style.removeProperty('margin-block-start');return;}
   const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);let node:Node|null=null;
   while((node=walker.nextNode())&&!node.textContent?.trim()){}
   if(!node)return;
   const start=node.textContent!.search(/\S/),range=document.createRange();range.setStart(node,start);range.setEnd(node,start+1);
   const text=range.getBoundingClientRect(),control=button.getBoundingClientRect();
   const scale=control.height/button.offsetHeight;if(!scale||!text.height)return;
   const style=getComputedStyle(node.parentElement!),context=document.createElement('canvas').getContext('2d');
   let inkShift=0;
   if(context){context.font=style.font;const metrics=context.measureText(node.textContent!.trim().split(/\s/)[0]);if(Number.isFinite(metrics.fontBoundingBoxAscent))inkShift=(metrics.fontBoundingBoxAscent-metrics.fontBoundingBoxDescent-metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)/2;}
   const delta=(text.top+text.height/2-control.top-control.height/2)/scale+inkShift;
   if(Math.abs(delta)>.1){const current=parseFloat(getComputedStyle(block).marginBlockStart)||0;block.style.marginBlockStart=`${current+delta}px`;}
  };
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(align);};
  const observer=new ResizeObserver(schedule);observer.observe(view);
  const mutations=new MutationObserver(schedule);mutations.observe(view,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('spire:editor-zoom-change',schedule);window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
  cleanup.push(()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();window.removeEventListener('spire:editor-zoom-change',schedule);window.removeEventListener('resize',schedule);host.closest<HTMLElement>('.preserved-document-block')?.style.removeProperty('margin-block-start');audio?.pause();root.unmount();});
 });
 return ()=>cleanup.forEach(dispose=>dispose());
}
