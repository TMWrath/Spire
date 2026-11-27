import React,{useCallback,useRef} from 'react';
import {AudioTrack} from './AudioTrack';

/** Single-source playback uses the same controls as editor and gallery audio. */
export function StandaloneAudioTrack({url,name,initialDisplay='default',onDisplayChange,menuActions,onAudioReady,titleControl}:{url:string;name:string;titleControl?:React.ReactNode;initialDisplay?:'default'|'simple';onAudioReady?:(node:HTMLAudioElement|null)=>void;menuActions?:{label:string;run:()=>void}[];onDisplayChange?:(display:'default'|'simple')=>void}){
 const audio=useRef<HTMLAudioElement|null>(null);
 const ready=useCallback((node:HTMLAudioElement|null)=>{audio.current=node;onAudioReady?.(node);},[onAudioReady]);
 const replay=()=>{if(audio.current){audio.current.currentTime=0;void audio.current.play().catch(()=>{});}};
 return <div className="media-audio-list standalone-audio-player"><AudioTrack key={url} item={{key:url,kind:'audio',name,url,missing:false}} onReady={ready} previous={replay} next={replay} initialDisplay={initialDisplay} onDisplayChange={onDisplayChange} menuActions={menuActions} titleControl={titleControl}/></div>;
}
