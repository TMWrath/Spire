/** HTTP single-byte range, inclusive end. Invalid/unsatisfiable requests return null. */
export function byteRange(header:string,size:number):{start:number;end:number}|null{
 const m=/^bytes=(\d*)-(\d*)$/.exec(header.trim());if(!m||size<=0||(!m[1]&&!m[2]))return null;
 let start:number,end:number;
 if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(m[1]);const last=m[2]?Number(m[2]):size-1;if(!Number.isSafeInteger(last))return null;end=Math.min(last,size-1);}
 return Number.isSafeInteger(start)&&start>=0&&start<size&&end>=start?{start,end}:null;
}
