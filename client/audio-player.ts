import './audio-player.css';
const paths:Record<string,string>={play:'M8 5v14l11-7z',pause:'M8 5v14M16 5v14',prev:'M5 5v14M19 5 8 12l11 7z',next:'M19 5v14M5 5l11 7-11 7z',volume:'m11 5-6 4H2v6h3l6 4zM15 8q6 4 0 8M18 5q9 7 0 14',muted:'m11 5-6 4H2v6h3l6 4zM16 9l6 6m0-6-6 6',more:'M12 4h.01M12 12h.01M12 20h.01',music:'M9 18V5l12-3v13M9 8l12-3M9 18c0 4-7 4-7 0s7-4 7 0M21 15c0 4-7 4-7 0s7-4 7 0'};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="${name==='play'?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
export const mediaClock=(n:number)=>{n=Number.isFinite(n)?Math.max(0,Math.floor(n)):0;return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
/** One renderer for file audio, the Context gallery and Nos. No document mutation. */
export function enhanceAudio(root:HTMLElement){
 const cleanups:Array<()=>void>=[];
 root.querySelectorAll('audio').forEach(audio=>{
  if(audio.closest('.media-audio-row'))return;
  const nativeControls=audio.controls;audio.controls=false;
  const shell=document.createElement('article');shell.className='media-audio-row';audio.before(shell);
  let name=audio.title||audio.getAttribute('aria-label')||'';
  if(!name){try{const u=new URL(audio.currentSrc||audio.src||audio.querySelector('source')?.src||'',location.href);name=decodeURIComponent((u.searchParams.get('path')||u.pathname).split('/').pop()||'Audio');}catch{name='Audio';}}
  const events:Array<()=>void>=[];const listen=(node:EventTarget,type:string,fn:()=>void)=>{node.addEventListener(type,fn);events.push(()=>node.removeEventListener(type,fn));};
  const art=document.createElement('div');art.className='media-audio-art';art.innerHTML=icon('music');
  const artwork=audio.dataset.artwork;if(artwork){const image=document.createElement('img');image.src=artwork;image.alt='';image.loading='lazy';listen(image,'error',()=>image.remove());art.append(image);}
  const main=document.createElement('div');main.className='media-audio-main';const title=document.createElement('strong');title.textContent=name;title.title=name;
  const duration=document.createElement('span');duration.className='media-audio-duration';const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='0';seek.step='.1';seek.value='0';seek.setAttribute('aria-label','Seek '+name);
  const time=document.createElement('small');time.className='media-audio-time';main.append(title,duration,seek,time);
  const controls=document.createElement('div');controls.className='media-audio-controls';
  const notice=document.createElement('small');notice.className='media-error';notice.setAttribute('role','status');notice.hidden=true;
  const report=()=>{notice.textContent='Audio unavailable or unsupported. Check the source or connection.';notice.hidden=false;};
  const start=(target:HTMLAudioElement)=>{void target.play().catch(report);};
  const button=(label:string,glyph:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label+' '+name);b.title=label;b.innerHTML=icon(glyph);listen(b,'click',fn);controls.append(b);return b;};
  const adjacent=(delta:number)=>{const scope=audio.closest('.file-media,.preview,.nos-library,.ProseMirror')||root;const playlist=Array.from(scope.querySelectorAll('audio'));const index=playlist.indexOf(audio);const target=playlist[(index+delta+playlist.length)%playlist.length];if(target){audio.pause();target.currentTime=0;start(target);}};
  button('Previous audio before','prev',()=>adjacent(-1));const play=button('Play','play',()=>audio.paused?start(audio):audio.pause());play.className='media-play';button('Next audio after','next',()=>adjacent(1));
  const mute=button('Mute','volume',()=>{audio.muted=!audio.muted;});
  const options=document.createElement('div');options.className='media-audio-options';options.hidden=true;
  const more=button('Audio options','more',()=>{options.hidden=!options.hidden;more.setAttribute('aria-expanded',String(!options.hidden));});more.setAttribute('aria-expanded','false');
  const volumeLabel=document.createElement('label');volumeLabel.textContent='Volume';const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='.01';volume.value=String(audio.volume);volume.setAttribute('aria-label','Volume '+name);listen(volume,'input',()=>{audio.volume=Number(volume.value);audio.muted=false;});volumeLabel.append(volume);
  const speedLabel=document.createElement('label');speedLabel.textContent='Playback speed';const speed=document.createElement('select');speed.setAttribute('aria-label','Playback speed '+name);[.5,.75,1,1.25,1.5,2].forEach(n=>{const o=document.createElement('option');o.value=String(n);o.textContent=n+'×';o.selected=n===audio.playbackRate;speed.append(o);});listen(speed,'change',()=>audio.playbackRate=Number(speed.value));speedLabel.append(speed);
  const restart=document.createElement('button');restart.type='button';restart.textContent='Restart track';listen(restart,'click',()=>{audio.currentTime=0;});options.append(volumeLabel,speedLabel,restart);
  const update=()=>{const d=Number.isFinite(audio.duration)?audio.duration:0;seek.max=String(d);seek.value=String(audio.currentTime);seek.disabled=!d;duration.textContent=d?mediaClock(d):'--:--';time.textContent=mediaClock(audio.currentTime)+' / '+(d?mediaClock(d):'--:--');seek.style.setProperty('--progress',`${d?audio.currentTime/d*100:0}%`);play.innerHTML=icon(audio.paused?'play':'pause');play.setAttribute('aria-label',(audio.paused?'Play ':'Pause ')+name);mute.innerHTML=icon(audio.muted?'muted':'volume');mute.setAttribute('aria-label',(audio.muted?'Unmute ':'Mute ')+name);mute.setAttribute('aria-pressed',String(audio.muted));volume.value=String(audio.muted?0:audio.volume);};
  listen(seek,'input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value);update();});
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended','volumechange'].forEach(event=>listen(audio,event,update));listen(audio,'error',report);listen(audio,'playing',()=>{notice.hidden=true;});
  listen(audio,'play',()=>{document.querySelectorAll('audio').forEach(other=>{if(other!==audio&&!other.paused)other.pause();});});
  listen(document,'pointerdown',()=>{if(!shell.contains(document.activeElement))options.hidden=true;});
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!options.hidden){options.hidden=true;more.setAttribute('aria-expanded','false');more.focus();}};shell.addEventListener('keydown',escape);events.push(()=>shell.removeEventListener('keydown',escape));
  shell.append(art,main,controls,options,notice,audio);update();
  cleanups.push(()=>{events.forEach(fn=>fn());audio.pause();audio.controls=nativeControls;shell.replaceWith(audio);});
 });return()=>cleanups.forEach(fn=>fn());
}
