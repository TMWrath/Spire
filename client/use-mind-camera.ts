import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {defaultCamera,orbitCamera,pinchCamera,zoomCamera,type Camera,type ScreenPoint} from './mind-camera';
type Pointer=ScreenPoint&{pan:boolean;hit?:string};
type Callbacks={onTap:(id:string)=>void;onDoubleTap:(id:string)=>void};
/** The approved lab camera, with batched React rendering and owned pointer lifecycle. */
export function useMindCamera(surface:RefObject<SVGSVGElement|null>,reduced:boolean,callbacks:Callbacks){
 const current=useRef(defaultCamera()),[camera,setCamera]=useState(defaultCamera);
 const options=useRef({reduced,callbacks});options.current={reduced,callbacks};
 const controls=useRef<{reset:()=>void;zoom:(factor:number)=>void}|null>(null);
 const reset=useCallback(()=>{controls.current?.reset();},[]),zoom=useCallback((factor:number)=>controls.current?.zoom(factor),[]);
 useEffect(()=>{const svg=surface.current;if(!svg)return;
  const pointers=new Map<number,Pointer>();let frame=0,lastFrame=0,lastMove=0,moved=false,gesture:{camera:Camera;start:Pointer[]}|null=null,velocity={x:0,y:0},lastTap:{id:string;time:number}|null=null;
  const snapshot=()=>({...current.current,q:[...current.current.q] as Camera['q']});
  const publish=(time:number)=>{frame=0;const dt=Math.min(40,Math.max(0,time-(lastFrame||time)));lastFrame=time;
   if(options.current.reduced)velocity={x:0,y:0};
   if(!pointers.size&&Math.hypot(velocity.x,velocity.y)>.03){current.current=orbitCamera(current.current,velocity.x*dt,velocity.y*dt);const decay=Math.exp(-dt/140);velocity.x*=decay;velocity.y*=decay;}
   setCamera(snapshot());if(!document.hidden&&Math.hypot(velocity.x,velocity.y)>.03)frame=requestAnimationFrame(publish);
  };
  const invalidate=()=>{if(!frame){lastFrame=performance.now();frame=requestAnimationFrame(publish);}};
  const relative=(e:MouseEvent|PointerEvent|WheelEvent):ScreenPoint=>{const b=svg.getBoundingClientRect();return {x:e.clientX-b.left-b.width/2,y:e.clientY-b.top-b.height/2};};
  const rebase=()=>{gesture={camera:snapshot(),start:[...pointers.values()].slice(0,2).map(p=>({...p}))};};
  const stop=()=>{const ids=[...pointers.keys()];pointers.clear();gesture=null;velocity={x:0,y:0};svg.classList.remove('dragging');for(const id of ids)if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);};
  const resetView=()=>{stop();lastTap=null;current.current=defaultCamera();invalidate();};
  controls.current={reset:resetView,zoom:factor=>{velocity={x:0,y:0};current.current=zoomCamera(current.current,factor,0,0);if(pointers.size)rebase();invalidate();}};
  const down=(e:PointerEvent)=>{if(pointers.size>=2)return;const target=e.target instanceof Element?e.target:null;pointers.set(e.pointerId,{...relative(e),pan:e.button===1||e.shiftKey,hit:target?.closest('.mind-node')?.getAttribute('data-file-id')??undefined});velocity={x:0,y:0};moved=pointers.size>1;svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');svg.focus({preventScroll:true});rebase();e.preventDefault();};
  const move=(e:PointerEvent)=>{const old=pointers.get(e.pointerId);if(!old||!gesture)return;const p=relative(e),dx=p.x-old.x,dy=p.y-old.y;pointers.set(e.pointerId,{...old,...p});if(Math.hypot(p.x-gesture.start[0].x,p.y-gesture.start[0].y)>5||pointers.size>1)moved=true;
   if(pointers.size===2){current.current=pinchCamera(gesture.camera,gesture.start,[...pointers.values()].slice(0,2));velocity={x:0,y:0};}
   else if(old.pan){current.current={...current.current,x:current.current.x+dx,y:current.current.y+dy};velocity={x:0,y:0};}
   else{current.current=orbitCamera(current.current,dx,dy);const now=performance.now(),delta=Math.max(8,now-lastMove);velocity={x:dx/delta,y:dy/delta};lastMove=now;}
   invalidate();
  };
  const end=(e:PointerEvent,cancel=false)=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(cancel||options.current.reduced||performance.now()-lastMove>90)velocity={x:0,y:0};
   if(!moved&&!cancel){const now=performance.now();if(p.hit){if(lastTap?.id===p.hit&&now-lastTap.time<320){options.current.callbacks.onDoubleTap(p.hit);lastTap=null;}else{options.current.callbacks.onTap(p.hit);lastTap={id:p.hit,time:now};}}else if(lastTap?.id===''&&now-lastTap.time<320){resetView();lastTap=null;}else{lastTap={id:'',time:now};}}
   else lastTap=null;
   if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(pointers.size){moved=true;velocity={x:0,y:0};rebase();}else{gesture=null;svg.classList.remove('dragging');}invalidate();
  };
  const up=(e:PointerEvent)=>end(e),cancel=(e:PointerEvent)=>end(e,true);
  const wheel=(e:WheelEvent)=>{e.preventDefault();velocity={x:0,y:0};const p=relative(e),unit=e.deltaMode===1?16:e.deltaMode===2?svg.clientHeight:1;current.current=zoomCamera(current.current,Math.exp(-Math.max(-400,Math.min(400,e.deltaY*unit))*.002),p.x,p.y);if(pointers.size)rebase();invalidate();};
  const context=(e:Event)=>e.preventDefault();
  const key=(e:KeyboardEvent)=>{if(e.target!==svg)return;const keys:Record<string,[number,number]>={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};if(keys[e.key]){e.preventDefault();velocity={x:0,y:0};current.current=orbitCamera(current.current,...keys[e.key]);invalidate();}else if(e.key==='Home'){e.preventDefault();resetView();}else if(['+','=','-'].includes(e.key)){e.preventDefault();controls.current?.zoom(e.key==='-'?.8:1.25);}};
  const blur=()=>{stop();invalidate();};const visibility=()=>{if(document.hidden){stop();if(frame)cancelAnimationFrame(frame);frame=0;}else invalidate();};
  svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',cancel);svg.addEventListener('lostpointercapture',cancel);svg.addEventListener('wheel',wheel,{passive:false});svg.addEventListener('contextmenu',context);svg.addEventListener('keydown',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerup',up);svg.removeEventListener('pointercancel',cancel);svg.removeEventListener('lostpointercapture',cancel);svg.removeEventListener('wheel',wheel);svg.removeEventListener('contextmenu',context);svg.removeEventListener('keydown',key);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);stop();if(frame)cancelAnimationFrame(frame);controls.current=null;};
 },[surface]);
 return {camera,reset,zoom};
}
