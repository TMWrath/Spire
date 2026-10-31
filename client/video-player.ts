import './video-player.css';
const paths:Record<string,string>={play:'M8 5v14l11-7z',pause:'M8 5v14M16 5v14',back:'M19 12H5m7-7-7 7 7 7',prev:'M5 5v14M19 5 8 12l11 7z',next:'M19 5v14M5 5l11 7-11 7z',volume:'m11 5-6 4H2v6h3l6 4zM15 8q6 4 0 8M18 5q9 7 0 14',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',pip:'M3 4h18v16H3zM12 11h7v7h-7z',cast:'M3 15v-11h18v14H10M2 19h1M2 15q5 0 5 5M2 11q9 0 9 9',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',more:'M12 4h.01M12 12h.01M12 20h.01'};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="${['play','prev','next'].includes(name)?'currentColor':'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
const clock=(n:number)=>{n=Number.isFinite(n)?Math.floor(n):0;return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
/** Enhance the existing media node, retaining its source and native playback state. */
export function enhanceVideos(root:HTMLElement){
 const cleanups:Array<()=>void>=[];
 root.querySelectorAll('video').forEach(video=>{
  if(video.closest('.spire-video'))return;
  const controls=video.controls;video.controls=false;video.playsInline=true;
  const shell=document.createElement('section');shell.className='spire-video';shell.setAttribute('aria-label','Video player');
  video.before(shell);
  const header=document.createElement('header'),stage=document.createElement('div'),timeline=document.createElement('div'),footer=document.createElement('footer'),notice=document.createElement('div');stage.className='sv-stage';timeline.className='sv-timeline';notice.className='sv-notice';notice.setAttribute('role','status');notice.hidden=true;
  const events:Array<()=>void>=[];
  const listen=(node:EventTarget,event:string,fn:()=>void)=>{node.addEventListener(event,fn);events.push(()=>node.removeEventListener(event,fn));};
  const report=(message:string)=>{notice.textContent=message;notice.hidden=false;};
  const action=(fn:()=>Promise<unknown>)=>{void fn().catch(()=>report('This action is not available for this video on this device.'));};
  const button=(parent:HTMLElement,label:string,glyph:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(glyph);listen(b,'click',fn);parent.append(b);return b;};
  button(header,'Back to file','back',()=>{video.pause();shell.scrollIntoView({block:'center',behavior:'smooth'});});
  const title=document.createElement('span');let name=video.getAttribute('title')||video.getAttribute('aria-label');try{const url=new URL(video.currentSrc||video.src,location.href);name ||= (url.searchParams.get('path')||url.pathname).split('/').pop()||'Video';if(name)name=decodeURIComponent(name);}catch{}title.textContent=name||'Video';title.className='sv-title';header.append(title);
  const remote=(video as HTMLVideoElement&{remote?:{prompt:()=>Promise<void>}}).remote;
  const cast=button(header,'Cast video','cast',()=>{if(remote)action(()=>remote.prompt());});cast.disabled=!remote;
  const pip=button(header,'Picture in picture','pip',()=>action(()=>document.pictureInPictureElement?document.exitPictureInPicture():video.requestPictureInPicture()));pip.disabled=!document.pictureInPictureEnabled;
  button(header,'Video options','more',()=>{options.hidden=!options.hidden;});
  const toggle=()=>{if(video.paused)action(()=>video.play());else video.pause();};
  stage.append(video);const center=button(stage,'Play video','play',toggle);center.className='sv-center';
  const elapsed=document.createElement('output'),total=document.createElement('output'),seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='0';seek.step='0.01';seek.value='0';seek.setAttribute('aria-label','Seek video');timeline.append(elapsed,seek,total);
  listen(seek,'input',()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value);});
  button(footer,'Skip back 10 seconds','prev',()=>{video.currentTime=Math.max(0,video.currentTime-10);});const play=button(footer,'Play video','play',toggle);play.className='sv-play';button(footer,'Skip forward 10 seconds','next',()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10);});
  const spacer=document.createElement('span');spacer.className='sv-spacer';footer.append(spacer);
  const mute=button(footer,'Mute video','volume',()=>{video.muted=!video.muted;});const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='0.01';volume.value=String(video.volume);volume.setAttribute('aria-label','Video volume');volume.className='sv-volume';listen(volume,'input',()=>{video.volume=Number(volume.value);video.muted=false;});footer.append(volume);
  const divider=document.createElement('span');divider.className='sv-divider';footer.append(divider);
  button(footer,'Playback settings','settings',()=>{options.hidden=!options.hidden;});
  button(footer,'Fullscreen video','full',()=>action(()=>document.fullscreenElement?document.exitFullscreen():shell.requestFullscreen()));
  const options=document.createElement('div');options.className='sv-options';options.hidden=true;const label=document.createElement('label');label.textContent='Playback speed ';const speed=document.createElement('select');speed.setAttribute('aria-label','Playback speed');[0.25,0.5,0.75,1,1.25,1.5,2].forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=n+'×';o.selected=n===1;speed.append(o);});listen(speed,'change',()=>{video.playbackRate=Number(speed.value);});label.append(speed);options.append(label);
  shell.append(header,stage,timeline,footer,options,notice);
  const update=()=>{const d=Number.isFinite(video.duration)?video.duration:0;seek.max=String(d);seek.value=String(video.currentTime);elapsed.textContent=clock(video.currentTime);total.textContent=clock(d);center.hidden=!video.paused&&!video.ended;play.innerHTML=icon(video.paused?'play':'pause');play.setAttribute('aria-label',video.paused?'Play video':'Pause video');mute.setAttribute('aria-label',video.muted?'Unmute video':'Mute video');mute.setAttribute('aria-pressed',String(video.muted));volume.value=String(video.muted?0:video.volume);};
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended','volumechange'].forEach(e=>listen(video,e,update));listen(video,'click',toggle);listen(video,'error',()=>report('Video unavailable or unsupported. Your original file is unchanged.'));update();
  cleanups.push(()=>{events.forEach(fn=>fn());video.controls=controls;shell.replaceWith(video);});
 });return()=>cleanups.forEach(fn=>fn());
}
