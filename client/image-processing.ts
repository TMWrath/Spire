import {diagramScan} from './diagram-scan';
function createCanvas(){return typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');}
export type Settings={rotation:number;flipX:boolean;flipY:boolean;left:number;top:number;right:number;bottom:number;brightness:number;contrast:number;saturation:number;exposure:number;sharpness:number;threshold:number;mode:string;transparent:boolean;inkStrength:number};
export const defaults:Settings={rotation:0,flipX:false,flipY:false,left:0,top:0,right:0,bottom:0,brightness:0,contrast:0,saturation:100,exposure:0,sharpness:0,threshold:170,mode:'Original',transparent:false,inkStrength:50};
export function processPixels(data:Uint8ClampedArray,s:Settings){
 const gain=Math.pow(2,s.exposure),contrast=(100+s.contrast)/100;
 for(let i=0;i<data.length;i+=4){
  let r=data[i],g=data[i+1],b=data[i+2];const lum=.2126*r+.7152*g+.0722*b;
  r=lum+(r-lum)*s.saturation/100;g=lum+(g-lum)*s.saturation/100;b=lum+(b-lum)*s.saturation/100;
  const adjust=(v:number)=>Math.max(0,Math.min(255,((v*gain-128)*contrast+128+s.brightness)));
  r=adjust(r);g=adjust(g);b=adjust(b);
  const l=.2126*r+.7152*g+.0722*b;
  if(s.mode==='Black and white'||s.mode==='Line art'){r=g=b=l<s.threshold?0:255;if(s.transparent)data[i+3]=l<s.threshold?data[i+3]:0;}
  else if(s.mode==='Document'){r=g=b=Math.min(255,l*255/Math.max(1,s.threshold));}
  else if(s.mode==='Whiteboard'){const scale=255/Math.max(1,s.threshold);r=Math.min(255,r*scale);g=Math.min(255,g*scale);b=Math.min(255,b*scale);}
  data[i]=r;data[i+1]=g;data[i+2]=b;
 }
}
export function render(image:HTMLImageElement|ImageBitmap,s:Settings,maxSide:number){
 const sourceWidth='naturalWidth' in image?image.naturalWidth:image.width,sourceHeight='naturalHeight' in image?image.naturalHeight:image.height;
 const factor=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight));
 const w=Math.max(1,Math.round(sourceWidth*factor)),h=Math.max(1,Math.round(sourceHeight*factor));
 const angle=s.rotation*Math.PI/180,cs=Math.abs(Math.cos(angle)),sn=Math.abs(Math.sin(angle));
 const rotated=createCanvas();rotated.width=Math.ceil(w*cs+h*sn);rotated.height=Math.ceil(w*sn+h*cs);
 const rc=rotated.getContext('2d') as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;rc.translate(rotated.width/2,rotated.height/2);rc.rotate(angle);rc.scale(s.flipX?-1:1,s.flipY?-1:1);rc.drawImage(image,-w/2,-h/2,w,h);
 const x=Math.round(rotated.width*s.left/100),y=Math.round(rotated.height*s.top/100);
 const canvas=createCanvas();canvas.width=Math.max(1,Math.round(rotated.width*(100-s.left-s.right)/100));canvas.height=Math.max(1,Math.round(rotated.height*(100-s.top-s.bottom)/100));
 const ctx=canvas.getContext('2d') as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;ctx.drawImage(rotated,x,y,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 // Estimate illumination over a broad local window, preserving pen strokes while lifting paper shadows.
 if(s.mode!=='Original'&&s.mode!=='Diagram scan'){
  // Keep illumination analysis bounded even for large phone photographs.
  const sample=createCanvas();const scale=Math.min(1,256/Math.max(canvas.width,canvas.height));sample.width=Math.max(1,Math.round(canvas.width*scale));sample.height=Math.max(1,Math.round(canvas.height*scale));const sampleContext=sample.getContext('2d') as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;sampleContext.drawImage(canvas,0,0,sample.width,sample.height);
  const width=sample.width,height=sample.height,stride=width+1,data=sampleContext.getImageData(0,0,width,height).data;
  const integral=new Float64Array(stride*(height+1));
  for(let yy=0;yy<height;yy++){let row=0;for(let xx=0;xx<width;xx++){const i=(yy*width+xx)*4;row+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];integral[(yy+1)*stride+xx+1]=integral[yy*stride+xx+1]+row;}}
  const radius=Math.max(8,Math.round(Math.min(width,height)*.06)),gains=new Float32Array(width*height);
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const x0=Math.max(0,xx-radius),x1=Math.min(width,xx+radius+1),y0=Math.max(0,yy-radius),y1=Math.min(height,yy+radius+1);const mean=(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));gains[yy*width+xx]=240/Math.max(100,mean);}
  for(let yy=0;yy<canvas.height;yy++)for(let xx=0;xx<canvas.width;xx++){const gain=gains[Math.min(height-1,Math.floor(yy*height/canvas.height))*width+Math.min(width-1,Math.floor(xx*width/canvas.width))],i=(yy*canvas.width+xx)*4;for(let c=0;c<3;c++)pixels.data[i+c]=Math.min(255,pixels.data[i+c]*gain);}
 }
 if(s.mode==='Diagram scan'){processPixels(pixels.data,{...s,mode:'Original'});pixels.data.set(diagramScan(pixels.data,canvas.width,canvas.height,s.inkStrength));}else processPixels(pixels.data,s);
 if(s.sharpness&&s.mode!=='Diagram scan'){const copy=new Uint8ClampedArray(pixels.data),stride=canvas.width*4,amount=s.sharpness/100;for(let yy=1;yy<canvas.height-1;yy++)for(let xx=1;xx<canvas.width-1;xx++){const i=yy*stride+xx*4;for(let c=0;c<3;c++)pixels.data[i+c]=copy[i+c]+amount*(4*copy[i+c]-copy[i+c-4]-copy[i+c+4]-copy[i+c-stride]-copy[i+c+stride]);}}
 ctx.putImageData(pixels,0,0);return canvas;
}
