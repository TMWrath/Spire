import type {PointerEvent,KeyboardEvent} from 'react';

export function PanelResize({side}:{side:'left'|'right'}){
 const change=(el:HTMLElement,width:number)=>{
  const workspace=el.closest('.workspace') as HTMLElement;
  const total=workspace.getBoundingClientRect().width;
  const normal=total*.2;
  const other=workspace.querySelector(side==='left'?'.context':'.sidebar')?.getBoundingClientRect().width??0;
  const bounded=Math.max(180,Math.min(width,Math.min(total*.4,total-other-360)));
  workspace.style.setProperty(`--${side}-panel-width`,Math.abs(bounded-normal)<=16?'20%':`${bounded}px`);
 };
 const start=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const el=event.currentTarget,parent=el.parentElement!;
  const startX=event.clientX,width=parent.getBoundingClientRect().width;
  el.setPointerCapture(event.pointerId);
  const move=(e:globalThis.PointerEvent)=>change(el,width+(e.clientX-startX)*(side==='left'?1:-1));
  const stop=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',stop);el.removeEventListener('pointercancel',stop);document.body.classList.remove('resizing-panels');};
  document.body.classList.add('resizing-panels');
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
 };
 const key=(e:KeyboardEvent<HTMLDivElement>)=>{
  if(e.key==='Home'){e.preventDefault();(e.currentTarget.closest('.workspace') as HTMLElement).style.removeProperty(`--${side}-panel-width`);}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change(e.currentTarget,e.currentTarget.parentElement!.getBoundingClientRect().width+(e.key==='ArrowRight'?24:-24)*(side==='left'?1:-1));}
 };
 return <div className={`panel-resize panel-resize-${side}`} role="separator" aria-label={side==='left'?'Resize navigation panel':'Resize Context panel'} aria-orientation="vertical" tabIndex={0} onPointerDown={start} onKeyDown={key} onDoubleClick={e=>(e.currentTarget.closest('.workspace') as HTMLElement).style.removeProperty(`--${side}-panel-width`)} />;
}
