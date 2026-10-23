import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import './persistent-selection.css';

type Props=React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type Snapshot={start:number;end:number;value:string};

/** Keeps a textarea selection visible while mobile action controls own interaction focus. */
export const PersistentTextarea=forwardRef<HTMLTextAreaElement,Props>(function PersistentTextarea(props,forwardedRef){
 const field=useRef<HTMLTextAreaElement>(null);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [persistent,setPersistent]=useState(false);
 const [scroll,setScroll]=useState({left:0,top:0});
 useImperativeHandle(forwardedRef,()=>field.current!,[]);
 const capture=()=>{const el=field.current;if(!el)return;setSnapshot({start:el.selectionStart,end:el.selectionEnd,value:el.value});};
 useEffect(()=>{
  const leave=(event:PointerEvent)=>{const el=field.current;if(!el||el.contains(event.target as Node))return;capture();setPersistent(true);};
  const selection=()=>{const el=field.current;if(el&&persistent)setSnapshot({start:el.selectionStart,end:el.selectionEnd,value:el.value});};
  document.addEventListener('pointerdown',leave,true);document.addEventListener('selectionchange',selection);
  return()=>{document.removeEventListener('pointerdown',leave,true);document.removeEventListener('selectionchange',selection);};
 },[persistent]);
 const value=String(props.value??'');
 const valid=persistent&&snapshot?.value===value&&snapshot.start<=value.length&&snapshot.end<=value.length;
 const start=valid?snapshot!.start:0,end=valid?snapshot!.end:0;
 const before=value.slice(0,start),selected=value.slice(start,end),after=value.slice(end);
 return <div className={'persistent-textarea '+(valid?'show-persistent-selection ':'')+(props.className??'')}>
  {valid&&<pre className="persistent-source-mirror" aria-hidden="true"><span style={{transform:`translate(${-scroll.left}px,${-scroll.top}px)`}}>{before}{start===end?<i className="persistent-source-caret"/>:<mark className="persistent-source-selection">{selected}</mark>}{after || '\n'}</span></pre>}
  <textarea {...props} className={undefined} ref={field} onFocus={event=>{setPersistent(false);props.onFocus?.(event);}} onPointerDown={event=>{setPersistent(false);props.onPointerDown?.(event);}} onSelect={event=>{capture();props.onSelect?.(event);}} onKeyUp={event=>{capture();props.onKeyUp?.(event);}} onScroll={event=>{setScroll({left:event.currentTarget.scrollLeft,top:event.currentTarget.scrollTop});props.onScroll?.(event);}}/>
 </div>;
});
