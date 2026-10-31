export type NativeRequest={origin:string;path:string;method:string;headers:Record<string,string>;body?:string;binary?:boolean};
export type NativeResponse={status:number;type:string;body:string};
export type RemoteTransport={request(input:NativeRequest):Promise<NativeResponse>};
declare global {var spireRemoteTransport:RemoteTransport|undefined;var spireLocalWorkspace:boolean|undefined;var spireLocalManual:boolean|undefined;var spireLocalIdentity:import('./sync').Identity|undefined;}
export function remoteOrigin(value:string):string{const u=new URL(value.trim());if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use an HTTPS server origin without a path or embedded credentials.');return u.origin;}
export const bytesFromBase64=(data:string)=>Uint8Array.from(atob(data),c=>c.charCodeAt(0));
export function base64FromBytes(data:Uint8Array){let text='';for(let i=0;i<data.length;i+=8192)text+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(text);}
export async function remoteFetch(origin:string,url:string,options:RequestInit={}):Promise<Response>{
 if(!globalThis.spireRemoteTransport)throw Error('Update the Spire native app to connect a server from your local workspace.');
 const path='/api'+url;if(!path.startsWith('/api/')||path.includes('\\')||new URL(path,origin).origin!==origin||new URL(path,origin).pathname!==path.split('?')[0])throw Error('Invalid server API path');
 const headers=Object.fromEntries(new Headers(options.headers).entries());let body:string|undefined,binary=false;
 if(options.body instanceof Blob){body=base64FromBytes(new Uint8Array(await options.body.arrayBuffer()));binary=true;}else if(typeof options.body==='string')body=options.body;else if(options.body!=null)throw Error('Unsupported request body');
 const result=await globalThis.spireRemoteTransport.request({origin:remoteOrigin(origin),path,method:options.method??'GET',headers,body,binary});
 return new Response(result.status===204?null:bytesFromBase64(result.body),{status:result.status,headers:{'Content-Type':result.type}});
}
