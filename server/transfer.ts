import {z} from 'zod';
import {safePath,type Note,links,metadata} from '../shared/model.ts';
import {Store,HttpError} from './store.ts';
import {randomUUID} from 'node:crypto';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
const receiptKey=(b:WireBundle)=>bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(b))));

const fileSchema=z.object({path:safePath,kind:z.enum(['note','attachment','style','folder']),data:z.string().max(24_000_000),id:z.string().uuid().optional(),rev:z.number().int().nonnegative().optional()});
const bundleSchema=z.object({operation:z.string().uuid().optional(),path:safePath,version:z.string().max(2_000_000),files:z.array(fileSchema).min(1).max(10000)});
export type WireBundle=z.infer<typeof bundleSchema>;
/** Resolve only positively identified attachment references; never upload a local
 * directory implicitly. Root-relative, Markdown/wiki, HTML media and hero refs. */
export function referencedAttachments(note:Pick<Note,'path'|'content'>,paths:string[]):string[]{
 const targets=[...links(note.content).map(l=>l.target),...Array.from(note.content.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi),m=>m[1]),String(metadata(note.content).properties.hero??'')];
 return [...new Set(targets.flatMap(raw=>{let target=raw.replace(/&amp;/g,'&');try{target=decodeURIComponent(target);}catch{}if(!target||/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target))return [];if(target.startsWith('/api/attachment?')){target=new URL(target,'https://spire.invalid').searchParams.get('path')??'';}const parts=target.startsWith('/')?[]:note.path.split('/').slice(0,-1);for(const p of target.replace(/^\//,'').split('/')){if(p==='..'){if(!parts.length)return [];parts.pop();}else if(p!=='.')parts.push(p);}const exact=paths.find(p=>p===parts.join('/'))??paths.find(p=>p===target);if(exact)return [exact];const matches=paths.filter(p=>p.split('/').at(-1)===target);return matches.length===1?matches:[];}))];
}
export function readTransfer(store:Store,root:string,attachmentData?:Record<string,string>):WireBundle{
 safePath.parse(root);store.verify();const inside=(p:string)=>p===root||p.startsWith(root+'/');
 if(store.state.conflicts.some(c=>inside(c.mutation.path)))throw new HttpError(409,'Resolve conflicts before moving files');
 const notes=Object.values(store.state.notes).filter(n=>!n.deleted&&inside(n.path));
 const folders=(store.state.folders??[]).filter(inside);const paths=store.state.attachments.map(a=>a.path);
 const references=new Set(notes.flatMap(n=>referencedAttachments(n,paths)));
 const files:WireBundle['files']=[...folders.map(path=>({path,kind:'folder' as const,data:''})),...notes.map(n=>({path:n.path,kind:'note' as const,data:Buffer.from(n.content).toString('base64'),id:n.id,rev:n.rev})),...Object.entries(store.state.styles??{}).filter(([p])=>inside(p)||notes.some(n=>n.path.replace(/\.md$/i,'.css')===p)).map(([path,css])=>({path,kind:'style' as const,data:Buffer.from(css).toString('base64')})),...store.state.attachments.filter(a=>inside(a.path)||references.has(a.path)).map(a=>({path:a.path,kind:'attachment' as const,data:attachmentData?.[a.path]??a.data}))].sort((a,b)=>a.path.localeCompare(b.path));
 if(!files.some(f=>f.path===root))throw new HttpError(404,'Transfer source not found');
 if(files.reduce((total,f)=>total+Buffer.from(f.data,'base64').length,0)>16*1024*1024)throw new HttpError(413,'Move bundle exceeds 16 MiB; source retained');
 return {path:root,files,version:JSON.stringify(files.map(f=>[f.path,f.kind,f.id,f.rev]))};
}
function validate(input:unknown){const b=bundleSchema.parse(input);const seen=new Set<string>();let size=0;for(const f of b.files){const key=f.path.toLowerCase();if(seen.has(key))throw new HttpError(400,'Duplicate transfer path');seen.add(key);const bytes=Buffer.from(f.data,'base64');if(bytes.toString('base64')!==f.data)throw new HttpError(400,'Corrupt attachment encoding');size+=bytes.length;if(f.kind==='folder'&&f.data)throw new HttpError(400,'Invalid folder marker');if(f.kind==='note'&&!f.path.endsWith('.md')||f.kind==='style'&&!f.path.endsWith('.css'))throw new HttpError(400,'Invalid transfer file kind');if(f.kind==='note'&&bytes.length>1_000_000||f.kind==='attachment'&&bytes.length>10_000_000||f.kind==='style'&&bytes.length>100_000)throw new HttpError(413,'Transfer file exceeds limit');}if(size>16*1024*1024)throw new HttpError(413,'Transfer exceeds 16 MiB');if(!b.files.some(f=>f.path===b.path))throw new HttpError(400,'Missing transfer root');return b;}
export function createTransfer(store:Store,input:unknown,device:string){
 const b=validate(input);store.verify();const prior=b.operation?store.state.transferReceipts?.[b.operation]:undefined;
 if(prior){if(prior.phase!=='created'||prior.bundle!==receiptKey(b))throw new HttpError(409,'Transfer operation receipt differs');const current=readTransfer(store,b.path);const bytes=(files:WireBundle['files'])=>JSON.stringify(files.map(f=>[f.path,f.kind,f.data]));if(bytes(current.files)!==bytes(b.files))throw new HttpError(409,'Destination changed after transfer; source retained');return {acknowledged:true,operation:b.operation};}
 const next=structuredClone(store.state);
 for(const f of b.files){if(f.kind==='folder'){if(Object.values(store.state.notes).some(n=>!n.deleted&&(n.path===f.path||f.path.startsWith(n.path+'/')))||store.state.attachments.some(a=>a.path===f.path||f.path.startsWith(a.path+'/')))throw new HttpError(409,'Destination path occupied');if((store.state.folders??[]).includes(f.path)&&f.path===b.path)throw new HttpError(409,'Destination folder already exists');next.folders=[...new Set([...(next.folders??[]),f.path])];continue;}store.assertFree(f.path);}
 const occupied=b.files.filter(f=>f.kind!=='folder').map(f=>f.path.toLowerCase());for(const f of b.files)if(occupied.some(p=>f.path.toLowerCase().startsWith(p+'/')))throw new HttpError(409,'Transfer path collision');
 for(const f of b.files){const bytes=Buffer.from(f.data,'base64');if(f.kind==='note')store.revise(next,randomUUID(),{path:f.path,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes),deleted:false},device);else if(f.kind==='attachment')next.attachments.push({path:f.path,data:f.data});else if(f.kind==='style'){const css=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(/@import\b|url\s*\(/i.test(css))throw new HttpError(400,'Unsafe stylesheet');next.styles??={};next.styles[f.path]=css;}const parts=f.path.split('/').slice(0,-1);for(let i=1;i<=parts.length;i++)next.folders=[...new Set([...(next.folders??[]),parts.slice(0,i).join('/')])];}
 if(b.operation)next.transferReceipts={...next.transferReceipts,[b.operation]:{bundle:receiptKey(b),phase:'created'}};next.seq++;store.commit(next);store.verify();return {acknowledged:true,operation:b.operation};
}
export function removeTransfer(store:Store,input:unknown,device:string,attachmentData?:Record<string,string>){
 const b=validate(input);const prior=b.operation?store.state.transferReceipts?.[b.operation]:undefined;if(prior){if(prior.phase!=='removed'||prior.bundle!==receiptKey(b))throw new HttpError(409,'Transfer operation receipt differs');return {ok:true,retainedAttachments:b.files.filter(f=>f.kind==='attachment').map(f=>f.path)};}const now=readTransfer(store,b.path,attachmentData);
 if(now.version!==b.version||JSON.stringify(now.files)!==JSON.stringify(b.files))throw new HttpError(409,'Source changed; verified destination copy retained, source not removed');
 const inside=(p:string)=>p===b.path||p.startsWith(b.path+'/');const next=structuredClone(store.state);
 if(store.contentDirectory&&(store.state.folders??[]).includes(b.path))store.guardLocalFolder(b.path);
 for(const f of b.files)if(f.kind==='note'){const n=next.notes[f.id!];if(!n||n.rev!==f.rev)throw new HttpError(409,'Source changed');store.revise(next,n.id,{path:n.path,content:n.content,deleted:true},device);}else if(f.kind==='style')delete next.styles?.[f.path];
 // Linked media are copied but retained on the source, including for revision
 // history and other files. Never delete an attachment another file may use.
 // Nonempty source folders therefore remain visible and recoverable.
 next.folders=(next.folders??[]).filter(p=>!inside(p)||next.attachments.some(a=>a.path.startsWith(p+'/')));
 if(b.operation)next.transferReceipts={...next.transferReceipts,[b.operation]:{bundle:receiptKey(b),phase:'removed'}};store.commit(next);if(store.contentDirectory&&(store.state.folders??[]).includes(b.path))store.removeLocalEmptyFolder(b.path);
 return {ok:true,retainedAttachments:b.files.filter(f=>f.kind==='attachment').map(f=>f.path)};
}
