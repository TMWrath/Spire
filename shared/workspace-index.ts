import {z} from 'zod';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const workspaceIndexSchema=z.object({version:z.literal(1),revision:hash,structure:hash,metadata:hash,files:z.array(z.object({id:z.string().min(1).max(200),path:z.string().min(1).max(2000),contentHash:hash,recordHash:hash})).max(10000)}).refine(v=>new Set(v.files.map(f=>f.id)).size===v.files.length,'Duplicate file identities');

// Versioned wire contract for hosted and future client runtimes.
export type IndexedFile={id:string;path:string;contentHash:string;recordHash:string};
export type WorkspaceIndex={version:1;revision:string;structure:string;metadata:string;files:IndexedFile[]};
type FileRecord={id:string;path:string;content:string};
type Workspace={seq:number;notes:FileRecord[];folders:string[]};
export type WorkspaceDelta<T extends Workspace>={version:1;base:string|null;index:WorkspaceIndex;unchanged:boolean;notes:T['notes'];removed:string[];metadata:Omit<T,'notes'>};
function canonical(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
}
export const contentFingerprint=(content:string)=>bytesToHex(sha256(new TextEncoder().encode(content)));
const fingerprint=(value:unknown)=>contentFingerprint(canonical(value));
const order=(a:IndexedFile,b:IndexedFile)=>a.id<b.id?-1:a.id>b.id?1:0;
function finish(files:IndexedFile[],metadata:unknown,folders:string[]):WorkspaceIndex{
 const sorted=[...files].sort(order),structure=fingerprint({folders:[...folders].sort(),files:sorted.map(f=>({id:f.id,path:f.path}))}),meta=fingerprint(metadata);
 return {version:1,revision:fingerprint({version:1,structure,metadata:meta,files:sorted}),structure,metadata:meta,files:sorted};
}
export function buildWorkspaceIndex<T extends Workspace>(snapshot:T):WorkspaceIndex{
 const {notes,...metadata}=snapshot;
 if(new Set(notes.map(n=>n.id)).size!==notes.length)throw Error('Duplicate workspace file identity');
 return finish(notes.map(n=>({id:n.id,path:n.path,contentHash:contentFingerprint(n.content),recordHash:fingerprint(n)})),metadata,snapshot.folders);
}
export function compareWorkspace<T extends Workspace>(snapshot:T,base?:WorkspaceIndex):WorkspaceDelta<T>{
 const index=buildWorkspaceIndex(snapshot),old=new Map((base?.files??[]).map(f=>[f.id,f.recordHash])),ids=new Set(index.files.map(f=>f.id)),{notes,...metadata}=snapshot;
 const changed=new Set(index.files.filter(f=>old.get(f.id)!==f.recordHash).map(f=>f.id));
 return {version:1,base:base?.revision??null,index,unchanged:base?.revision===index.revision,notes:notes.filter(n=>changed.has(n.id)) as T['notes'],removed:(base?.files??[]).filter(f=>!ids.has(f.id)).map(f=>f.id),metadata};
}
export function applyWorkspaceDelta<T extends Workspace>(snapshot:T,delta:WorkspaceDelta<T>,cachedIndex=buildWorkspaceIndex(snapshot)):T{
 if(delta.version!==1||delta.base!==cachedIndex.revision)throw Error('Workspace delta base mismatch');
 const files=new Map(cachedIndex.files.map(f=>[f.id,f])),notes=new Map(snapshot.notes.map(n=>[n.id,n]));
 for(const id of delta.removed){files.delete(id);notes.delete(id);}
 for(const n of delta.notes){files.set(n.id,{id:n.id,path:n.path,contentHash:contentFingerprint(n.content),recordHash:fingerprint(n)});notes.set(n.id,n);}
 const verified=finish([...files.values()],delta.metadata,delta.metadata.folders);
 if(canonical(verified)!==canonical(delta.index))throw Error('Workspace delta integrity failure');
 // Preserve target order, even when only metadata/order changed.
 const ordered=delta.index.files.map(f=>notes.get(f.id));
 if(ordered.some(n=>!n))throw Error('Workspace delta missing cached file');
 return {...delta.metadata,notes:ordered} as T;
}
