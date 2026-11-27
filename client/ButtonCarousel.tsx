import React,{useLayoutEffect,useRef} from 'react';

// Only the center group owns handlers, refs and popup state. Side tracks mirror its controls.
export function ButtonCarousel({children,...props}:React.HTMLAttributes<HTMLDivElement>){
 const outer=useRef<HTMLDivElement>(null),source=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const bar=outer.current!,group=source.current!;let span=0,frame=0;
 const mirrors=()=>Array.from(bar.querySelectorAll<HTMLElement>(':scope > [data-row-copy]'));
 const sync=()=>{frame=0;const gap=parseFloat(getComputedStyle(bar).columnGap)||0;const width=group.getBoundingClientRect().width+gap;const style=getComputedStyle(bar);const viewport=bar.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0);const next=viewport>0&&width-gap>viewport+1?width:0;const offset=span?bar.scrollLeft-3*span:0;
 for(const copy of mirrors())copy.remove();if(next){for(const side of [-1,1])for(let i=0;i<3;i++){const copy=group.cloneNode(true) as HTMLElement;copy.dataset.rowCopy='';copy.setAttribute('aria-hidden','true');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.querySelectorAll<HTMLElement>('button,input,select,a,[tabindex]').forEach(el=>el.tabIndex=-1);if(side<0)group.before(copy);else bar.append(copy);}}span=next;bar.scrollLeft=span?3*span+offset:0;};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};const ro=new ResizeObserver(schedule);ro.observe(bar);ro.observe(group);const mo=new MutationObserver(schedule);mo.observe(group,{attributes:true,subtree:true,childList:true,characterData:true});sync();
 const settle=()=>{const x=bar.scrollLeft;if(span&&(x<2*span||x>4*span))bar.scrollLeft=3*span+((x%span)+span)%span;};
 const target=(e:Event)=>{const b=e.target instanceof Element?e.target.closest('button'):null;const copy=b?.closest('[data-row-copy]');if(!copy||!b)return;return group.querySelectorAll('button')[Array.from(copy.querySelectorAll('button')).indexOf(b)];};
 const down=(e:Event)=>{if(target(e)&&e.type==='mousedown')e.preventDefault();};const click=(e:Event)=>{const real=target(e);if(real){e.stopPropagation();e.preventDefault();if(!real.disabled)real.click();}};bar.addEventListener('mousedown',down);bar.addEventListener('click',click,true);bar.addEventListener('scrollend',settle);return()=>{cancelAnimationFrame(frame);ro.disconnect();mo.disconnect();bar.removeEventListener('mousedown',down);bar.removeEventListener('click',click,true);bar.removeEventListener('scrollend',settle);mirrors().forEach(el=>el.remove());};},[]);
 return <div {...props} ref={outer} className={`${props.className} continuous-actions`}><div ref={source} className="action-cycle">{children}</div></div>;
}
