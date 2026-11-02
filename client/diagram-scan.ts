/** Local paper estimation and adaptive monochrome ink extraction. Input bytes stay untouched. */
export function diagramScan(source:Uint8ClampedArray,width:number,height:number,strength=50):Uint8ClampedArray{
 if(width<1||height<1||source.length!==width*height*4)throw new Error('Invalid diagram dimensions');
 const count=width*height,luma=new Uint8Array(count),horizontal=new Uint8Array(count),background=new Uint8Array(count),histogram=new Uint32Array(256);
 for(let i=0;i<count;i++){const p=i*4,a=source[p+3]/255;luma[i]=Math.round((.2126*source[p]+.7152*source[p+1]+.0722*source[p+2])*a+255*(1-a));if(a>.5)histogram[luma[i]]++;}
 let total=0;for(const n of histogram)total+=n;let sum=0,paper=255;for(let v=0;v<256;v++){sum+=histogram[v];if(sum>=total*.9){paper=v;break;}}
 for(let i=0;i<count;i++)if(source[i*4+3]===0)luma[i]=paper;
 const radius=Math.max(8,Math.round(Math.min(width,height)*.04));
 // Separable sliding maxima: O(pixels), small byte buffers, no full-size floating-point integrals.
 const queue=new Int32Array(Math.max(width,height));
 function maximum(input:Uint8Array,output:Uint8Array,lines:number,length:number,step:number,lineStep:number){
  for(let line=0;line<lines;line++){let head=0,tail=0,next=0;const start=line*lineStep;for(let pos=0;pos<length;pos++){const end=Math.min(length-1,pos+radius);while(next<=end){while(tail>head&&input[start+queue[tail-1]*step]<=input[start+next*step])tail--;queue[tail++]=next++;}while(queue[head]<pos-radius)head++;output[start+pos*step]=input[start+queue[head]*step];}}
 }
 maximum(luma,horizontal,height,width,1,width);maximum(horizontal,background,width,height,width,1);
 const output=new Uint8ClampedArray(source.length),cutoff=.22-.20*Math.max(0,Math.min(100,strength))/100;
 for(let i=0;i<count;i++){const estimated=Math.max(background[i],paper*.3,1),difference=(estimated-luma[i])/estimated;const alpha=Math.max(0,Math.min(1,(difference-cutoff)/.025));output[i*4+3]=Math.round(source[i*4+3]*alpha);}
 return output;
}
