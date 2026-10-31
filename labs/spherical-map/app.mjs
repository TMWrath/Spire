import {initialCamera,orbit,pinch,zoomAt,spherePoints,project,rotateVector} from './camera.mjs';
const NS='http://www.w3.org/2000/svg';
const svg=document.querySelector('#surface'),world=document.querySelector('#world'),axes=document.querySelector('#axes');
const names=['Origin','Architecture','Fragments','Nightfall','Characters','Worldbuilding','Sound & Motion','The Observatory','Research','Visual Language','Chapter One','Field Journal','Inspiration','Systems','Future Visions','Afterlight'];
const el=(tag,attrs={},parent=world)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
let camera=initialCamera(),width=800,height=600,radius=210,points=spherePoints(16,210),selected=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let dirty=true,frame=0,lastTime=0,velocity={x:0,y:0},lastMove=0,gesture=null,moved=false;
const pointers=new Map();
const wires=Array.from({length:3},()=>Array.from({length:48},()=>el('path',{class:'wire'})));
const seen=new Set(),edges=[];names.forEach((_,i)=>{for(const j of [(i+1)%16,...(i%2===0?[(i+5)%16]:[]),...(i>0&&i%3===0?[0]:[])]){const key=`${j}:${i}`;if(seen.has(key))continue;seen.add(key);edges.push({from:j,to:i,path:el('path',{class:'link'}),pulse:el('circle',{class:'pulse',r:2})});}});
const nodes=names.map((name,i)=>{const g=el('g',{class:'node',role:'button',tabindex:'0','aria-label':`Select ${name}`,'data-id':i});el('polygon',{class:'shell',points:'-48,0 -24,-30 24,-30 48,0 24,30 -24,30'},g);const text=el('text',{class:'label'},g);const words=name.split(' ');const lines=name.length>14&&words.length>1?[words.slice(0,-1).join(' '),words.at(-1)]:[name];lines.forEach((line,j)=>{const t=el('tspan',{x:0,y:(j-(lines.length-1)/2)*13},text);t.textContent=line;});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i);}});return g;});
function choose(i){selected=selected===i?null:i;const panel=document.querySelector('#selection');panel.hidden=selected===null;panel.textContent=selected===null?'':`${names[selected]} · Demo file`;invalidate();}
function invalidate(){dirty=true;if(!frame)frame=requestAnimationFrame(draw);}
function draw(time){frame=0;const dt=Math.min(40,Math.max(0,time-(lastTime||time)));lastTime=time;
 if(!pointers.size&&Math.hypot(velocity.x,velocity.y)>.03){camera=orbit(camera,velocity.x*dt,velocity.y*dt);const decay=Math.exp(-dt/140);velocity.x*=decay;velocity.y*=decay;dirty=true;}
 if(dirty||!paused){dirty=false;world.setAttribute('transform',`translate(${width/2},${height/2})`);
  for(let axis=0;axis<3;axis++){for(let i=0;i<48;i++){const angle=i/48*Math.PI*2,next=(i+1)/48*Math.PI*2;const v=a=>axis===0?{x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:0}:axis===1?{x:Math.cos(a)*radius,y:0,z:Math.sin(a)*radius}:{x:0,y:Math.cos(a)*radius,z:Math.sin(a)*radius};const a=project(v(angle),camera,radius),b=project(v(next),camera,radius),path=wires[axis][i];path.setAttribute('d',`M${a.x},${a.y} L${b.x},${b.y}`);path.setAttribute('opacity',(a.depth+b.depth)/2<0?'.12':'.35');}}
  const ps=points.map(p=>project(p,camera,radius));const neighbors=new Set([selected]);if(selected!==null)for(const edge of edges)if(edge.from===selected||edge.to===selected){neighbors.add(edge.from);neighbors.add(edge.to);}
  edges.forEach((edge,i)=>{const a=ps[edge.from],b=ps[edge.to],opacity=selected!==null&&edge.from!==selected&&edge.to!==selected?.06:.18+Math.max(0,(a.depth+b.depth)/(2*radius))*.35;edge.path.setAttribute('d',`M${a.x},${a.y} L${b.x},${b.y}`);edge.path.setAttribute('opacity',opacity);const t=((time/4500+i*.137)%1);edge.pulse.setAttribute('cx',a.x+(b.x-a.x)*t);edge.pulse.setAttribute('cy',a.y+(b.y-a.y)*t);edge.pulse.setAttribute('opacity',paused?0:Math.min(1,opacity*2));});
  [...nodes.keys()].sort((a,b)=>ps[a].depth-ps[b].depth).forEach(i=>{const p=ps[i],g=nodes[i],size=Math.min(1.65,Math.max(.45,p.scale*.83));g.setAttribute('transform',`translate(${p.x},${p.y}) scale(${size})`);g.setAttribute('opacity',selected!==null&&!neighbors.has(i)?'.13':p.depth<0?'.35':'.98');g.classList.toggle('selected',i===selected);g.setAttribute('aria-pressed',String(i===selected));world.append(g);});
  axes.replaceChildren();for(const [label,p,color] of [['X',{x:1,y:0,z:0},'#b7b7c2'],['Y',{x:0,y:1,z:0},'#88889a'],['Z',{x:0,y:0,z:1},'#eeeeff']]){const v=rotateVector(p,camera.q);el('line',{x1:0,y1:0,x2:v.x*23,y2:v.y*23,stroke:color},axes);const text=el('text',{x:v.x*28,y:v.y*28,'text-anchor':'middle'},axes);text.textContent=label;}
  svg.dataset.zoom=camera.zoom.toFixed(4);svg.dataset.rotation=camera.q.join(',');svg.dataset.pan=`${camera.x},${camera.y}`;
 }
 if((!paused&&!document.hidden)||Math.hypot(velocity.x,velocity.y)>.03)frame=requestAnimationFrame(draw);
}
function relative(e){const b=svg.getBoundingClientRect();return {x:e.clientX-b.left-width/2,y:e.clientY-b.top-height/2};}
function rebase(){gesture={camera:{...camera,q:[...camera.q]},start:[...pointers.values()].slice(0,2).map(p=>({...p}))};}
svg.addEventListener('pointerdown',e=>{if(pointers.size>=2)return;const p=relative(e);pointers.set(e.pointerId,{...p,button:e.button,pan:e.button===1||e.shiftKey,hit:e.target.closest('.node')?.dataset.id});velocity={x:0,y:0};moved=pointers.size>1;svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');rebase();e.preventDefault();});
svg.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const p=relative(e),dx=p.x-old.x,dy=p.y-old.y;pointers.set(e.pointerId,{...old,...p});const start=gesture.start;if(Math.hypot(p.x-start[0].x,p.y-start[0].y)>5||pointers.size>1)moved=true;
 if(pointers.size===2){camera=pinch(gesture.camera,start,[...pointers.values()].slice(0,2));velocity={x:0,y:0};}
 else if(old.pan){camera={...camera,x:camera.x+dx,y:camera.y+dy};velocity={x:0,y:0};}
 else{camera=orbit(camera,dx,dy);const now=performance.now(),delta=Math.max(8,now-lastMove);velocity={x:dx/delta,y:dy/delta};lastMove=now;}
 invalidate();});
