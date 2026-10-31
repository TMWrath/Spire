import {Marked,type Token} from 'marked';
const imageIcon=(name:string)=>{const paths:Record<string,string>={image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',left:'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',center:'<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',right:'<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',flow:'<rect x="3" y="4" width="7" height="8" rx="1"/><path d="M14 5h7M14 10h7M3 16h18M3 21h18"/>',chevron:'<path d="m6 9 6 6 6-6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'};const span=document.createElement('span');span.className='image-option-icon';span.setAttribute('aria-hidden','true');span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;return span;};
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Locate author-owned images only: code and transcluded documents are not editable images. */
export function imageSources(source:string){
 const parser=new Marked({extensions:[{name:'wikiImage',level:'inline',start:src=>src.indexOf('![['),tokenizer(src){const m=/^!\[\[([^\]\n]+)\]\]/.exec(src);if(m)return {type:'wikiImage',raw:m[0],text:m[1]};}}]});
 const found:{start:number;end:number;html:string}[]=[];
 const visit=(tokens:Token[],from:number)=>{let cursor=from;for(const token of tokens){const at=source.indexOf(token.raw,cursor);if(at<0)continue;cursor=at+token.raw.length;
  if(token.type==='image'){const t=token as {href:string;text:string;title?:string};found.push({start:at,end:cursor,html:`<img src="${escape(t.href)}" alt="${escape(t.text)}"${t.title?` title="${escape(t.title)}"`:''}>`});}
  else if(token.type==='wikiImage'){const [src,alt]=String((token as unknown as {text:string}).text).split('|');if(/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#].*)?$/i.test(src))found.push({start:at,end:cursor,html:`<img src="${escape(src)}" alt="${escape(alt??src)}">`});}
  else if(token.type==='html'){for(const m of token.raw.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi))found.push({start:at+m.index!,end:at+m.index!+m[0].length,html:m[0]});}
  else if(token.type!=='code'&&token.type!=='codespan'){
   const nested=token as Token&{tokens?:Token[];items?:Token[]};if(nested.tokens)visit(nested.tokens,at);else if(nested.items)visit(nested.items,at);
  }
 }};visit(parser.lexer(source),0);return found;
}
export function resizeImageSource(source:string,index:number,percent:number){
 if(!Number.isFinite(percent)||percent<1||percent>100)return source;
 const image=imageSources(source)[index];if(!image)return source;
 let html=image.html;let keep='';
 html=html.replace(/\s+style\s*=\s*(["'])(.*?)\1/i,(_all,_quote,style:string)=>{keep=style.split(';').map(s=>s.trim()).filter(s=>s&&!/^(?:width|height|max-width)\s*:/i.test(s)).join(';');return '';});
 html=html.replace(/\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\s*\/?>$/,` style="${keep?keep+';':''}width:${percent}%;height:auto">`);
 return source.slice(0,image.start)+html+source.slice(image.end);
}
export type ImageLayout='inline'|'block-left'|'block-center'|'block-right'|'wrap-left'|'wrap-right';
export function layoutImageSource(source:string,index:number,layout:ImageLayout){
 const styles:Record<ImageLayout,string>={inline:'display:inline;float:none;vertical-align:middle;margin:0 4px', 'block-left':'display:block;float:none;margin:12px auto 12px 0', 'block-center':'display:block;float:none;margin:12px auto', 'block-right':'display:block;float:none;margin:12px 0 12px auto', 'wrap-left':'display:block;float:left;margin:0 16px 12px 0', 'wrap-right':'display:block;float:right;margin:0 0 12px 16px'};
 if(!styles[layout])return source;const image=imageSources(source)[index];if(!image)return source;
 let keep='';let html=image.html.replace(/\s+style\s*=\s*(["'])(.*?)\1/i,(_all,_q,style:string)=>{keep=style.split(';').map(s=>s.trim()).filter(s=>s&&!/^(?:display|float|clear|vertical-align|margin(?:-(?:left|right|top|bottom))?)\s*:/i.test(s)).join(';');return '';});
 html=html.replace(/\s+data-image-layout\s*=\s*(["']).*?\1/gi,'').replace(/\s*\/?>$/,` data-image-layout="${layout}" style="${keep?keep+';':''}${styles[layout]}">`);
 return source.slice(0,image.start)+html+source.slice(image.end);
}
export function deleteImageSource(source:string,index:number){
 const image=imageSources(source)[index];return image?source.slice(0,image.start)+source.slice(image.end):source;
}
/** Image-triggered controls never become document content. */
export function mountImageSizing(root:HTMLElement,source:string,editable:()=>boolean,update:(source:string)=>void,session:{open:number|null;left?:string;top?:string}={open:null}){
 const sources=imageSources(source),dispose:(()=>void)[]=[];
 const wrapHost=root.closest<HTMLElement>('.preserved-document-block');if(wrapHost){wrapHost.classList.toggle('image-flow-through',sources.length===1&&!!root.querySelector('img[data-image-layout^="wrap-"],img[data-image-layout="inline"]'));}
 Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>!img.closest('.note-embed')).forEach((img,index)=>{
  if(!img.style.width&&!img.hasAttribute('width'))img.style.width='75%';
  if(!sources[index])return;
  const panel=document.createElement('div');panel.className='image-size-controls';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Image options');
  const label=document.createElement('label');label.textContent='Width ';const input=document.createElement('input');input.type='number';input.min='1';input.max='100';input.step='1';input.setAttribute('aria-label','Image width (%)');input.value=img.style.width.endsWith('%')?img.style.width.slice(0,-1):'75';const widthCaption=document.createElement('span');widthCaption.textContent='Width';label.textContent='';const unit=document.createElement('span');unit.className='image-options-unit';unit.textContent='%';label.append(widthCaption,input,unit);
  const button=(text:string,name:string)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',name);return b;};
  const apply=button('Apply','Apply image size'),reset=button('Reset','Reset image size'),remove=button('Delete','Delete image'),close=button('×','Close image options');
  const header=document.createElement('div');header.className='image-options-header';const title=document.createElement('strong');title.textContent='Image';title.prepend(imageIcon('image'));close.textContent='';close.append(imageIcon('close'));remove.prepend(imageIcon('trash'));header.append(title,close);const widthRow=document.createElement('div');widthRow.className='image-options-width';widthRow.append(label,apply,reset);
  const alignment=document.createElement('div');alignment.className='image-options-alignment';alignment.setAttribute('role','group');alignment.setAttribute('aria-label','Image alignment');
  const current=img.dataset.imageLayout??(img.style.float==='left'?'wrap-left':img.style.float==='right'?'wrap-right':img.closest('[align]')?.getAttribute('align')==='center'?'block-center':'block-left');
  const commitLayout=(layout:ImageLayout)=>{if(!editable())return;session.open=index;session.left=panel.style.left;session.top=panel.style.top;update(layoutImageSource(source,index,layout));};
  for(const side of ['left','center','right'] as const){const b=button(side[0].toUpperCase()+side.slice(1),'Align image '+side);b.prepend(imageIcon(side));b.setAttribute('aria-pressed',String(current.endsWith(side)));b.onclick=()=>commitLayout((current.startsWith('wrap-')&&side!=='center'?'wrap-':'block-')+side as ImageLayout);alignment.append(b);}
  const flowLabel=document.createElement('label');flowLabel.className='image-options-flow';flowLabel.textContent='Text flow';const flow=document.createElement('select');flow.setAttribute('aria-label','Image text flow');for(const [value,text] of [['block','Top and bottom'],['inline','Inline with text'],['wrap-left','Wrap · image left'],['wrap-right','Wrap · image right']]){const option=document.createElement('option');option.value=value;option.textContent=text;flow.append(option);}flow.value=current.startsWith('block-')?'block':current;flow.onchange=()=>commitLayout(flow.value==='block'?('block-'+(current.endsWith('right')?'right':current.endsWith('center')?'center':'left')) as ImageLayout:flow.value as ImageLayout);const flowBox=document.createElement('span');flowBox.className='image-options-select';flowBox.append(imageIcon('flow'),flow,imageIcon('chevron'));flowLabel.append(flowBox);
  const oldTab=img.getAttribute('tabindex');img.tabIndex=0;img.classList.add('editable-document-image');img.setAttribute('aria-haspopup','dialog');img.setAttribute('aria-expanded','false');
  const hide=(focus=false)=>{if(session.open===index)session.open=null;panel.hidden=true;img.setAttribute('aria-expanded','false');if(focus)img.focus();};
  const position=()=>{const rect=img.getBoundingClientRect(),viewport=window.visualViewport,w=Math.min(370,(viewport?.width??window.innerWidth)-24),top=viewport?.offsetTop??0,height=viewport?.height??window.innerHeight;panel.style.width=w+'px';panel.style.left=Math.max(12,Math.min(rect.left,window.innerWidth-w-12))+'px';panel.style.top=Math.max(top+12,Math.min(rect.bottom+8,top+height-panel.offsetHeight-12))+'px';};
  const show=(event:Event)=>{if(!editable())return;event.preventDefault();event.stopPropagation();document.dispatchEvent(new CustomEvent('spire-image-options'));panel.hidden=false;session.open=index;img.setAttribute('aria-expanded','true');position();close.focus({preventScroll:true});};
  const key=(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' ')show(event);};
  const save=(percent:number)=>{if(!editable()||!Number.isFinite(percent)||percent<1||percent>100)return;session.open=index;session.left=panel.style.left;session.top=panel.style.top;update(resizeImageSource(source,index,percent));};
  apply.onclick=()=>{if(input.reportValidity())save(input.valueAsNumber);};reset.onclick=()=>save(75);remove.onclick=()=>{if(editable()){hide();update(deleteImageSource(source,index));}};close.onclick=()=>hide(true);
  panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide(true);}else if(event.key==='Enter'&&event.target===input){event.preventDefault();apply.click();}};
  const outside=(event:Event)=>{if(!panel.contains(event.target as globalThis.Node)&&event.target!==img)hide();};const dismiss=()=>hide();
  const body=document.createElement('div');body.className='image-options-body';const alignmentGroup=document.createElement('div');alignmentGroup.className='image-options-section';const alignmentCaption=document.createElement('span');alignmentCaption.textContent='Alignment';alignmentGroup.append(alignmentCaption,alignment);const footer=document.createElement('div');footer.className='image-options-footer';footer.append(remove);body.append(widthRow,alignmentGroup,flowLabel,footer);panel.append(header,body);document.body.append(panel);img.addEventListener('click',show);img.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);document.addEventListener('spire-image-options',dismiss);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
  if(session.open===index){panel.hidden=false;img.setAttribute('aria-expanded','true');position();if(session.left)panel.style.left=session.left;if(session.top)panel.style.top=session.top;}
  dispose.push(()=>{panel.remove();img.removeEventListener('click',show);img.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);document.removeEventListener('spire-image-options',dismiss);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);img.classList.remove('editable-document-image');img.removeAttribute('aria-haspopup');img.removeAttribute('aria-expanded');if(oldTab===null)img.removeAttribute('tabindex');else img.setAttribute('tabindex',oldTab);});
 });return ()=>dispose.forEach(fn=>fn());
}
