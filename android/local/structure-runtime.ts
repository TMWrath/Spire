import {Buffer} from 'buffer';
import {contentFingerprint} from '../vendor/shared/workspace-index';
import {emptyState,safePath} from '../vendor/shared/model';
import type {Storage,Tree} from './runtime';
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64');
const parse=(raw:string)=>JSON.parse(Buffer.from(raw,'base64').toString());
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const statePath='.spire-android/state.json';
const privatePath=(path:string)=>{if(!/^\.spire-android\/(?:notes-[0-9a-f]{2}(?:-\d+)?|content-[a-zA-Z0-9-]+|history-[a-zA-Z0-9-]+)\.json$/.test(path))throw Error('Invalid private record path');return path;};
/** Manual Local keeps only directory records at startup. Legacy buckets migrate one
 * touched record at a time; untouched pointers and generations are never rewritten.
 * The shared Store remains the mutation authority, using an operation-scoped view.
 * Unopened placeholders exist only in that transient view and cannot be persisted.
 */
export async function createStructureRuntime(storage:Storage,workspace:string,createRuntime:(s:Storage,w:string)=>Promise<any>){
 let disk:Tree=await storage.load(true),meta:any;
 const bodies=new Map<string,any>(),histories=new Set<string>();let queue=Promise.resolve(),builds=0;
 const identity={owner:workspace,username:'Local folder',csrf:'local-workspace',device:{id:workspace,name:'Android local folder'}};
 function metadata(tree:Tree){
  const raw=tree.files[statePath];if(typeof raw==='string'){const state=parse(raw);if(state.version!==1||!state.notes)throw Error('Unsupported private index');return state;}
  const state:any=emptyState();state.folders=tree.dirs.filter(p=>!p.startsWith('.'));
  for(const [path,entry] of Object.entries(tree.files))if(!path.startsWith('.')&&path.endsWith('.md')){
   const hash=contentFingerprint(workspace+'\0'+(typeof entry==='object'?entry.id:path)),id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
   state.notes[id]={id,path,rev:1,deleted:false,time:new Date(0).toISOString()};
  }else if(!path.startsWith('.')&&!path.endsWith('.css'))state.attachments.push({path,data:''});
  return state;
 }
 meta=metadata(disk);
 const listed=new Set<string>();
 async function list(path:string,initial?:Tree){
  if(!storage.list||listed.has(path))return;
  if(path)safePath.parse(path);
  const children=initial??await storage.list(path);
  const discovered=metadata({files:Object.fromEntries(Object.entries(children.files).filter(([p])=>!p.startsWith('.'))),dirs:children.dirs.filter(p=>!p.startsWith('.'))});
  // Merge only observed children. A partial listing never implies deletion.
  disk={...disk,files:{...disk.files,...children.files},dirs:[...new Set([...disk.dirs,...children.dirs])]};
  const paths=new Set(Object.values<any>(meta.notes).map(n=>n.path));
  for(const n of Object.values<any>(discovered.notes))if(!paths.has(n.path))meta.notes[n.id]=n;
  meta.folders=[...new Set([...(meta.folders??[]),...children.dirs])];
  const attachments=new Set((meta.attachments??[]).map((a:any)=>a.path));
  meta.attachments=[...(meta.attachments??[]),...discovered.attachments.filter((a:any)=>!attachments.has(a.path))];
  listed.add(path);
 }

 if(storage.list)await list('',disk);
 async function text(path:string){const raw=storage.readText?await storage.readText(path):disk.files[path];if(typeof raw!=='string')throw Error('File reader unavailable: '+path);return raw;}
 async function privateJSON(path:string){return parse(await text(privatePath(path)));}
 function descriptor(n:any){return {id:n.id,path:n.path,rev:n.rev,deleted:n.deleted,time:n.time,...(n.navigation?{navigation:n.navigation}:{}),...(n.templateIds?{templateIds:n.templateIds}:{})};}
 function noteView(n:any){const loaded=bodies.get(n.id);return {...descriptor(loaded??n),content:loaded?.content??'',history:[],contentLoaded:!!loaded};}
 function snapshot(){return {seq:meta.seq,notes:Object.values<any>(meta.notes).map(noteView),folders:meta.folders??[],styles:meta.styles??{},conflicts:meta.conflicts??[],attachments:(meta.attachments??[]).map((a:any)=>({path:a.path,size:typeof disk.files[a.path]==='object'?(disk.files[a.path] as any).size:typeof disk.files[a.path]==='string'?Buffer.from(disk.files[a.path] as string,'base64').length:0})),templates:meta.templates??[],sources:meta.sources??[],quickActions:meta.quickActions??[]};}
 async function legacy(n:any){
  if(typeof n.content==='string')return n;
  const path=n.bucketPath??(Number.isInteger(n.bucket)?`.spire-android/notes-${n.bucket.toString(16).padStart(2,'0')}.json`:null);
  if(!path)return null;
  const full=(await privateJSON(path)).notes?.[n.id];if(!full||typeof full.content!=='string'||!Array.isArray(full.history))throw Error('Private note metadata requires recovery; no files were changed.');return full;
 }
 async function open(id:string,deleted=false,force=false){
  const n=meta.notes[id];if(!n||n.deleted&&!deleted)throw Object.assign(Error('File unavailable'),{status:404});
  if(bodies.has(id))return bodies.get(id);
  let content:string;
  if(n.deleted){const record=n.contentPath?await privateJSON(n.contentPath):await legacy(n);if(!record)throw Error('Retained body unavailable');content=record.content;}
  else {const raw=await text(n.path);content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw,'base64'));if(content.length>1_000_000)throw Error('Markdown file exceeds supported size');disk.files[n.path]=raw;}
  const changed=n.contentHash&&n.contentHash!==contentFingerprint(content);
  const note={...descriptor(n),content,history:[],rev:n.rev+(changed?1:0)};bodies.set(id,note);return note;
 }
 async function history(id:string){
  const note=await open(id,true);if(histories.has(id))return note.history;
  const n=meta.notes[id],old=await legacy(n);
  const retained=n.historyPath?await privateJSON(n.historyPath):old?.history??[];
  if(!Array.isArray(retained))throw Error('Invalid retained history');
  let previous=old?.content;
  if(n.contentPath&&n.contentHash!==contentFingerprint(note.content))previous=(await privateJSON(n.contentPath)).content;
  note.history=[...retained];
  if(typeof previous==='string'&&previous!==note.content){note.rev=Math.max(note.rev,n.rev+1);note.history.push({...descriptor(n),content:previous});}
  histories.add(id);return note.history;
 }
 function synthetic(){
  const tree:Tree=structuredClone(disk),state=structuredClone(meta);delete tree.provisional;delete tree.recoveryPending;delete tree.files['.spire-android/pending.json'];
  state.notes=Object.fromEntries(Object.values<any>(meta.notes).map(n=>[n.id,bodies.has(n.id)?structuredClone(bodies.get(n.id)):{...descriptor(n),content:'',history:[]}]));
  for(const [path] of Object.entries(tree.files))if(path.startsWith('.spire-android/')&&path!==statePath)delete tree.files[path];
  for(const n of Object.values<any>(state.notes))if(!n.deleted)tree.files[n.path]=Buffer.from(n.content).toString('base64');
  for(const [path,css] of Object.entries<any>(state.styles??{}))tree.files[path]=Buffer.from(css).toString('base64');
  for(const path of Object.keys(tree.files))if(path.endsWith('.css')&&!Object.hasOwn(state.styles??{},path))delete tree.files[path];
  tree.files[statePath]=encode(state);return tree;
 }
 function expanded(tree:Tree){const state=parse(tree.files[statePath] as string);for(const [id,n] of Object.entries<any>(state.notes))if(typeof n.content!=='string'){const bucket=n.bucketPath??`.spire-android/notes-${n.bucket.toString(16).padStart(2,'0')}.json`;const full=parse(tree.files[bucket] as string).notes[id];if(!full)throw Error('Incomplete mutation view');state.notes[id]=full;}return state;}
 async function mutate(input:string,options:RequestInit){
  const view=synthetic();builds++;
  const inner=await createRuntime({manual:true,load:async()=>structuredClone(view),commit:async(before,after)=>{
   const state=expanded(after),prior=expanded(before),next:Tree=structuredClone(disk),compact=structuredClone(state);compact.notes={};
   const all=new Set([...Object.keys(before.files),...Object.keys(after.files)]);
   for(const path of all)if(!path.startsWith('.spire-android/')&&JSON.stringify(before.files[path])!==JSON.stringify(after.files[path])){
    if(Object.hasOwn(after.files,path))next.files[path]=after.files[path];else delete next.files[path];
   }
   next.dirs=[...after.dirs];
   for(const [id,n] of Object.entries<any>(state.notes)){
    const old=meta.notes[id],loaded=bodies.get(id);
    const changed=!old||n.rev!==old.rev||n.path!==old.path||n.deleted!==old.deleted||loaded&&n.content!==loaded.content;
    if(!changed){compact.notes[id]=structuredClone(old);continue;}
    if(old&&!loaded)throw Error('Unopened file cannot be rewritten by an unrelated operation');
    const token=crypto.randomUUID(),contentPath=`.spire-android/content-${token}.json`,historyPath=`.spire-android/history-${token}.json`;
    next.files[contentPath]=encode({id,content:n.content});next.files[historyPath]=encode(n.history);
    compact.notes[id]={...descriptor(n),contentPath,historyPath,contentHash:contentFingerprint(n.content)};
   }
   next.files[statePath]=encode(compact);
   await storage.commit(disk,next);disk=next;meta=compact;
   for(const [id,n] of Object.entries<any>(state.notes))if(bodies.has(id)||!Object.hasOwn(prior.notes,id)){bodies.set(id,n);if(!Object.hasOwn(prior.notes,id))histories.add(id);}
   for(const id of [...bodies.keys()])if(!meta.notes[id]){bodies.delete(id);histories.delete(id);}
  }},workspace);
  return inner.fetch(input,options);
 }
 // Binary insertion must not run through the synthetic document Store: that
 // expands/copies every attachment repeatedly before the provider sees any bytes.
 async function insertVideo(url:URL,options:RequestInit){
  const path=safePath.parse(url.searchParams.get('path'));
  if(!/^Attachments\/[^/]+\.(?:mp4|m4v|mov|webm|ogv|avi|mkv)$/i.test(path))return null;
  const lower=path.toLowerCase();
  const occupied=[...Object.keys(disk.files),...disk.dirs];
  if(occupied.some(p=>{const q=p.toLowerCase();return q===lower||q.startsWith(lower+'/')||lower.startsWith(q+'/')&&!disk.dirs.includes(p);} ))return json({error:'Attachment path is already occupied'},409);
  if((disk.warnings??[]).some(w=>lower===w.path.toLowerCase()||lower.startsWith(w.path.toLowerCase()+'/')))return json({error:'Attachment provider path is unavailable'},409);
  const source=options.body;
  if(!(source instanceof Blob)&&!(source instanceof ArrayBuffer)&&!ArrayBuffer.isView(source))return null;
  const size=source instanceof Blob?source.size:source.byteLength;
  if(size>32*1024*1024)return json({error:'This Local video insert supports videos up to 32 MiB. The original video is unchanged.'},413);
  const parts:string[]=[];
  // Multiples of three let independently encoded chunks concatenate exactly.
  for(let offset=0;offset<size;offset+=196608){
   const chunk=source instanceof Blob?new Uint8Array(await source.slice(offset,offset+196608).arrayBuffer()):source instanceof ArrayBuffer?new Uint8Array(source,offset,Math.min(196608,size-offset)):new Uint8Array(source.buffer,source.byteOffset+offset,Math.min(196608,size-offset));
   parts.push(Buffer.from(chunk).toString('base64'));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const next:Tree={...disk,files:{...disk.files},dirs:[...disk.dirs]},state={...meta,attachments:[...(meta.attachments??[]),{path,data:''}]};
  if(!next.dirs.includes('Attachments'))next.dirs.push('Attachments');
  next.files[path]=parts.join('');next.files[statePath]=encode(state);
  await storage.commit(disk,next);
  // The provider has acknowledged both metadata and media. Retain only its
  // opaque reference in RAM so subsequent note saves never copy video bytes.
  disk=next;meta=state;
  if(storage.reference){try{const ref=await storage.reference(path);if(ref.size===size)disk.files[path]=ref;}catch{/* A confirmed insert remains valid if optional cache compaction fails. */}}
  return json({path});
 }
 async function request(input:string|URL|Request,options:RequestInit={}){
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,'https://local.spire.invalid'),p=url.pathname,method=(options.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  if(p==='/api/attachments'&&method==='POST'){try{const inserted=await insertVideo(url,options);if(inserted)return inserted;}catch(error){return json({error:error instanceof Error?error.message:String(error)},503);}}
  const req=new Request(url,input instanceof Request?input:options);const payload=['GET','HEAD'].includes(method)?undefined:await req.arrayBuffer();
  const forward={...options,method,headers:req.headers,...(payload?{body:payload}:{} )};
  try{
   const body=payload&&req.headers.get('content-type')!=='application/octet-stream'&&req.headers.get('content-type')!=='application/zip'?JSON.parse(Buffer.from(payload).toString()||'{}'):{};
   if(p==='/api/attachment'&&method==='GET'){
    const path=safePath.parse(url.searchParams.get('path')),entry=disk.files[path];
    if(!(meta.attachments??[]).some((a:any)=>a.path===path)||!entry)return json({error:'Attachment not found'},404);
    if(typeof entry==='object'&&entry.size>32*1024*1024)return json({error:'Attachment exceeds the Local read limit'},413);
    const encoded=typeof entry==='string'?entry:storage.read?await storage.read(path,entry):null;
    if(encoded===null)return json({error:'Attachment reader unavailable'},503);
    const bytes=Buffer.from(encoded,'base64');if(typeof entry==='object'&&bytes.length!==entry.size)return json({error:'Attachment changed; reopen the workspace'},409);
    return new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}});
   }
   if(p==='/api/me'||p==='/api/login'||p==='/api/setup')return json(identity);
   if(p==='/api/health')return json({ok:true});
   if(p==='/api/bootstrap')return json({setup:false});
   if(p==='/api/local/list'&&method==='POST'){await list(body.path??'');return json(snapshot());}
   if(p==='/api/snapshot')return json(snapshot());
   if(p==='/api/events')return json((meta.events??[]).filter((e:any)=>e.seq>Number(url.searchParams.get('after')??0)));
   if(p==='/api/local/open'){
    const note=await open(body.id),css=note.path.replace(/\.md$/i,'.css');
    if(Object.hasOwn(disk.files,css))meta.styles={...meta.styles,[css]:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(await text(css),'base64'))};
    return json({...note,history:[],contentLoaded:true,styles:meta.styles??{}});
   }
   if(p==='/api/local/publication'&&method==='POST'){
    const notes=[];for(const n of Object.values<any>(meta.notes))notes.push({...await open(n.id,true),history:[],contentLoaded:true});
    return json({...snapshot(),notes});
   }
   const historyMatch=/^\/api\/workspace\/files\/([^/]+)\/history$/.exec(p);
   if(historyMatch&&method==='GET')return json(await history(decodeURIComponent(historyMatch[1])));
   if(p==='/api/local/refresh'&&method==='POST'){const fresh=await storage.load();const state=metadata(fresh);disk=fresh;meta=state;listed.clear();listed.add('');bodies.clear();histories.clear();return json({warnings:disk.warnings??[]});}
   if(p==='/api/local/recovery')return json({items:[]});
   if(p==='/api/local/reconcile')return json({error:'Automatic recovery is disabled in manual Local mode'},403);
   // Body access outside navigation is explicit: a selected mutation/history or
   // an intentional bulk search, export, import, move, or transfer operation.
   const bulk=/^\/api\/(?:export|search|transfers(?:\/remove)?|import|folders\/(?:move|rename))$/.test(p)||(p==='/api/folders'&&method==='DELETE');
   const conflict=/^\/api\/conflicts\/([^/]+)\/resolve$/.exec(p),conflictId=conflict?(meta.conflicts??[]).find((c:any)=>c.id===conflict[1])?.mutation.id:undefined;
   const target=body.id??(/^\/api\/(?:restore|trash)\/([^/]+)/.exec(p)?.[1])??conflictId;
   if(bulk)for(const n of Object.values<any>(meta.notes))await history(n.id);
   else if(target&&meta.notes[target])await history(target);
   const response=await mutate(url.href,forward);
   // Do not let mutation-generated full snapshots masquerade as a startup cache.
   return response;
  }catch(error){return json({error:error instanceof Error?error.message:String(error)},(error as any).status??503);}
 }
 return {identity,get warnings(){return disk.warnings??[];},reconciled:Promise.resolve(),get diagnostics(){return {indexBuilds:builds,provisional:!!disk.provisional,authoritative:true,structureOnly:true,loadedFiles:bodies.size};},fetch:(input:string|URL|Request,options?:RequestInit)=>{const result=queue.then(()=>request(input,options));queue=result.then(()=>{},()=>{});return result;}};
}
