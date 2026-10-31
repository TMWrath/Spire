// Original Spire dot-map engine. Browser primitives and handwritten arithmetic only.
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a)||1;return mul(a,1/l);};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function seed(text){let n=2166136261;for(const ch of text)n=Math.imul(n^ch.codePointAt(0),16777619);return n>>>0;}
export function layout(files,links){
 const nodes=[...files].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),index=new Map(nodes.map((n,i)=>[n.id,i]));
 const points=nodes.map((n,i)=>{const h=seed(n.id),y=1-2*(i+.5)/nodes.length,a=(h/4294967296)*Math.PI*2,r=Math.sqrt(1-y*y);return [Math.cos(a)*r,y,Math.sin(a)*r];});
 // Relax repulsion and reference springs on the sphere, never in the renderer.
 // Tangent steps then renormalization keep every file on the spherical surface.
 const edges=links.map(e=>[index.get(e.source),index.get(e.target)]).filter(([a,b])=>a!==undefined&&b!==undefined&&a!==b).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 for(let step=0;step<100;step++){
  const force=points.map(()=>[0,0,0]);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const a=points[i],b=points[j],dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2],d=Math.max(.12,Math.hypot(dx,dy,dz)),s=.022/(d*d*d);
   force[i][0]+=dx*s;force[i][1]+=dy*s;force[i][2]+=dz*s;
   force[j][0]-=dx*s;force[j][1]-=dy*s;force[j][2]-=dz*s;
  }
  for(const [a,b] of edges){const delta=add(points[b],mul(points[a],-1)),d=Math.hypot(...delta)||1,f=mul(delta,.18*(d-.9)/d);force[a]=add(force[a],f);force[b]=add(force[b],mul(f,-1));}
  for(let i=0;i<points.length;i++){const tangent=add(force[i],mul(points[i],-dot(force[i],points[i]))),length=Math.hypot(...tangent);points[i]=unit(add(points[i],mul(tangent,Math.min(.06,.018*(1-step/130)*length)/(length||1))));}
 }
 return new Map(nodes.map((n,i)=>[n.id,points[i]]));
}
export function createLayoutCache(){
 const cache=new Map();
 return (files,edges)=>{
  const key=JSON.stringify([files.map(f=>f.id).sort(),edges.map(e=>[e.source,e.target]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  if(cache.has(key)){const result=cache.get(key);cache.delete(key);cache.set(key,result);return result;}
  const result=layout(files,edges);cache.set(key,result);if(cache.size>8)cache.delete(cache.keys().next().value);return result;
 };
}
export const identity=()=>({axes:[[1,0,0],[0,1,0],[0,0,1]],zoom:1,x:0,y:0});
function around(v,axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return add(add(mul(v,c),mul(cross(axis,v),s)),mul(axis,dot(axis,v)*(1-c)));}
export function turn(camera,yaw,pitch,roll=0){
 let axes=camera.axes.map(v=>around(around(around(v,[0,1,0],yaw),[1,0,0],pitch),[0,0,1],roll));
 const x=unit(axes[0]),y=unit(add(axes[1],mul(x,-dot(x,axes[1]))));axes=[x,y,unit(cross(x,y))];return {...camera,axes};
}
export function project(point,camera,radius){
 const p=[0,1,2].map(k=>point.reduce((s,v,i)=>s+v*camera.axes[i][k],0)),perspective=3.4/(3.4-p[2]),s=radius*camera.zoom*perspective;
 return {x:p[0]*s+camera.x,y:p[1]*s+camera.y,depth:p[2],scale:perspective*camera.zoom};
}
export function zoomAt(camera,factor,anchor){
 const zoom=clamp(camera.zoom*factor,.35,5),ratio=zoom/camera.zoom;
 return {...camera,zoom,x:anchor[0]-(anchor[0]-camera.x)*ratio,y:anchor[1]-(anchor[1]-camera.y)*ratio};
}
export function pairGesture(camera,start,current){
 const center=pair=>[(pair[0][0]+pair[1][0])/2,(pair[0][1]+pair[1][1])/2],distance=p=>Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]),angle=p=>Math.atan2(p[1][1]-p[0][1],p[1][0]-p[0][0]);
 const a=center(start),b=center(current),d=distance(start),next=zoomAt(camera,d<1?1:distance(current)/d,a),twist=d<1?0:angle(current)-angle(start);
 return {...turn(next,0,0,twist),x:next.x+b[0]-a[0],y:next.y+b[1]-a[1]};
}
export function connectionPoint(a,b,t){
 // A shallow bowed chord preserves source→target direction without obscuring dots.
 const mid=unit(add(a,b)),curve=Math.sin(Math.PI*t)*.1;
 return add(add(mul(a,1-t),mul(b,t)),mul(mid,curve));
}
