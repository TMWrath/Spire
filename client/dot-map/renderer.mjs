import {layout,identity,turn,project,zoomAt,pairGesture,connectionPoint} from './core.mjs';
export function orderPulseEdges(edges,depth){return edges.map((e,index)=>({...e,pulseOffset:(index*.173)%1,depth:depth(e)})).sort((a,b)=>a.depth-b.depth);}
// Production adapter for the approved isolated canvas engine. No workspace writes or requests.
export function createDotMap(canvas,{files,edges,onSelect,onOpen=()=>{}}){
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas drawing is unavailable');
 const positions=layout(files,edges),fileIndex=new Map(files.map(f=>[f.id,f])),media=matchMedia('(prefers-reduced-motion: reduce)');
 let camera=identity(),selected=null,hover=null,query='',paused=false,reduced=media.matches,width=1,height=1,radius=1,points=[],raf=0;
 const pointers=new Map();let gesture=null,moved=false;const cleanup=[];
 function listen(target,type,handler,options){target.addEventListener(type,handler,options);cleanup.push(()=>target.removeEventListener(type,handler,options));}
 canvas.dataset.nodes=String(files.length);canvas.dataset.renderer='original-canvas-dots';
const matching=f=>!query||f.name.toLowerCase().includes(query);
function motion(){return edges.length>0&&!paused&&!reduced&&!document.hidden;}
function updateState(){canvas.dataset.camera=JSON.stringify(camera);canvas.dataset.rotation=camera.axes.flat().join(',');canvas.dataset.zoom=camera.zoom.toFixed(4);canvas.dataset.pan=`${camera.x},${camera.y}`;canvas.dataset.matches=String(files.filter(matching).length);canvas.dataset.motion=motion()?'animated':'static';}
function invalidate(){updateState();if(!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function resize(){const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);radius=Math.min(width,height)*.37;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);invalidate();}
function select(id){selected=selected===id?null:id;onSelect(selected);invalidate();}
function local(e){const box=canvas.getBoundingClientRect();return [e.clientX-box.left-width/2,e.clientY-box.top-height/2];}
function hit(at){return [...points].reverse().find(p=>matching(p.file)&&Math.hypot(p.x-at[0],p.y-at[1])<=Math.max(13,p.r+5))?.file.id||null;}
function rebase(){const pair=[...pointers.values()];gesture=pair.length?{camera,points:pair.map(p=>[...p]),pan:gesture?.pan||false}:null;}
function cancel(){const ids=[...pointers.keys()];pointers.clear();gesture=null;moved=false;canvas.classList.remove('dragging');for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
listen(canvas,'pointerdown',e=>{
 if(pointers.size>=2||e.button===2)return;e.preventDefault();canvas.focus({preventScroll:true});hover=null;
 if(!pointers.size){moved=false;gesture={pan:e.button===1||e.shiftKey};}
 pointers.set(e.pointerId,local(e));canvas.setPointerCapture(e.pointerId);if(pointers.size>1)moved=true;rebase();canvas.classList.add('dragging');invalidate();
});
listen(canvas,'pointermove',e=>{
 const at=local(e);if(!pointers.has(e.pointerId)){if(e.pointerType==='mouse'){const next=hit(at);if(next!==hover){hover=next;invalidate();}}return;}
 pointers.set(e.pointerId,at);const current=[...pointers.values()],base=gesture;if(!base)return;
 if(current.length===2)camera=pairGesture(base.camera,base.points,current);
 else{const dx=at[0]-base.points[0][0],dy=at[1]-base.points[0][1];if(Math.hypot(dx,dy)>5)moved=true;if(moved)camera=base.pan?{...base.camera,x:base.camera.x+dx,y:base.camera.y+dy}:turn(base.camera,dx*.0055,-dy*.0055);}
 invalidate();
});
listen(canvas,'pointerup',e=>{if(!pointers.has(e.pointerId))return;const tap=pointers.size===1&&!moved,id=tap?hit(local(e)):null;pointers.delete(e.pointerId);rebase();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!pointers.size)canvas.classList.remove('dragging');if(tap)select(id);invalidate();});
listen(canvas,'pointercancel',cancel);listen(canvas,'lostpointercapture',e=>{if(pointers.has(e.pointerId))cancel();});listen(canvas,'pointerleave',()=>{hover=null;invalidate();});
listen(canvas,'wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);camera=zoomAt(camera,Math.exp(-Math.max(-600,Math.min(600,delta))*.0018),local(e));rebase();invalidate();},{passive:false});
listen(canvas,'contextmenu',e=>e.preventDefault());
listen(canvas,'keydown',e=>{const controls=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape'];if(!controls.includes(e.key))return;e.preventDefault();cancel();if(e.key==='Home')camera=identity();else if(e.key==='Escape')select(null);else if(['+','=','-'].includes(e.key))camera=zoomAt(camera,e.key==='-'?.8:1.25,[0,0]);else if(e.shiftKey)camera={...camera,x:camera.x+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),y:camera.y+(e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0)};else camera=turn(camera,e.key==='ArrowRight'?.12:e.key==='ArrowLeft'?-.12:0,e.key==='ArrowDown'?-.12:e.key==='ArrowUp'?.12:0);invalidate();});
listen(canvas,'dblclick',e=>{const id=hit(local(e));if(id)onOpen(id);});
function dot(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function draw(now){
 raf=0;ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);
 const neighbors=new Set([selected]);for(const e of edges)if(e.source===selected||e.target===selected){neighbors.add(e.source);neighbors.add(e.target);}
 // Sparse guide geometry gives orientation, not a painted flat globe backdrop.
 ctx.lineWidth=.7;for(let axis=0;axis<3;axis++)for(let i=0;i<80;i++){
  const at=t=>{const a=t*Math.PI*2,s=Math.sin(a),c=Math.cos(a);return axis===0?[s,c,0]:axis===1?[s,0,c]:[0,s,c];};
  const a=project(at(i/80),camera,radius),b=project(at((i+1)/80),camera,radius);ctx.strokeStyle=`rgba(255,255,255,${a.depth<0?.023:.055})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 const ordered=orderPulseEdges(edges,e=>(project(positions.get(e.source),camera,radius).depth+project(positions.get(e.target),camera,radius).depth)/2);
 for(let index=0;index<ordered.length;index++){
  const e=ordered[index],a=positions.get(e.source),b=positions.get(e.target),active=selected&&(e.source===selected||e.target===selected),dim=(selected&&!active)||!matching(fileIndex.get(e.source))||!matching(fileIndex.get(e.target));
  const opacity=dim?.022:active?.66:.075+(e.depth+1)*.06;
  ctx.strokeStyle=`rgba(230,230,230,${opacity})`;ctx.lineWidth=active?1.15:.65;ctx.beginPath();for(let j=1;j<=22;j++){const t=.035+j/23*.93,p=project(connectionPoint(a,b,t),camera,radius);if(j===1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();
  if(active){const tip=project(connectionPoint(a,b,.9),camera,radius),prev=project(connectionPoint(a,b,.86),camera,radius),angle=Math.atan2(tip.y-prev.y,tip.x-prev.x);ctx.beginPath();ctx.moveTo(tip.x-5*Math.cos(angle-.5),tip.y-5*Math.sin(angle-.5));ctx.lineTo(tip.x,tip.y);ctx.lineTo(tip.x-5*Math.cos(angle+.5),tip.y-5*Math.sin(angle+.5));ctx.stroke();}
  if(motion()&&!dim){const t=(now/5200+e.pulseOffset)%1;for(let tail=3;tail>=0;tail--){const progress=t-tail*.014;if(progress<.045||progress>.955)continue;const p=project(connectionPoint(a,b,progress),camera,radius);dot(p.x,p.y,tail?1:1.65,`rgba(255,255,255,${(active?.85:.4)*(1-tail*.2)})`);}}
 }
 points=files.map(file=>{const p=project(positions.get(file.id),camera,radius);return {...p,file,r:Math.max(2.2,Math.min(7,(3.3+(p.depth+1)*.9)*Math.sqrt(camera.zoom))),dim:(selected&&!neighbors.has(file.id))||!matching(file)};}).sort((a,b)=>a.depth-b.depth);
 for(const p of points){const active=p.file.id===selected||p.file.id===hover,alpha=p.dim?.1:.28+(p.depth+1)*.34;if(active){ctx.strokeStyle='#bbb';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(p.x,p.y,p.r+5,0,Math.PI*2);ctx.stroke();dot(p.x,p.y,p.r+10,'rgba(255,255,255,.035)');}dot(p.x,p.y,p.r,`rgba(245,245,245,${active?1:alpha})`);if(p.depth>.1&&!p.dim)dot(p.x-p.r*.22,p.y-p.r*.28,Math.max(.6,p.r*.2),'#fff');}
 const labels=[],labelOrder=[...points].sort((a,b)=>{const priority=p=>(p.file.id===selected?100:p.file.id===hover?90:query&&matching(p.file)?80:selected&&neighbors.has(p.file.id)?70:0)+p.depth;return priority(b)-priority(a);});
 ctx.font='11px system-ui';for(const p of labelOrder){const important=p.file.id===selected||p.file.id===hover||query&&matching(p.file);if(p.dim||p.depth<-.1&&!important)continue;const label=p.file.name.length>25?p.file.name.slice(0,24)+'…':p.file.name,w=ctx.measureText(label).width,side=p.x>0?1:-1,x=side===1?p.x+p.r+10:p.x-p.r-10-w,y=p.y+4,rect={x:x-4,y:y-12,w:w+8,h:18};if(x<-width/2+6||x+w>width/2-6||y<-height/2+30||y>height/2-25)continue;if(!important&&labels.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y))continue;labels.push(rect);ctx.fillStyle=important?'rgba(9,9,9,.9)':'rgba(9,9,9,.65)';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.fillStyle=important?'#fff':`rgba(220,220,220,${.4+(p.depth+1)*.23})`;ctx.fillText(label,x,y);}
 ctx.restore();if(motion())raf=requestAnimationFrame(draw);
}

 listen(media,'change',()=>{reduced=media.matches;invalidate();});
 listen(window,'blur',cancel);
 listen(document,'visibilitychange',()=>{cancel();if(document.hidden){cancelAnimationFrame(raf);raf=0;}invalidate();});
 resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
 return {
  select,
  search(value){query=value.trim().toLowerCase();invalidate();},
  pause(value){paused=value;invalidate();},
  zoom(factor){camera=zoomAt(camera,factor,[0,0]);rebase();invalidate();},
  reset(){cancel();camera=identity();invalidate();},
  destroy(){observer.disconnect();for(const remove of cleanup)remove();cancel();cancelAnimationFrame(raf);raf=0;},
 };
}
