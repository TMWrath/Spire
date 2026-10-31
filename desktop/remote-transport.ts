import {remoteOrigin,type NativeRequest,type NativeResponse} from '../client/mount-transport';
export function checkedNativeRequest(input:unknown):NativeRequest{
 if(!input||typeof input!=='object')throw Error('Invalid native request');const r=input as NativeRequest;const origin=remoteOrigin(r.origin);const u=new URL(r.path,origin);
 if(!r.path.startsWith('/api/')||r.path.includes('\\')||u.origin!==origin||u.username||u.password||u.hash||u.pathname!==r.path.split('?')[0]||r.path.length>20000)throw Error('Invalid native API path');
 if(!['GET','POST','PUT','DELETE','HEAD'].includes(r.method))throw Error('Native request method rejected');
 if(r.body!==undefined&&(typeof r.body!=='string'||r.body.length>48*1024*1024))throw Error('Native request exceeds limit');
 if(['GET','HEAD'].includes(r.method)&&r.body)throw Error('Unexpected request body');
 const headers:Record<string,string>={};for(const [key,value]of Object.entries(r.headers??{})){if(!['content-type','x-csrf-token'].includes(key.toLowerCase())||typeof value!=='string'||value.length>4096||/[\r\n]/.test(value))throw Error('Native request header rejected');headers[key]=value;}
 return {origin,path:r.path,method:r.method,headers,body:r.body,binary:r.binary===true};
}
export async function nativeRemoteRequest(input:unknown,fetcher:(origin:string,url:string,options:RequestInit)=>Promise<Response>):Promise<NativeResponse>{
 const r=checkedNativeRequest(input);const response=await fetcher(r.origin,r.origin+r.path,{method:r.method,headers:{...r.headers,Origin:r.origin},...(r.body!==undefined?{body:r.binary?Buffer.from(r.body,'base64'):r.body}:{}),credentials:'include',redirect:'error',signal:AbortSignal.timeout(25000)});
 const chunks:Uint8Array[]=[];let size=0;const reader=response.body?.getReader();if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>32*1024*1024)throw Error('Server response exceeds 32 MiB');chunks.push(part.value);}}finally{await reader.cancel();}}
 return {status:response.status,type:response.headers.get('content-type')??'application/octet-stream',body:Buffer.concat(chunks).toString('base64')};
}
