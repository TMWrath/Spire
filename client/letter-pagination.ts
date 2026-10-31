import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet,type EditorView} from '@tiptap/pm/view';
export const LETTER_RATIO=11/8.5;
export const PAGE_GAP=24;
export const PAGE_MARGIN=48;
export type PageLine={pos:number;top:number;bottom:number;explicit?:boolean};
export type FrontMatterEntry={id:string;text:string;level:number};
export function paginateFrontMatter<T extends FrontMatterEntry>(entries:T[],perPage=28):T[][]{
 if(!Number.isInteger(perPage)||perPage<1)throw new RangeError('perPage must be a positive integer');
 if(!entries.length)return [[]];
 return Array.from({length:Math.ceil(entries.length/perPage)},(_,page)=>entries.slice(page*perPage,(page+1)*perPage));
}
export function layoutLetterPages(lines:PageLine[],height:number,margin=PAGE_MARGIN,gap=PAGE_GAP,bottomMargin=margin){
 const lineGuard=32,step=height+gap,usable=height-margin-bottomMargin-lineGuard;let page=0,shift=0;
 const breaks:{pos:number;height:number;explicit:boolean}[]=[];
 for(const line of lines){
  let top=line.top+shift,bottom=line.bottom+shift;
  if(line.explicit){const target=(page+1)*step;const space=Math.max(0,target-top);breaks.push({pos:line.pos,height:space,explicit:true});shift+=space;page++;continue;}
  // One indivisible oversized object starts at a fresh page; it is never
  // repeatedly pushed forever. Media is constrained to the printable height.
  if(bottom>page*step+usable+.5&&top>page*step+.5){const target=(page+1)*step;const space=Math.max(0,target-top);breaks.push({pos:line.pos,height:space,explicit:false});shift+=space;page++;}
 }
 return {breaks,pages:page+1};
}
const key=new PluginKey<DecorationSet>('letterPagination');
export const LetterPagination=Extension.create({name:'letterPagination',addProseMirrorPlugins(){return [new Plugin<DecorationSet>({
 key,state:{init:()=>DecorationSet.empty,apply:(tr,old)=>tr.getMeta(key)??old.map(tr.mapping,tr.doc)},props:{decorations:state=>key.getState(state)},
 view(view){
  const root=view.dom as HTMLElement,host=root.parentElement!;
  const sheets=document.createElement('div');sheets.className='letter-page-sheets';host.prepend(sheets);
  type ZoomAnchor={page:number;x:number;y:number;clientX:number;clientY:number};
  let frame=0,destroyed=false,last='',width=0,editorZoom=1,pinchDistance=0,pinchZoom=1,pinchAnchor:Omit<ZoomAnchor,'clientX'|'clientY'>|null=null,pendingAnchor:ZoomAnchor|null=null;
  const clampZoom=(value:number)=>Math.max(1,Math.min(3,value));
  const anchorAt=(clientX:number,clientY:number):Omit<ZoomAnchor,'clientX'|'clientY'>=>{
   const pages=Array.from(sheets.children) as HTMLElement[],page=pages.findIndex(element=>{const rect=element.getBoundingClientRect();return clientY>=rect.top&&clientY<=rect.bottom;});
   const element=page>=0?pages[page]:host,rect=element.getBoundingClientRect();
   return {page,x:rect.width?(clientX-rect.left)/rect.width:.5,y:rect.height?(clientY-rect.top)/rect.height:0};
  };
  const announceZoom=()=>window.dispatchEvent(new CustomEvent('spire:editor-zoom-change',{detail:{zoom:editorZoom}}));
  const setZoom=(value:number,clientX:number,clientY:number,source=anchorAt(clientX,clientY))=>{const next=clampZoom(value);if(Math.abs(next-editorZoom)<.001)return;pendingAnchor={...source,clientX,clientY};editorZoom=next;host.dataset.editorZoom=editorZoom.toFixed(3);announceZoom();last='';schedule();};
  host.dataset.editorZoom='1.000';announceZoom();requestAnimationFrame(announceZoom);
  const schedule=()=>{if(!frame&&!destroyed)frame=requestAnimationFrame(measure);};
  const measure=()=>{
   frame=0;if(destroyed||!root.isConnected||view.composing)return;
   // Layout-only decorations are excluded from measurement, not the document.
   // This means shrinking text can pull it back without changing Markdown.
   host.classList.add('letter-measuring');
   const parentWidth=host.parentElement?.clientWidth??host.clientWidth,maxWidth=parseFloat(getComputedStyle(host).maxWidth);
   const viewportWidth=Math.min(parentWidth,Number.isFinite(maxWidth)?maxWidth:parentWidth);
   const renderedWidth=Math.min(964,viewportWidth-24),fitScale=Math.min(1,renderedWidth/964),scale=fitScale*editorZoom;
   const paperWidth=964,pageHeight=paperWidth*LETTER_RATIO;
   host.classList.remove('letter-mobile-preview');host.classList.add('letter-paginated');host.classList.toggle('letter-scaled',Math.abs(scale-1)>.001);
   host.style.minWidth=editorZoom>1?`${paperWidth*scale+24}px`:'';
   host.style.setProperty('--letter-scale',String(scale));host.style.setProperty('--letter-content-width',Math.min(860,paperWidth-PAGE_MARGIN*2)+'px');
   host.style.setProperty('--letter-height',pageHeight+'px');host.style.setProperty('--letter-width',paperWidth+'px');
   const chromeHeight=(kind:'header'|'footer',text:string|undefined)=>{if(!text)return 0;const sheet=document.createElement('div');sheet.className='letter-page-sheet letter-chrome-probe';sheet.style.height=pageHeight+'px';const region=document.createElement(kind);region.className=`letter-running-${kind}`;region.textContent=text;sheet.append(region);sheets.append(sheet);const height=Math.ceil(region.getBoundingClientRect().height/scale);sheet.remove();return height;};
   const topMargin=Math.max(PAGE_MARGIN,20+chromeHeight('header',root.dataset.runningHeader)+12),bottomMargin=Math.max(PAGE_MARGIN,18+chromeHeight('footer',root.dataset.runningFooter)+12);
   host.style.setProperty('--letter-top-margin',topMargin+'px');host.style.setProperty('--letter-bottom-margin',bottomMargin+'px');
   const origin=host.getBoundingClientRect().top+(12+topMargin)*scale;const lines:PageLine[]=[];
   const add=(pos:number,top:number,bottom:number,explicit=false)=>{lines.push({pos,top:(top-origin)/scale,bottom:(bottom-origin)/scale,explicit});};
   view.state.doc.descendants((node,pos)=>{
    if(node.type.name==='preservedBlock'){
     const dom=view.nodeDOM(pos) as HTMLElement|null;if(dom){const rect=dom.getBoundingClientRect();add(pos,rect.top,rect.bottom,dom.hasAttribute('data-letter-break'));}return false;
    }
    if(node.isText)return false;
    if(node.isTextblock&&!node.content.size){const dom=view.nodeDOM(pos) as HTMLElement|null;if(dom){const r=dom.getBoundingClientRect();add(pos+1,r.top,r.bottom);}}
    return true;
   });
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let textNode:Node|null;
   while((textNode=walker.nextNode())){
    const text=textNode;if(!text.textContent?.length||text.parentElement?.closest('.preserved-document-block,.letter-overflow-spacer'))continue;
    const range=document.createRange();range.selectNodeContents(text);
    for(const rect of Array.from(range.getClientRects())){if(!rect.height)continue;let low=0,high=text.textContent.length-1;
     while(low<high){const mid=(low+high)>>1;range.setStart(text,mid);range.setEnd(text,mid+1);if(range.getBoundingClientRect().top<rect.top-1)low=mid+1;else high=mid;}
     add(view.posAtDOM(text,low),rect.top,rect.bottom);
    }
   }
   lines.sort((a,b)=>a.top-b.top||a.pos-b.pos);
   const grouped:PageLine[]=[];
   for(const line of lines){const prior=grouped.at(-1);if(prior&&!line.explicit&&!prior.explicit&&Math.abs(prior.top-line.top)<1){prior.bottom=Math.max(prior.bottom,line.bottom);prior.pos=Math.min(prior.pos,line.pos);}else grouped.push({...line});}
   const result=layoutLetterPages(grouped,pageHeight,topMargin,PAGE_GAP,bottomMargin);host.classList.remove('letter-measuring');
   const signature=JSON.stringify([renderedWidth,editorZoom,result,topMargin,bottomMargin,root.dataset.runningHeader,root.dataset.runningFooter,root.dataset.runningHeaderEnabled,root.dataset.runningFooterEnabled,root.dataset.runningChromeEditable]);
   if(signature===last)return;last=signature;
   const createRegion=(kind:'header'|'footer')=>{const region=document.createElement(kind);region.className=`letter-running-${kind}`;region.setAttribute('aria-label',`${kind==='header'?'Header':'Footer'} editor`);if(root.dataset.runningChromeEditable==='true'){region.contentEditable='plaintext-only';region.spellcheck=true;}region.addEventListener('input',()=>{const value=region.innerText.replace(/\r/g,'');root.dataset[kind==='header'?'runningHeader':'runningFooter']=value;for(const copy of Array.from(sheets.querySelectorAll<HTMLElement>(`.letter-running-${kind}`)))if(copy!==region)copy.innerText=value;root.dispatchEvent(new CustomEvent('spire:page-chrome-input',{detail:{kind,text:value}}));last='';schedule();});region.addEventListener('blur',()=>root.dispatchEvent(new Event('spire:page-chrome-change')));return region;};
   while(sheets.children.length>result.pages)sheets.lastElementChild?.remove();
   while(sheets.children.length<result.pages){const sheet=document.createElement('div');sheet.className='letter-page-sheet';sheets.append(sheet);}
   Array.from(sheets.children).forEach((element,i)=>{const sheet=element as HTMLElement;sheet.style.top=(12+i*(pageHeight+PAGE_GAP))+'px';sheet.style.height=pageHeight+'px';sheet.dataset.page=String(i+1);for(const [kind,text,enabled] of [['header',root.dataset.runningHeader,root.dataset.runningHeaderEnabled],['footer',root.dataset.runningFooter,root.dataset.runningFooterEnabled]] as const){let region=sheet.querySelector<HTMLElement>(`.letter-running-${kind}`);if(enabled!=='true'){region?.remove();continue;}if(!region){region=createRegion(kind);sheet.append(region);}region.setAttribute('aria-label',`${kind==='header'?'Header':'Footer'} editor, page ${i+1}`);if(region!==document.activeElement&&region.innerText!==(text??''))region.textContent=text??'';}});
   host.style.setProperty('--letter-document-height',((24+result.pages*pageHeight+(result.pages-1)*PAGE_GAP)*scale)+'px');
   if(pendingAnchor){
    const anchor=pendingAnchor;pendingAnchor=null;
    const element=(anchor.page>=0?sheets.children[anchor.page]:host) as HTMLElement|undefined;
    const scroller=host.closest('.canvas.editor') as HTMLElement|null;
    if(element&&scroller){const rect=element.getBoundingClientRect();scroller.scrollBy(rect.left+rect.width*anchor.x-anchor.clientX,rect.top+rect.height*anchor.y-anchor.clientY);}
   }
   const decorations=result.breaks.map(b=>b.explicit?Decoration.node(b.pos,b.pos+view.state.doc.nodeAt(b.pos)!.nodeSize,{style:`height:${b.height}px`,class:'letter-explicit-spacer'}):Decoration.widget(b.pos,()=>{const el=document.createElement('span');el.className='letter-overflow-spacer';el.contentEditable='false';el.setAttribute('aria-hidden','true');el.style.height=b.height+'px';return el;},{side:-1,key:`${b.pos}:${b.height}`,ignoreSelection:true}));
   view.dispatch(view.state.tr.setMeta(key,DecorationSet.create(view.state.doc,decorations)).setMeta('addToHistory',false));
  };
  const observer=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width??0;if(Math.abs(next-width)>.5){width=next;schedule();}});observer.observe(host);
  const editorScroller=host.closest('.canvas.editor') as HTMLElement|null,pageDocument=host.closest('.page-document') as HTMLElement|null;
  const syncEditorChrome=()=>pageDocument?.style.setProperty('--editor-scroll-x',`${editorScroller?.scrollLeft??0}px`);
  editorScroller?.addEventListener('scroll',syncEditorChrome,{passive:true});syncEditorChrome();
  const wheel=(event:WheelEvent)=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();event.stopPropagation();setZoom(editorZoom*Math.exp(-event.deltaY*.002),event.clientX,event.clientY);};
  const distance=(touches:TouchList)=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  const midpoint=(touches:TouchList)=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});
  const touchStart=(event:TouchEvent)=>{if(event.touches.length===2){pinchDistance=distance(event.touches);pinchZoom=editorZoom;const point=midpoint(event.touches);pinchAnchor=anchorAt(point.x,point.y);}};
  const touchMove=(event:TouchEvent)=>{if(event.touches.length!==2||!pinchDistance||!pinchAnchor)return;event.preventDefault();event.stopPropagation();const point=midpoint(event.touches);setZoom(pinchZoom*distance(event.touches)/pinchDistance,point.x,point.y,pinchAnchor);};
  const touchEnd=(event:TouchEvent)=>{if(event.touches.length<2){pinchDistance=0;pinchAnchor=null;}};
  const requestedZoom=(event:Event)=>{const detail=(event as CustomEvent<{zoom:number;clientX?:number;clientY?:number}>).detail,zoom=detail?.zoom;if(!Number.isFinite(zoom))return;const rect=host.getBoundingClientRect(),clientX=Number.isFinite(detail.clientX)?detail.clientX!:rect.left+rect.width/2,clientY=Number.isFinite(detail.clientY)?detail.clientY!:rect.top+Math.min(rect.height/2,innerHeight/2);setZoom(zoom,clientX,clientY);};
  window.addEventListener('spire:set-editor-zoom',requestedZoom);
  host.addEventListener('wheel',wheel,{passive:false});host.addEventListener('touchstart',touchStart,{passive:true});host.addEventListener('touchmove',touchMove,{passive:false});host.addEventListener('touchend',touchEnd);host.addEventListener('touchcancel',touchEnd);
  root.addEventListener('load',schedule,true);root.addEventListener('loadedmetadata',schedule,true);root.addEventListener('compositionend',schedule);root.addEventListener('spire:page-chrome-change',schedule);document.fonts?.ready.then(schedule);schedule();
  return {update:(next:EditorView,previous)=>{if(!next.state.doc.eq(previous.doc))schedule();},destroy:()=>{destroyed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('spire:set-editor-zoom',requestedZoom);window.dispatchEvent(new CustomEvent('spire:editor-zoom-change',{detail:{zoom:null}}));editorScroller?.removeEventListener('scroll',syncEditorChrome);pageDocument?.style.removeProperty('--editor-scroll-x');root.removeEventListener('load',schedule,true);root.removeEventListener('loadedmetadata',schedule,true);root.removeEventListener('compositionend',schedule);root.removeEventListener('spire:page-chrome-change',schedule);host.removeEventListener('wheel',wheel);host.removeEventListener('touchstart',touchStart);host.removeEventListener('touchmove',touchMove);host.removeEventListener('touchend',touchEnd);host.removeEventListener('touchcancel',touchEnd);delete host.dataset.editorZoom;host.style.minWidth='';host.style.removeProperty('--letter-scale');host.style.removeProperty('--letter-content-width');host.style.removeProperty('--letter-height');host.style.removeProperty('--letter-width');host.style.removeProperty('--letter-top-margin');host.style.removeProperty('--letter-bottom-margin');sheets.remove();host.classList.remove('letter-paginated','letter-scaled','letter-measuring','letter-mobile-preview');}};
 }
})];}});
