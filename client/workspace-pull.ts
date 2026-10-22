import {applyWorkspaceDelta,buildWorkspaceIndex,contentFingerprint,workspaceIndexSchema,type WorkspaceIndex,type WorkspaceDelta} from '../shared/workspace-index';
type Workspace={seq:number;notes:{id:string;path:string;content:string}[];folders:string[]};
export type WorkspaceBase<T extends Workspace>={index:WorkspaceIndex;snapshot:T;structureOnly?:boolean};
type Request=(path:string,options?:RequestInit)=>Promise<any>;
/** A common server base, never the optimistic editing projection. No I/O on cache reveal. */
export async function pullWorkspace<T extends Workspace>(request:Request,base?:WorkspaceBase<T>,structureOnly=false):Promise<{base:WorkspaceBase<T>;received:T['notes']}>{
 if(structureOnly){
  const head:{revision:string}=await request('/workspace/head');
  if(base?.structureOnly&&head.revision===base.index.revision)return {base,received:[] as unknown as T['notes']};
  const manifest:{index:WorkspaceIndex;snapshot:T}=await request('/workspace/manifest');
  const index=workspaceIndexSchema.parse(manifest.index),snapshot=manifest.snapshot;
  const prior=new Map(base?.index.files.map(f=>[f.id,f])??[]),previous=new Map(base?.snapshot.notes.map(n=>[n.id,n])??[]);
  const indexed=new Map(index.files.map(f=>[f.id,f]));
  if(snapshot.notes.length!==indexed.size||new Set(snapshot.notes.map(n=>n.id)).size!==indexed.size)throw Error('Incomplete workspace directory');
  for(const n of snapshot.notes){const f=indexed.get(n.id);if(!f||f.path!==n.path||n.content!==''||(n as any).contentLoaded!==false)throw Error('Invalid workspace directory');}
  const changed=new Set(snapshot.notes.filter(n=>prior.get(n.id)?.recordHash!==indexed.get(n.id)?.recordHash).map(n=>n.id));
  snapshot.notes=await Promise.all(snapshot.notes.map(async n=>{
   const old=previous.get(n.id),f=indexed.get(n.id)!;
   if(!base?.structureOnly||!old||(old as any).contentLoaded===false)return n;
   if(!changed.has(n.id))return old;
   const full=await request('/workspace/files/'+encodeURIComponent(n.id)+'/content'+((n as any).deleted?'?deleted=true':''));
   if(full.id!==f.id||full.path!==f.path||full.rev!==(n as any).rev||full.deleted!==(n as any).deleted||contentFingerprint(full.content)!==f.contentHash)throw Error('Server file changed during synchronization; existing drafts retained');
   return {...full,history:[],contentLoaded:true};
  })) as T['notes'];
  const received=snapshot.notes.filter(n=>changed.has(n.id));
  return {base:{snapshot,index,structureOnly:true},received:received as T['notes']};
 }
 if(!base){const snapshot:T=await request('/snapshot');return {base:{snapshot,index:buildWorkspaceIndex(snapshot)},received:snapshot.notes};}
 let head:{revision:string};
 try{head=await request('/workspace/head');}catch(error){
  // Existing installations upgrade lazily; only an unsupported endpoint falls back.
  if((error as {status?:number}).status!==404)throw error;
  const snapshot:T=await request('/snapshot');return {base:{snapshot,index:buildWorkspaceIndex(snapshot)},received:snapshot.notes};
 }
 if(head.revision===base.index.revision)return {base,received:[] as unknown as T['notes']};
 const delta:WorkspaceDelta<T>=await request('/workspace/compare',{method:'POST',body:JSON.stringify({index:base.index})});
 const snapshot=applyWorkspaceDelta(base.snapshot,delta,base.index);
 return {base:{snapshot,index:delta.index},received:delta.notes};
}
