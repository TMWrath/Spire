import {Buffer} from 'buffer';
import {createStructureRuntime} from './structure-runtime';
import {buildWorkspaceIndex,compareWorkspace,workspaceIndexSchema} from '../vendor/shared/workspace-index';
import {Store,HttpError} from '../vendor/server/store';
import {useManualCommits} from './manual-store';
import {readTransfer,createTransfer,removeTransfer} from '../vendor/server/transfer';
import {unpack,exportVault} from '../vendor/server/archive';
import {safePath,templateInputSchema} from '../vendor/shared/model';
import {sourceInputSchema} from '../vendor/shared/sources';
import {quickActionInputSchema} from '../vendor/shared/quick-actions';
import {z} from 'zod';
import * as memory from './fs.js';

type Reference={kind:'saf';id:string;size:number;modified:number};
export type Tree={files:Record<string,string|Reference>;dirs:string[];warnings?:Array<{path:string;kind:string;message:string}>;provisional?:boolean;recoveryPending?:boolean};
export type Storage={manual?:boolean;structureOnly?:boolean;list?:(path:string)=>Promise<Tree>;load:(indexed?:boolean)=>Promise<Tree>;readText?:(path:string)=>Promise<string>;reference?:(path:string)=>Promise<Reference>;read?:(path:string,ref:Reference)=>Promise<string>;commit:(before:Tree,after:Tree)=>Promise<void>};
export const localIdentity=(workspace:string)=>({owner:workspace,username:'Local folder',csrf:'local-workspace',device:{id:workspace,name:'Android local folder'}});
const integer=(x:unknown)=>z.coerce.number().int().nonnegative().parse(x);
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const bucketCount=16;
const bucketFor=(id:string)=>{let value=2166136261;for(const c of id)value=Math.imul(value^c.charCodeAt(0),16777619);return (value>>>0)%bucketCount;};
const bucketPath=(bucket:number)=>`.spire-android/notes-${bucket.toString(16).padStart(2,'0')}.json`;
const parseFile=(tree:Tree,path:string)=>{const raw=tree.files[path];return typeof raw==='string'?JSON.parse(Buffer.from(raw,'base64').toString()):null;};
// state.json remains the small transaction/index record. Full note records live in
// stable buckets, so an ordinary save rewrites one bounded bucket rather than every
// file's current text and history. Legacy inline records are accepted transparently.
function durableState(tree:Tree){
 const state=parseFile(tree,'.spire-android/state.json');if(!state)return state;
 const buckets=new Map<string,any>();
 for(const [id,n] of Object.entries<any>(state.notes??{}))if(typeof n.content!=='string'){
  const bucket=Number.isInteger(n.bucket)?n.bucket:bucketFor(id),path=typeof n.bucketPath==='string'?n.bucketPath:bucketPath(bucket);
  let records=buckets.get(path);if(!records){records=parseFile(tree,path)?.notes??{};buckets.set(path,records);}
  const full=records[id];if(!full||typeof full.content!=='string'||!Array.isArray(full.history))throw Error('Private note metadata requires recovery; no files were changed.');
  const {bucket:storedBucket,bucketPath:storedPath,...record}={...n,...full};
  state.notes[id]=record;
 }
 return state;
}
function writeDurableState(state:any,before:Tree,after:Tree,changed:{files:Set<string>,dirs:Set<string>}){
 const previous=durableState(before),legacy=Object.values<any>(parseFile(before,'.spire-android/state.json')?.notes??{}).some(n=>typeof n.content==='string');
 const affected=new Set<number>(),paths=new Map<number,string>();
 for(const [id,n] of Object.entries<any>(state.notes??{})){const old=previous?.notes?.[id];if(legacy||!old||old.rev!==n.rev||old.path!==n.path||old.deleted!==n.deleted)affected.add(bucketFor(id));}
 for(const id of Object.keys(previous?.notes??{}))if(!state.notes[id])affected.add(bucketFor(id));
 for(let bucket=0;bucket<bucketCount;bucket++){
  const prior=Object.entries<any>(parseFile(before,'.spire-android/state.json')?.notes??{}).find(([id,n])=>bucketFor(id)===bucket&&typeof n.bucketPath==='string');
  if(prior)paths.set(bucket,prior[1].bucketPath);
 }
 for(const bucket of affected){const notes=Object.fromEntries(Object.entries<any>(state.notes??{}).filter(([id])=>bucketFor(id)===bucket));const path=`.spire-android/notes-${bucket.toString(16).padStart(2,'0')}-${state.seq??0}.json`;after.files[path]=Buffer.from(JSON.stringify({version:1,notes})).toString('base64');changed.files.add(path);paths.set(bucket,path);}
 const compact=structuredClone(state);
 compact.notes=Object.fromEntries(Object.entries<any>(state.notes??{}).map(([id,n])=>{const {content,history,...metadata}=n,bucket=bucketFor(id);return [id,{...metadata,bucket,bucketPath:paths.get(bucket)}];}));
 // Delete only generations that neither the currently acknowledged index nor the
 // next index references. The just-replaced generation survives until a later
 // confirmed transaction, so a crash before the state.json switch is recoverable.
 const oldReferences=new Set(Object.values<any>(parseFile(before,'.spire-android/state.json')?.notes??{}).map(n=>n.bucketPath).filter(Boolean));
 const nextReferences=new Set(Object.values<any>(compact.notes).map(n=>n.bucketPath).filter(Boolean));
 for(const path of Object.keys(after.files))if(affected.size&&/^\.spire-android\/notes-[0-9a-f]{2}-\d+\.json$/.test(path)&&!oldReferences.has(path)&&!nextReferences.has(path)){delete after.files[path];changed.files.add(path);}
 after.files['.spire-android/state.json']=Buffer.from(JSON.stringify(compact)).toString('base64');changed.files.add('.spire-android/state.json');
}
export async function createLocalRuntime(storage:Storage,workspace:string){
 if(storage.manual&&storage.structureOnly)return createStructureRuntime(storage,workspace,createLocalRuntime);
 const memoryOwner={};
 let disk=await storage.load(true),poisoned=false,queue=Promise.resolve();
 const provisional=disk.provisional===true;let recoveryPending=disk.recoveryPending===true;delete disk.provisional;delete disk.recoveryPending;
 const identity=localIdentity(workspace);
 const attachmentSizeCache=new Map<string,{data:string,size:number}>();
 const attachmentSummaries=(state:any)=>state.attachments.map((a:any)=>{const ref=disk.files[a.path];if(ref&&typeof ref==='object')return {path:a.path,size:(ref as Reference).size};const cached=attachmentSizeCache.get(a.path);if(cached?.data===a.data)return {path:a.path,size:cached.size};const size=Buffer.from(a.data,'base64').length;attachmentSizeCache.set(a.path,{data:a.data,size});return {path:a.path,size};});
 const warnings:Array<{path:string;kind:string;message:string}>=[...(disk.warnings??[])];
 let unavailable:any=null;
 const absent=(p:string)=>!Object.hasOwn(disk.files,p);
 const hasUnavailable=()=>unavailable&&(Object.keys(unavailable.notes).length||unavailable.folders.length||Object.keys(unavailable.styles).length||unavailable.attachments.length);
 const sameEntry=(a:any,b:any)=>a===b||(a&&b&&typeof a==='object'&&typeof b==='object'&&a.kind===b.kind&&a.id===b.id&&a.size===b.size&&a.modified===b.modified);
 // Keep unavailable records in durable metadata, but exclude them from the active Store.
 // This is a view, not a deletion or an implicit restore from cached content.
 function project(state:any){
  unavailable={notes:{},folders:[],styles:{},attachments:[]};warnings.splice(0,warnings.length,...(disk.warnings??[]));
  const warn=(path:string,kind:string)=>warnings.push({path,kind,message:`Unavailable ${kind} skipped. Other files remain usable; retained metadata was not deleted.`});
  for(const [id,n] of Object.entries<any>(state.notes??{}))if(!n.deleted){
   const bytes=disk.files[n.path];
   const changed=typeof bytes==='string'&&Buffer.from(bytes,'base64').toString()!==n.content;
   if(absent(n.path)||changed){
    unavailable.notes[id]=structuredClone(n);
    if(absent(n.path)){delete state.notes[id];if(blockedByProvider(disk,n.path))warn(n.path,'file');}
    else if(blockedByProvider(disk,n.path)){delete state.notes[id];warn(n.path,'file');}
    else {
     const {history,...previous}=n;
     n.history=[...(history??[]),previous];
     n.content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(bytes as string,'base64'));
     n.rev++; // Invalidate edits based on the cached version, regardless of timestamps.
    }
   }
  }
  state.folders=(state.folders??[]).filter((p:string)=>{if(disk.dirs.includes(p))return true;unavailable.folders.push(p);if(blockedByProvider(disk,p))warn(p,'folder');return false;});
  for(const [p,v] of Object.entries(state.styles??{}))if(absent(p)){unavailable.styles[p]=v;delete state.styles[p];if(blockedByProvider(disk,p))warn(p,'stylesheet');}
  state.attachments=(state.attachments??[]).filter((a:any)=>{if(!absent(a.path))return true;unavailable.attachments.push(a);if(blockedByProvider(disk,a.path))warn(a.path,'attachment');return false;});
 }
 function retain(state:any){
  if(!hasUnavailable())return;
  for(const [id,n] of Object.entries(unavailable.notes))if(!state.notes[id])state.notes[id]=n;
  Object.assign(state.styles??(state.styles={}),unavailable.styles);
  state.folders=[...new Set([...(state.folders??[]),...unavailable.folders])];
  state.attachments=[...(state.attachments??[]),...unavailable.attachments];
 }
 // Migrate private metadata to opaque references without ever materializing media.
 // Native recovery finishes before load returns, so a pending journal is never reinterpreted.
 function mount(){const view=structuredClone(disk);if(storage.manual)delete view.files['.spire-android/pending.json'];if(view.files['.spire-android/state.json']){const state=durableState(view);project(state);for(const a of state.attachments??[]){const ref=view.files[a.path];if(ref&&typeof ref!=='string')a.data=memory.referenceBytes(ref).toString('base64');}view.files['.spire-android/state.json']=Buffer.from(JSON.stringify(state)).toString('base64');}memory.load(view,memoryOwner);}
 async function attachment(a:{path:string,data:string}){const ref=disk.files[a.path];if(!ref||typeof ref==='string')return Buffer.from(a.data,'base64');if(!storage.read)throw new HttpError(503,'Attachment reader unavailable');if(ref.size>32*1024*1024)throw new HttpError(413,'Attachment download exceeds 32 MiB; open the original file using Android.');const bytes=Buffer.from(await storage.read(a.path,ref),'base64');if(bytes.length!==ref.size)throw new HttpError(409,'Attachment changed; reopen the workspace');return bytes;}
 async function persist(before:Tree){const changed=memory.changes(),after=memory.dump(before);after.warnings=disk.warnings;
  if(storage.manual){
   const raw=after.files['.spire-android/state.json'];
   const state=typeof raw==='string'?JSON.parse(Buffer.from(raw,'base64').toString()):null;
   const movedReferences=[...changed.files].filter(path=>typeof after.files[path]==='object'&&!sameEntry(before.files[path],after.files[path]));
   if(movedReferences.length){
    const referencesById=new Map(Object.entries(before.files).flatMap(([p,v])=>typeof v==='string'?[]:[[v.id,p]]));
    for(const path of movedReferences){const entry=after.files[path] as Reference;
     const sourcePath=referencesById.get(entry.id),source=sourcePath&&[sourcePath,before.files[sourcePath]];
     if(!source||!storage.read)throw Error('Attachment source unavailable; no move performed');
     const bytes=await storage.read(source[0],entry);after.files[path]=bytes;
     const attachment=state?.attachments?.find((a:any)=>a.path===path);if(attachment)attachment.data=bytes;
    }
   }
   if(state){retain(state);writeDurableState(state,before,after,changed);}
  }
  const beforeDirs=new Set(before.dirs),changedPaths=new Set([...changed.files,...changed.dirs]);
  for(const p of changedPaths)if(!Object.hasOwn(before.files,p)&&!beforeDirs.has(p)&&warnings.some(w=>p===w.path||p.startsWith(w.path+'/')))throw new HttpError(409,'Unavailable paths cannot be recreated by another action');
  if(!storage.manual){const state=durableState(after);retain(state);writeDurableState(state,before,after,changed);}if(treeChanged(before,after,changed)){await storage.commit(before,after);disk=after;if(storage.manual){
   // The live Store already holds the acknowledged mutation. Keep history retention
   // consistent without reparsing/reindexing every unrelated workspace file.
   const saved=durableState(after);
   for(const [id,n] of Object.entries(currentStore.state.notes))n.history=saved.notes[id]?.history??n.history;
   memory.acknowledge(after);
   for(const a of currentStore.state.attachments){const ref=after.files[a.path];if(ref&&typeof ref!=='string')a.data=memory.referenceBytes(ref).toString('base64');}
  }}}
 let indexBuilds=0;
 const buildIndex=()=>{indexBuilds++;const store=new Store('/workspace/.spire-android',{contentDirectory:'/workspace'});return storage.manual?useManualCommits(store):store;};
 mount();let currentStore=buildIndex();
 // Opening an indexed workspace is read-only. Rewriting unchanged private
 // metadata would trigger several complete SAF verification scans at startup.
 if(!disk.files['.spire-android/state.json'])await persist(disk);
 // A preview is scoped to this runtime/workspace and an exact verified tree.
 // It is not a permission to choose a version later after anything has changed.
 const previews=new Map<string,{id:string;generation:string;time:number}>();
 function generation(tree:Tree){return JSON.stringify({files:Object.keys(tree.files).sort().map(p=>{const v=tree.files[p];return [p,typeof v==='string'?v:{kind:v.kind,id:v.id,size:v.size,modified:v.modified}];}),dirs:[...tree.dirs].sort(),warnings:tree.warnings??[]});}
 function treeChanged(before:Tree,after:Tree,changed:{files:Set<string>,dirs:Set<string>}){
  for(const p of changed.files)if(!sameEntry(before.files[p],after.files[p]))return true;
  if(changed.dirs.size){const beforeDirs=new Set(before.dirs),afterDirs=new Set(after.dirs);for(const p of changed.dirs)if(beforeDirs.has(p)!==afterDirs.has(p))return true;}
  return false;
 }
 const stateOf=(tree:Tree)=>{const raw=tree.files['.spire-android/state.json'];if(typeof raw!=='string'||(!storage.manual&&tree.files['.spire-android/pending.json']))throw Error('Private metadata requires recovery; no files were changed.');return durableState(tree);};
 function blockedByProvider(tree:Tree,p:string){return (tree.warnings??[]).some(w=>w.path===p||p.startsWith(w.path+'/')||w.path.startsWith(p+'/'));}
 const parentPresent=(tree:Tree,p:string)=>{const parts=p.split('/');parts.pop();while(parts.length){if(!tree.dirs.includes(parts.join('/')))return false;parts.pop();}return true;};
 function recoveryItems(){
  const key=generation(disk);
  return Object.values<any>(unavailable?.notes??{}).map(n=>{
   const raw=disk.files[n.path],external=typeof raw==='string'?new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw,'base64')):null;
   const token=crypto.randomUUID();previews.set(token,{id:n.id,generation:key,time:Date.now()});
   while(previews.size>64)previews.delete(previews.keys().next().value!);
   return {id:n.id,path:n.path,retained:n.content,external,history:n.history,token,canRestore:parentPresent(disk,n.path)&&!blockedByProvider(disk,n.path),canAdopt:external!==null&&!blockedByProvider(disk,n.path)};
  });
 }
 async function refresh(){
  const fresh=await storage.load(),pending=storage.manual?false:fresh.recoveryPending===true;delete fresh.recoveryPending;if(storage.manual)durableState(fresh);else stateOf(fresh);
  const previous=disk;disk=fresh;
  try{mount();currentStore=buildIndex();previews.clear();recoveryPending=pending;}catch(e){disk=previous;mount();currentStore=buildIndex();throw e;}
  // Read-only rescan: never persist, restore missing bytes, or import external edits.
  if(recoveryPending&&!storage.manual)throw Error('Recovery is still pending. Review it before saving workspace changes.');
 }
 let authoritative=storage.manual||!provisional&&!recoveryPending,reconciliationError:unknown=recoveryPending?Error('Recovery is still pending. Review it before saving workspace changes.'):undefined;
 // Manual Local reads its cached index immediately. Native operations validate
 // only affected provider paths, so a legacy journal or full-folder scan must
 // not globally disable ordinary Local mutations. Refresh is explicit.
 const reconciled=storage.manual?Promise.resolve():provisional?refresh().then(()=>{authoritative=true;},error=>{reconciliationError=error;}):Promise.resolve();
 async function reconcile(body:any){
  if(!['adopt','restore'].includes(body.action)||typeof body.token!=='string')return json({error:'Choose an explicit recovery action'},400);
  const preview=previews.get(body.token);
  if(!preview||Date.now()-preview.time>300000)return json({error:'Recovery preview expired. Refresh and compare again.'},409);
  let fresh:Tree,state:any;
  try{fresh=await storage.load();state=stateOf(fresh);}catch{return json({error:'Folder access or metadata unavailable. Originals remain unchanged.'},503);}
  if(generation(fresh)!==preview.generation||generation(disk)!==preview.generation)return json({error:'The workspace changed after this preview. Refresh and compare again; no version was selected.'},409);
  const note=state.notes?.[preview.id];
  if(!note||note.deleted||!unavailable?.notes[note.id])return json({error:'This file no longer needs this recovery preview'},409);
  const p=safePath.parse(note.path),raw=fresh.files[p];
  if(blockedByProvider(fresh,p)||!parentPresent(fresh,p)||raw!==undefined&&typeof raw!=='string')return json({error:'Restore folder/provider access first. Unavailable items cannot be recreated.'},409);
  if(body.action==='adopt'&&typeof raw!=='string')return json({error:'No readable external file to adopt'},409);
  let external:string|undefined;try{if(typeof raw==='string')external=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw,'base64'));}catch{return json({error:'File is not valid UTF-8. Original bytes retained.'},409);}
  if(external!==undefined&&external.length>1000000)return json({error:'External file exceeds supported writing size; originals retained.'},413);
  const after=structuredClone(fresh),time=new Date().toISOString();
  const {history:oldHistory,...old}=note;
  const history=[...oldHistory,old];let rev=note.rev+1;
  // Restoring the retained version must first preserve the displaced external text.
  if(body.action==='restore'&&external!==undefined){history.push({...old,content:external,rev:rev++,time});}
  const next={...note,content:body.action==='adopt'?external:note.content,history,rev,time};state.notes[note.id]=next;
  state.events.push({seq:++state.seq,id:note.id,rev,device:workspace,time});
  after.files[p]=Buffer.from(next.content).toString('base64');
  const changed={files:new Set<string>(),dirs:new Set<string>()};writeDurableState(state,fresh,after,changed);
  try{await storage.commit(fresh,after);}catch{poisoned=true;return json({error:'Recovery save was not acknowledged. Both versions remain in metadata or the durable recovery journal. Reopen to recover.'},503);}
  disk=after;previews.clear();mount();currentStore=buildIndex();return json({ok:true,path:p,action:body.action,warnings});
 }
 async function request(input:string|URL|Request,options:RequestInit={}){
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,'https://local.spire.invalid');
  // A failed mutation must not disable unrelated file reads. All mutation and
  // export routes remain fail-closed until explicit recovery.
  const method=(options.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  const safeRead=(url.pathname==='/api/local/open'&&method==='POST')||(['GET','HEAD'].includes(method)&&['/api/snapshot','/api/events','/api/me','/api/health'].includes(url.pathname));
  if(poisoned&&!safeRead)return json({error:'Local folder requires recovery. Your queued changes are retained. Review recovery before changing files.'},503);
  // Cached startup is navigation-only. Mutations wait for the background provider
  // reconciliation and remain blocked if that authority check fails.
  if(!['GET','HEAD'].includes(method)&&url.pathname!=='/api/local/open'){
   await reconciled;
   if(!authoritative)return json({error:'Folder verification did not complete. Cached files remain readable, but changes are blocked until Android folder access is restored. '+(reconciliationError instanceof Error?reconciliationError.message:'')},503);
  }
  const req=new Request(url,input instanceof Request?input:options);
  const bytes=method==='GET'||method==='HEAD'?Buffer.alloc(0):Buffer.from(await req.arrayBuffer());
  let body:any={};
  try{if(bytes.length&&!['application/octet-stream','application/zip'].includes(req.headers.get('content-type')??'')&&!url.pathname.match(/^\/api\/(attachments|import|video\/capture)$/))body=JSON.parse(bytes.toString());}catch{return json({error:'Invalid JSON'},400);}
  const p=url.pathname,q=url.searchParams;
  const workspaceSnapshot=()=>({seq:currentStore.state.seq,notes:Object.values(currentStore.state.notes),folders:currentStore.state.folders??[],styles:currentStore.state.styles??{},conflicts:currentStore.state.conflicts,attachments:attachmentSummaries(currentStore.state),templates:currentStore.state.templates??[],sources:currentStore.state.sources??[],quickActions:currentStore.state.quickActions??[]});
  if(p==='/api/workspace/head'&&method==='GET')return json({version:1,revision:buildWorkspaceIndex(workspaceSnapshot()).revision});
  if(p==='/api/workspace/index'&&method==='GET')return json(buildWorkspaceIndex(workspaceSnapshot()));
  if(p==='/api/workspace/compare'&&method==='POST'){try{return json(compareWorkspace(workspaceSnapshot(),workspaceIndexSchema.parse(body.index)));}catch{return json({error:'Invalid workspace baseline'},400);}}
  if(p==='/api/local/open'&&method==='POST'){
   try{
    const note=currentStore.state.notes[body.id];if(!note||note.deleted)return json({error:'File unavailable'},404);
    if(storage.readText){const raw=await storage.readText(note.path);if(raw!==disk.files[note.path]){
     const content=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw,'base64'));
     if(content.length>1000000)throw Error('Markdown file exceeds supported size');
     disk.files[note.path]=raw;
     if(storage.manual){
      if(content!==note.content){const {history,...previous}=note;currentStore.state.notes[note.id]={...note,content,rev:note.rev+1,history:[...history,previous]};currentStore.state.seq++;}
      if(memory.owner!==memoryOwner)mount();else memory.default.writeFileSync('/workspace/'+note.path,Buffer.from(raw,'base64'));
     }else{mount();currentStore=buildIndex();}
    }}
    return json(currentStore.state.notes[body.id]);
   }catch(e){return json({error:e.message},503);}
  }
  if(p==='/api/local/refresh'&&method==='POST'){
   try{await refresh();return json({warnings});}catch(e){return json({error:e.message},503);}
  }
  if(p==='/api/local/recovery'&&method==='GET')return json({items:storage.manual?[]:recoveryItems()});
  if(p==='/api/local/reconcile'&&method==='POST')return storage.manual?json({error:'Automatic recovery is disabled in manual Local mode'},403):reconcile(body);
  if(warnings.length&&(p==='/api/export'||p==='/api/transfers'&&method==='GET'&&warnings.some(w=>{const target=q.get('path')??'';return w.path===target||w.path.startsWith(target+'/')||target.startsWith(w.path+'/');})))return json({error:'Export or transfer includes unavailable items. Restore access and reopen the workspace first; no files were changed.'},409);
  // Polling reads consume the last verified in-memory index. Writes still rebuild
  // and native commits still validate source bytes before acknowledging a save.
  if(method==='GET'){
   if(p==='/api/snapshot')return json({...currentStore.state,notes:Object.values(currentStore.state.notes),attachments:attachmentSummaries(currentStore.state)});
   if(p==='/api/events')return json(currentStore.state.events.filter(e=>e.seq>integer(q.get('after')??0)));
  }
  if(method==='GET'&&(p==='/api/transfers'||p==='/api/export'))mount();
  let store:Store=currentStore;if(!['GET','HEAD'].includes(method)){
   if(storage.manual){if(memory.owner!==memoryOwner)mount();}
   else{mount();try{store=buildIndex();currentStore=store;}catch{return json({error:'Local folder storage requires recovery'},503);}}
  }
  const deltaBefore=storage.manual&&q.get('localDelta')==='1'?store.state:null;
  // Never let a write resurrect a skipped path or overwrite its retained record.
  if(!['GET','HEAD'].includes(method)){
   const paths=[body.path,body.destination,q.get('path'),body.folder,...(body.files??[]).map((f:any)=>f.path)].filter((p:any)=>typeof p==='string');
   const id=p.split('/')[3];
   if((unavailable?.notes[body.id??id]&&!store.state.notes[body.id??id])||paths.some((target:string)=>warnings.some(w=>target===w.path||target.startsWith(w.path+'/')||w.path.startsWith(target+'/'))))return json({error:'This path is unavailable and was skipped. Reopen the workspace after restoring access; retained data is unchanged.'},409);
  }
  let value:any={ok:true},status=200,failure:any;
  try{
   if(p==='/api/health')value={ok:!store.poisoned};
   else if(p==='/api/bootstrap')value={setup:false};
   else if(['/api/me','/api/login','/api/setup'].includes(p))value=identity;
   else if(p==='/api/logout')value={ok:true};
   else if(p==='/api/devices'&&method==='GET')value=[{...identity.device,created:new Date().toISOString(),revoked:false}];
   else if(p==='/api/reliquary')value={directory:'Selected Android folder',base:'On this device'};
   else if(p==='/api/reliquary/migrate')throw new HttpError(400,'Use the Android workspace chooser to select a different folder.');
   else if(p==='/api/snapshot')value={...store.state,notes:Object.values(store.state.notes),attachments:attachmentSummaries(store.state)};
   else if(p==='/api/events')value=store.state.events.filter(e=>e.seq>integer(q.get('after')??0));
   else if(p==='/api/search'){const text=(q.get('q')??'').toLowerCase();value=Object.values(store.state.notes).filter(n=>!n.deleted&&(n.path+'\n'+n.content).toLowerCase().includes(text)).map(n=>({id:n.id,path:n.path}));}
   else if(p==='/api/transfers'&&method==='GET'||p==='/api/transfers/remove'&&method==='POST'){
    const root=safePath.parse(method==='GET'?q.get('path'):body.path),bundle=readTransfer(store,root),data:Record<string,string>={};let total=0;
    for(const f of bundle.files)if(f.kind==='attachment'){const a=store.state.attachments.find(a=>a.path===f.path)!;const ref=disk.files[a.path];total+=ref&&typeof ref!=='string'?ref.size:Buffer.from(a.data,'base64').length;if(total>16*1024*1024)throw new HttpError(413,'Move bundle exceeds 16 MiB; source retained');data[a.path]=(await attachment(a)).toString('base64');}
    value=method==='GET'?readTransfer(store,root,data):removeTransfer(store,body,workspace,data);
   }
   else if(p==='/api/transfers'&&method==='POST')value=createTransfer(store,body,workspace);
   else if(p==='/api/workspace/fields'&&method==='POST')value=store.updateWorkspaceFields(body);
   else if(p==='/api/mutate'&&method==='POST')value=store.mutate(body,workspace);
   else if(p==='/api/folders'&&method==='POST'){value=store.createFolder(safePath.parse(body.path));status=201;}
   else if(p==='/api/folders/move'&&method==='POST')value=store.moveFolder(safePath.parse(body.path),safePath.parse(body.destination),workspace);
   else if(p==='/api/folders/rename'&&method==='POST'){const path=safePath.parse(body.path);value=store.moveFolder(path,path.split('/').slice(0,-1).join('/'),workspace,safePath.parse(body.name));}
   else if(p==='/api/folders'&&method==='DELETE'){const action=z.discriminatedUnion('mode',[z.object({mode:z.literal('empty')}),z.object({mode:z.literal('trash')}),z.object({mode:z.literal('reassign'),destination:safePath})]).parse(body);value=store.deleteFolder(safePath.parse(body.path),action,workspace);}
   else if(p==='/api/styles'&&method==='PUT')value=store.putStyle(safePath.parse(body.path),z.string().max(100000).parse(body.content));
   else if(p==='/api/templates'&&method==='POST'){value=store.saveTemplate(templateInputSchema.parse(body));status=201;}
   else if(p.startsWith('/api/templates/')&&method==='PUT')value=store.updateTemplate(p.split('/')[3],templateInputSchema.parse(body),z.string().parse(body.expectedContent));
   else if(p==='/api/sources'&&method==='POST'){value=store.saveSource(sourceInputSchema.parse(body));status=201;}
   else if(p.startsWith('/api/sources/')&&method==='PUT')value=store.saveSource(sourceInputSchema.parse(body),p.split('/')[3],integer(body.expectedRevision));
   else if(p.startsWith('/api/sources/')&&method==='DELETE')value=store.deleteSource(p.split('/')[3],integer(q.get('revision')));
   else if(p==='/api/quick-actions'&&method==='POST'){value=store.saveQuickAction(quickActionInputSchema.parse(body));status=201;}
   else if(p==='/api/quick-actions/order'&&method==='PUT')value=store.reorderQuickActions(z.array(z.string().uuid()).parse(body.ids),z.array(z.string().uuid()).parse(body.expected));
   else if(/^\/api\/quick-actions\/[^/]+\/activate$/.test(p)&&method==='POST')value=store.activateQuickAction(p.split('/')[3],z.string().uuid().parse(body.op),workspace);
   else if(p.startsWith('/api/quick-actions/')&&method==='PUT')value=store.saveQuickAction(quickActionInputSchema.parse(body),p.split('/')[3],integer(body.revision));
   else if(p.startsWith('/api/quick-actions/')&&method==='DELETE')value=store.deleteQuickAction(p.split('/')[3],integer(q.get('revision')));
   else if(p.startsWith('/api/restore/')&&method==='POST'){const n=store.state.notes[p.split('/')[3]];if(!n)throw new HttpError(404,'File not found');const revision=[...n.history,n].find(h=>h.rev===integer(body.rev));if(!revision)throw new HttpError(404,'Revision not found');value=store.mutate({...revision,id:n.id,base:integer(body.base),op:z.string().uuid().parse(body.op),deleted:false},workspace);}
   else if(p.startsWith('/api/trash/')&&method==='DELETE')value=store.purge(p.split('/')[3],integer(q.get('base')),workspace);
   else if(/^\/api\/conflicts\/[^/]+\/resolve$/.test(p)&&method==='POST'){
    const id=p.split('/')[3];
    value=store.resolveConflict(id,z.object({
     action:z.enum(['keep-server','keep-device','keep-both','merge']),
     expectedServerRevision:z.number().int().nonnegative(),
     path:safePath.optional(),
     content:z.string().optional()
    }).parse(body),workspace);
   }
   else if(p.startsWith('/api/conflicts/')&&method==='DELETE'){const next=structuredClone(store.state);next.conflicts=next.conflicts.filter(c=>c.id!==p.split('/')[3]);store.commit(next);}
   else if(p==='/api/attachments/sync'&&['PUT','DELETE'].includes(method)){const target=safePath.parse(q.get('path')),old=store.state.attachments.find(a=>a.path===target);value=store.syncAttachment(target,z.string().parse(q.get('expected')),method==='DELETE'?null:bytes,old?await attachment(old):undefined);}
   else if(p==='/api/attachments'&&method==='POST'){if(bytes.length>10000000)throw new HttpError(413,'Attachment exceeds 10 MB');const path=safePath.parse(q.get('path'));store.attachment(path,bytes);value={path};}
   else if(p==='/api/attachment'&&method==='GET'){const a=store.state.attachments.find(a=>a.path===safePath.parse(q.get('path')));if(!a)throw new HttpError(404,'Attachment not found');return new Response(await attachment(a),{headers:{'Content-Type':'application/octet-stream'}});}
   else if(p==='/api/import'&&method==='POST')value=store.importFiles(unpack(bytes),workspace);
   else if(p==='/api/export'&&method==='GET'){
    // Export is explicit: hydrate a separate view, never mutate persisted references.
    let total=0;for(const a of store.state.attachments){const ref=disk.files[a.path];total+=ref&&typeof ref!=='string'?ref.size:Buffer.from(a.data,'base64').length;}
    for(const n of Object.values(store.state.notes))if(!n.deleted)total+=Buffer.byteLength(n.content);
    if(total>32*1024*1024)throw new HttpError(413,'Portable export exceeds 32 MiB. Original files remain in the selected folder.');
    store.verify();const state=structuredClone(store.state);for(const a of state.attachments)a.data=(await attachment(a)).toString('base64');
    return new Response(exportVault({state,verify:()=>{}} as Store),{headers:{'Content-Type':'application/zip'}});
   }
   else if(p==='/api/video/capture'&&method==='POST'){const ext=z.enum(['jpg','mp4','webm']).parse(q.get('extension'));if(!bytes.length||bytes.length>8000000)throw new HttpError(400,'Invalid capture');value=store.captureVideo(sourceInputSchema.parse(JSON.parse(q.get('source')??'')),z.string().uuid().parse(q.get('id')),ext,bytes);}
   else if(p.startsWith('/api/video/'))throw new HttpError(503,'Online video lookup requires a server workspace. Local attachments and capture remain available.');
   else throw new HttpError(404,`Local action not supported: ${method} ${p}`);
  }catch(e){failure=e;}
  try{if(!['GET','HEAD'].includes(method))await persist(disk);}catch(e){if(storage.manual){try{
   disk=await storage.load();poisoned=false;mount();currentStore=buildIndex();
   // A SAF provider may complete a folder creation and then fail while confirming
   // the response. The fresh provider read is authoritative: acknowledge the
   // operation when the requested directory is now present so the live tree does
   // not remain stale until the workspace is reopened.
   if(p==='/api/folders'&&method==='POST'&&(currentStore.state.folders??[]).some(folder=>folder.toLowerCase()===body.path?.toLowerCase())){
    failure=null;
   }else return json({error:'Operation was not confirmed. Keep your editor text. '+(e instanceof Error?e.message:String(e))},503);
  }catch{poisoned=true;mount();currentStore=buildIndex();return json({error:'Operation was not confirmed. Keep your editor text. '+(e instanceof Error?e.message:String(e))},503);}}else{poisoned=true;mount();currentStore=buildIndex();return json({error:'Folder save failed. Changes remain queued; reopen the workspace to recover. No successful save acknowledged.'},503);}}
  if(failure)return json({error:failure instanceof z.ZodError?'Invalid request':failure.message,details:failure.details},failure instanceof HttpError?failure.status:failure instanceof z.ZodError?400:503);
  if(deltaBefore){
   const next=currentStore.state,oldFolders=new Set(deltaBefore.folders??[]),newFolders=new Set(next.folders??[]);
   const notes=Object.values(next.notes).filter(n=>!deltaBefore.notes[n.id]||n.rev!==deltaBefore.notes[n.id].rev);
   const styles=Object.fromEntries(Object.entries(next.styles??{}).filter(([p,c])=>deltaBefore.styles?.[p]!==c));
   // Mutation return values must carry retained history rather than the transient
   // history entry created by Store.revise before manual persistence.
   if(value?.id&&next.notes[value.id])value=next.notes[value.id];
   return json({result:value,delta:{base:deltaBefore.seq,seq:next.seq,notes,removed:Object.keys(deltaBefore.notes).filter(id=>!next.notes[id]),foldersAdded:[...newFolders].filter(p=>!oldFolders.has(p)),foldersRemoved:[...oldFolders].filter(p=>!newFolders.has(p)),styles,stylesRemoved:Object.keys(deltaBefore.styles??{}).filter(p=>!(p in (next.styles??{}))),conflicts:next.conflicts,attachments:attachmentSummaries(next)}},status);
  }
  return json(value,status);
 }
 return {get diagnostics(){return {indexBuilds,provisional,authoritative};},warnings,reconciled,fetch:(input:string|URL|Request,options?:RequestInit)=>{const result=queue.then(()=>request(input,options));queue=result.then(()=>{},()=>{});return result;},identity};
}
