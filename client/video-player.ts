import './video-player.css';

const paths:Record<string,string>={play:'M8 5v14l11-7z',pause:'M8 5v14M16 5v14',prev:'M5 5v14M19 5 8 12l11 7z',next:'M19 5v14M5 5l11 7-11 7z',volume:'m11 5-6 4H2v6h3l6 4zM15 8q6 4 0 8M18 5q9 7 0 14',full:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="${['play','prev','next'].includes(name)?'currentColor':'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
const clock=(n:number)=>{n=Number.isFinite(n)?Math.floor(n):0;return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};

/** Enhance embedded videos without allowing controls to change the canvas layout. */
export function enhanceVideos(root:HTMLElement){
 const cleanups:Array<()=>void>=[];
 root.querySelectorAll('video').forEach(video=>{
  if(video.closest('.spire-video'))return;
  const nativeControls=video.controls;video.controls=false;video.playsInline=true;
  const shell=document.createElement('section');shell.className='spire-video';shell.setAttribute('aria-label','Video player');video.before(shell);
  const stage=document.createElement('div'),overlay=document.createElement('div'),timeline=document.createElement('div'),footer=document.createElement('footer'),options=document.createElement('div'),notice=document.createElement('div');
  stage.className='sv-stage';overlay.className='sv-overlay';timeline.className='sv-timeline';options.className='sv-options';options.hidden=true;notice.className='sv-notice';notice.setAttribute('role','status');notice.hidden=true;
  const events:Array<()=>void>=[];let hideTimer:ReturnType<typeof setTimeout>|undefined;
  const listen=(node:EventTarget,event:string,fn:(event:Event)=>void)=>{node.addEventListener(event,fn);events.push(()=>node.removeEventListener(event,fn));};
  const report=(message:string)=>{notice.textContent=message;notice.hidden=false;shell.classList.add('controls-visible');};
  const action=(fn:()=>Promise<unknown>)=>{void fn().catch(()=>report('This action is not available for this video on this device.'));};
  const button=(parent:HTMLElement,label:string,glyph:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(glyph);listen(b,'click',event=>{event.stopPropagation();fn();});parent.append(b);return b;};
  const scheduleHide=()=>{if(hideTimer)clearTimeout(hideTimer);if(!video.paused)hideTimer=setTimeout(()=>shell.classList.remove('controls-visible'),3000);};
  const showControls=()=>{shell.classList.add('controls-visible');scheduleHide();};
  const toggle=()=>{if(video.paused)action(()=>video.play());else video.pause();};
  stage.append(video);const center=button(stage,'Play video','play',toggle);center.className='sv-center';
  const elapsed=document.createElement('output'),total=document.createElement('output'),seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='0';seek.step='0.01';seek.value='0';seek.setAttribute('aria-label','Seek video');timeline.append(elapsed,seek,total);
  listen(seek,'input',()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value);showControls();});
  button(footer,'Skip back 10 seconds','prev',()=>{video.currentTime=Math.max(0,video.currentTime-10);showControls();});const play=button(footer,'Play video','play',toggle);play.className='sv-play';button(footer,'Skip forward 10 seconds','next',()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10);showControls();});
  const spacer=document.createElement('span');spacer.className='sv-spacer';footer.append(spacer);
  const mute=button(footer,'Mute video','volume',()=>{video.muted=!video.muted;showControls();});const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='0.01';volume.value=String(video.volume);volume.setAttribute('aria-label','Video volume');volume.className='sv-volume';listen(volume,'input',()=>{video.volume=Number(volume.value);video.muted=false;showControls();});footer.append(volume);
  button(footer,'Playback settings','settings',()=>{options.hidden=!options.hidden;showControls();});button(footer,'Fullscreen video','full',()=>action(()=>document.fullscreenElement?document.exitFullscreen():shell.requestFullscreen()));
  const label=document.createElement('label');label.textContent='Playback speed ';const speed=document.createElement('select');speed.setAttribute('aria-label','Playback speed');[0.25,0.5,0.75,1,1.25,1.5,2].forEach(n=>{const option=document.createElement('option');option.value=String(n);option.textContent=n+'×';option.selected=n===1;speed.append(option);});listen(speed,'change',()=>{video.playbackRate=Number(speed.value);showControls();});label.append(speed);options.append(label);
  overlay.append(timeline,footer,options,notice);stage.append(overlay);shell.append(stage);
  const update=()=>{const duration=Number.isFinite(video.duration)?video.duration:0;if(video.videoWidth&&video.videoHeight)shell.style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;seek.max=String(duration);seek.value=String(video.currentTime);elapsed.textContent=clock(video.currentTime);total.textContent=clock(duration);center.hidden=!video.paused&&!video.ended;play.innerHTML=icon(video.paused?'play':'pause');play.setAttribute('aria-label',video.paused?'Play video':'Pause video');mute.setAttribute('aria-label',video.muted?'Unmute video':'Mute video');mute.setAttribute('aria-pressed',String(video.muted));volume.value=String(video.muted?0:video.volume);if(video.paused)shell.classList.remove('controls-visible');else scheduleHide();};
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended','volumechange'].forEach(name=>listen(video,name,update));listen(video,'click',()=>{if(video.paused)toggle();else if(shell.classList.contains('controls-visible'))shell.classList.remove('controls-visible');else showControls();});listen(video,'error',()=>report('Video unavailable or unsupported. Your original file is unchanged.'));update();
  cleanups.push(()=>{if(hideTimer)clearTimeout(hideTimer);events.forEach(fn=>fn());video.controls=nativeControls;shell.replaceWith(video);});
 });
 return()=>cleanups.forEach(fn=>fn());
}
