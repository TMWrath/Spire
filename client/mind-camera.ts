export type Camera={x:number;y:number;z:number;yaw:number;pitch:number};
export const defaultCamera=():Camera=>({x:0,y:0,z:1,yaw:0,pitch:0});
export function dragCamera(start:Camera,dx:number,dy:number,mode:'orbit'|'pan'):Camera{
 return mode==='pan'?{...start,x:start.x+dx,y:start.y+dy}:{...start,yaw:start.yaw+dx*.008,pitch:Math.max(-Math.PI/2,Math.min(Math.PI/2,start.pitch+dy*.008))};
}
export function projectPoint(p:{x:number;y:number;z:number},camera:Camera,extent:number){
 const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
 const x=p.x*cy+p.z*sy,rz=-p.x*sy+p.z*cy,y=p.y*cp-rz*sp,depth=p.y*sp+rz*cp;
 const distance=Math.max(800,extent*4),scale=distance/Math.max(distance*.25,distance-depth);
 return {x:x*scale,y:y*scale,depth,scale};
}
