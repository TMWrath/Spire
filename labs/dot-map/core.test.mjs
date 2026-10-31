import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,identity,turn,project,zoomAt,pairGesture} from '../../client/dot-map/core.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('layout is deterministic, spherical and independent of incoming file order',()=>{
 const nodes=Array.from({length:32},(_,i)=>({id:`f${i}`})); const before=JSON.stringify(nodes);const a=layout(nodes,[]),b=layout([...nodes].reverse(),[]);
 for(const n of nodes){const p=a.get(n.id);near(Math.hypot(...p),1);assert.deepEqual(p,b.get(n.id));}
 for(let k=0;k<3;k++){const vals=[...a.values()].map(p=>p[k]);assert.ok(Math.min(...vals)<-.7&&Math.max(...vals)>.7);}
 assert.equal(JSON.stringify(nodes),before);assert.equal(layout([],[]).size,0);near(Math.hypot(...layout([{id:'one'}],[]).get('one')),1);
});
test('repeated unrestricted orbit preserves orthonormal frame and input state',()=>{
 const start=identity();let c=start;for(let i=0;i<1200;i++)c=turn(c,.04,-.02,.006);
 for(const v of c.axes)near(Math.hypot(...v),1);for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)near(c.axes[i].reduce((s,v,k)=>s+v*c.axes[j][k],0),0);
 assert.deepEqual(start,identity()); const p=project([.2,.3,.9],c,200);assert.ok(Object.values(p).every(Number.isFinite));
});
test('zoom stays anchored to pointer and clamps extremes',()=>{
 const c=identity(),p=[.3,.2,.9],a=project(p,c,200),z=zoomAt(c,1.4,[a.x,a.y]),b=project(p,z,200);near(a.x,b.x);near(a.y,b.y);near(zoomAt(c,100,[0,0]).zoom,5);near(zoomAt(c,.001,[0,0]).zoom,.35);assert.deepEqual(c,identity());
});
test('pinch pan twist combine without mutating baseline; coincident fingers are finite',()=>{
 const c=identity(),b=[[-30,0],[30,0]],n=[[15,-60],[15,60]],out=pairGesture(c,b,n);near(out.zoom,2);near(out.x,15);assert.notDeepEqual(out.axes,c.axes);assert.deepEqual(c,identity());assert.ok(Object.values(project([0,0,1],pairGesture(c,[[0,0],[0,0]],[[0,0],[0,0]]),200)).every(Number.isFinite));
});

import {readFileSync} from 'node:fs';
test('shipping engine and synthetic fixture match the approved isolated preview',()=>{for(const name of ['core.mjs','demo.mjs'])assert.equal(readFileSync(new URL(`../../client/dot-map/${name}`,import.meta.url),'utf8'),readFileSync(new URL(name,import.meta.url),'utf8'));});
