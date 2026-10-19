import React,{useEffect,useState,type MutableRefObject} from 'react';
/** EvoKB's spacebar waveform: 28 rounded bars, 45 ms cadence, fast attack and silent decay. */
export function SpeechWaveform({level}:{level:MutableRefObject<number>}){
 const [bars,setBars]=useState(()=>Array<number>(28).fill(0));
 useEffect(()=>{let amplitude=0;const timer=setInterval(()=>{const input=Math.max(0,Math.min(1,level.current));amplitude=input>amplitude?input:amplitude*.55+input*.45;setBars(previous=>[...previous.slice(1),amplitude]);amplitude*=.82;level.current*=.82;},45);return()=>clearInterval(timer);},[level]);
 return <span className="speech-waveform" role="img" aria-label="Microphone audio waveform">{bars.map((value,index)=><span key={index} style={{height:Math.max(3,value*26)+'px'}}/>)}</span>;
}
