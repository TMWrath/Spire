export type Quaternion=[number,number,number,number];
export type Point3D={x:number;y:number;z:number};
export type ScreenPoint={x:number;y:number};
export type Camera={x:number;y:number;zoom:number;q:Quaternion};
export const defaultCamera=():Camera=>({x:0,y:0,zoom:1,q:[0,0,0,1]});
function multiply(a:Quaternion,b:Quaternion):Quaternion{const [x,y,z,w]=a,[X,Y,Z,W]=b;const q:Quaternion=[w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];const n=Math.hypot(...q)||1;return q.map(v=>v/n) as Quaternion;}
function axisAngle(x:number,y:number,z:number,a:number):Quaternion{const n=Math.hypot(x,y,z)||1,s=Math.sin(a/2)/n;return [x*s,y*s,z*s,Math.cos(a/2)];}
export function rotatePoint(p:Point3D,q:Quaternion):Point3D{const [x,y,z,w]=q,tx=2*(y*p.z-z*p.y),ty=2*(z*p.x-x*p.z),tz=2*(x*p.y-y*p.x);return {x:p.x+w*tx+y*tz-z*ty,y:p.y+w*ty+z*tx-x*tz,z:p.z+w*tz+x*ty-y*tx};}
export function orbitCamera(camera:Camera,dx:number,dy:number):Camera{const d=Math.hypot(dx,dy);if(!d)return {...camera,q:[...camera.q]};return {...camera,q:multiply(axisAngle(-dy,dx,0,d*.006),camera.q)};}
export function spherePoints(count:number,radius:number):Point3D[]{return Array.from({length:count},(_,i)=>{const y=count===1?0:1-2*(i+.5)/count,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return {x:radius*r*Math.cos(a),y:radius*y,z:radius*r*Math.sin(a)};});}
export function zoomCamera(camera:Camera,factor:number,x:number,y:number):Camera{const zoom=Math.min(4,Math.max(.45,camera.zoom*factor)),ratio=zoom/camera.zoom;return {...camera,zoom,x:x+(camera.x-x)*ratio,y:y+(camera.y-y)*ratio};}
export function pinchCamera(camera:Camera,start:ScreenPoint[],current:ScreenPoint[]):Camera{const center=(ps:ScreenPoint[])=>({x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}),a=center(start),b=center(current),dist=(ps:ScreenPoint[])=>Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y),angle=(ps:ScreenPoint[])=>Math.atan2(ps[1].y-ps[0].y,ps[1].x-ps[0].x);const factor=dist(start)>1?dist(current)/dist(start):1,zoomed=zoomCamera(camera,factor,a.x,a.y);return {...zoomed,x:zoomed.x+b.x-a.x,y:zoomed.y+b.y-a.y,q:multiply(axisAngle(0,0,1,angle(current)-angle(start)),camera.q)};}
export function projectPoint(p:Point3D,camera:Camera,radius:number){const v=rotatePoint(p,camera.q),distance=Math.max(1,radius*4),scale=distance/Math.max(distance*.25,distance-v.z);return {x:camera.x+v.x*scale*camera.zoom,y:camera.y+v.y*scale*camera.zoom,depth:v.z,scale:scale*camera.zoom};}
