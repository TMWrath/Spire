import {render,type Settings} from './image-processing';
let image:Promise<ImageBitmap>|undefined;
self.onmessage=async({data}:{data:{type:string;file?:File;id:number;settings:Settings;maxSide:number}})=>{
 if(data.type==='init'){image=createImageBitmap(data.file!).then(source=>{const scale=Math.min(1,800/Math.max(source.width,source.height));const canvas=new OffscreenCanvas(Math.max(1,Math.round(source.width*scale)),Math.max(1,Math.round(source.height*scale)));canvas.getContext('2d')!.drawImage(source,0,0,canvas.width,canvas.height);source.close();return canvas.transferToImageBitmap();});return;}
 if(data.type!=='render')return;
 try{const source=await image;if(!source)throw Error('Image not ready');const canvas=render(source,data.settings,data.maxSide??800) as OffscreenCanvas;const bitmap=canvas.transferToImageBitmap();self.postMessage({id:data.id,bitmap},{transfer:[bitmap]});}
 catch(error){self.postMessage({id:data.id,error:(error as Error).message});}
};
