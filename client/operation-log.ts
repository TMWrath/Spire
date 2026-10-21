export type OperationEntry={id:string;time:string;operation:string;mount:string;phase:'started'|'ok'|'failed';durationMs?:number;status?:number;failure?:string};
const key='spire-operation-log-v1';
let entries:OperationEntry[]=[];
try{const saved=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(saved))entries=saved.slice(0,500);}catch{}
export function operationEntries(){return [...entries];}
export function clearOperations(){entries=[];publish();}
function publish(){try{localStorage.setItem(key,JSON.stringify(entries));}catch{}globalThis.dispatchEvent?.(new Event('spire-operation-log'));}
// Deliberately excludes request bodies, URLs, filenames, headers and exception messages.
export async function traceOperation<T>(operation:string,mount:string,run:()=>Promise<T>):Promise<T>{
 const id=crypto.randomUUID(),start=performance.now();
 const record=(phase:OperationEntry['phase'],extra:Partial<OperationEntry>={})=>{entries.unshift({id,time:new Date().toISOString(),operation,mount,phase,...extra});entries=entries.slice(0,500);publish();};
 record('started');
 try{const result=await run();const status=result instanceof Response?result.status:undefined;record(status!==undefined&&status>=400?'failed':'ok',{durationMs:Math.round(performance.now()-start),status});return result;}
 catch(error){const name=error instanceof Error?error.name:'';record('failed',{durationMs:Math.round(performance.now()-start),failure:['TimeoutError','AbortError','TypeError'].includes(name)?name:'RequestError'});throw error;}
}
export function operationRoute(url:string){const path=url.split('?')[0];if(path.startsWith('/device-workspaces/'))return '/device-workspaces/[device]/'+(path.endsWith('/changes')?'changes':path.endsWith('/snapshot')?'snapshot':'operation');return ['/mutate','/snapshot','/local/open','/local/refresh','/me','/reliquary'].includes(path)?path:'/other';}