function end(e,cancel=false){const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(cancel||paused||performance.now()-lastMove>90)velocity={x:0,y:0};if(!moved&&!cancel&&p.hit!==undefined)choose(Number(p.hit));if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(pointers.size){moved=true;velocity={x:0,y:0};rebase();}else{gesture=null;svg.classList.remove('dragging');}invalidate();}
svg.addEventListener('pointerup',e=>end(e));svg.addEventListener('pointercancel',e=>end(e,true));svg.addEventListener('lostpointercapture',e=>end(e,true));svg.addEventListener('contextmenu',e=>e.preventDefault());
svg.addEventListener('wheel',e=>{e.preventDefault();const p=relative(e),unit=e.deltaMode===1?16:e.deltaMode===2?height:1;camera=zoomAt(camera,Math.exp(-Math.max(-400,Math.min(400,e.deltaY*unit))*.002),p.x,p.y);if(pointers.size)rebase();invalidate();},{passive:false});
function reset(){camera=initialCamera();velocity={x:0,y:0};if(pointers.size)rebase();invalidate();}
svg.addEventListener('dblclick',e=>{if(!e.target.closest('.node'))reset();});
svg.addEventListener('keydown',e=>{if(e.target!==svg)return;const keys={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};if(keys[e.key]){e.preventDefault();camera=orbit(camera,...keys[e.key]);invalidate();}else if(e.key==='Home'){e.preventDefault();reset();}else if(['+','=','-'].includes(e.key)){e.preventDefault();camera=zoomAt(camera,e.key==='-'?.8:1.25,0,0);invalidate();}});
for(const [id,factor]of [['in',1.25],['out',.8]])document.querySelector('#'+id).addEventListener('click',()=>{camera=zoomAt(camera,factor,0,0);invalidate();});document.querySelector('#reset').addEventListener('click',reset);
const motion=document.querySelector('#motion');function updateMotion(){motion.textContent=paused?'▷':'Ⅱ';motion.setAttribute('aria-label',paused?'Resume pulses':'Pause pulses');}updateMotion();motion.addEventListener('click',()=>{paused=!paused;updateMotion();invalidate();});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');reduced.addEventListener('change',()=>{paused=reduced.matches;velocity={x:0,y:0};updateMotion();invalidate();});
function abort(){pointers.clear();gesture=null;velocity={x:0,y:0};svg.classList.remove('dragging');invalidate();}window.addEventListener('blur',abort);document.addEventListener('visibilitychange',()=>{if(document.hidden){abort();if(frame)cancelAnimationFrame(frame);frame=0;}else{lastTime=0;invalidate();}});
new ResizeObserver(()=>{const b=svg.getBoundingClientRect();width=b.width;height=b.height;radius=Math.max(50,Math.min(width,height)*.37);points=spherePoints(16,radius);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);invalidate();}).observe(svg);
invalidate();
