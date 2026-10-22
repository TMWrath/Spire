import {openDB} from 'idb';
import {applyPublicationPatch,makePublicationPatch,snapshotHash} from '../shared/publication-patch';
import {mergeMarkdown,resolveMerge,type MergeResult,type MergeChoice} from '../shared/markdown-sync';
import {planPublication,samePublishedNote} from './publication-isolation';
import {pullWorkspace,type WorkspaceBase} from './workspace-pull';
import {deviceStorage} from './device-state';
import {traceOperation,operationRoute} from './operation-log';
import {applyLocalDelta,localFileAction,type LocalDelta} from './local-file-actions';
import {type Note,type Mutation,type Conflict,type SavedTemplate,mutationSchema,safePath} from '../shared/model';
import {scopeKey,type MountScope} from '../shared/mounted-workspace';
import {transferMountedFile,type TransferBundle,type TransferAdapter} from '../shared/mounted-transfer';
import {remoteFetch,remoteOrigin,bytesFromBase64} from './mount-transport';
import {setAttachmentResolver} from './attachment-urls';
import type {WireBundle} from '../server/transfer';
import {attachReturnProvenance,type TransferProvenance} from './transfer-provenance';
import {hydratePublicationNotes} from './publication-hydration';
import {publicationIsAdditive} from './publication-bootstrap';
import {publicationDecision,samePublication} from './publication-state';
export type Identity={owner:string;username:string;csrf:string;device?:{id:string;name:string};browser?:boolean;server?:{id:string;name:string}};
export type Snapshot={quickActions?:import('../shared/quick-actions').QuickAction[];sources?:import('../shared/sources').Source[];templates?:SavedTemplate[];seq:number;notes:Note[];folders:string[];styles:Record<string,string>;conflicts:Conflict[];attachments:{path:string;size:number}[]};
type Cache={identity?:Identity;workspaceBase?:WorkspaceBase<Snapshot>;snapshot:Snapshot;outbox:Mutation[];opened?:string[];media?:Record<string,{data:string;type:string}>;provenance?:Record<string,TransferProvenance>};
const blank=():Cache=>({snapshot:{seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]},outbox:[],opened:[],media:{}});
const db=openDB('spire-private-v1',1,{upgrade(db){db.createObjectStore('cache');}}).then(async legacy=>{
 const previous=await legacy.get('cache','server-profile');
 if(globalThis.spireDeviceState&&!await legacy.get('cache','device-state-migrated-v1')){if(previous&&!await legacy.get('cache','publication-consent'))await legacy.put('cache',previous,'publication-consent');}
 const storage=await deviceStorage(legacy,globalThis.spireDeviceState);
 if(globalThis.spireDeviceState)await legacy.put('cache',true,'device-state-migrated-v1');
 return storage;
});
async function installationIdentity(){return navigator.locks.request('spire-installation-identity',async()=>{const storage=await db;let installation=await storage.get('cache','installation-identity') as {id:string;secret:string}|undefined;if(!installation){installation={id:crypto.randomUUID(),secret:crypto.randomUUID()+crypto.randomUUID()};await storage.put('cache',installation,'installation-identity');}return installation;});}
const listeners=new Set<()=>void>();
export class ApiError extends Error{constructor(public status:number,message:string,public details?:Conflict){super(message);}}
export async function api(url:string,options:RequestInit={},csrf?:string){return engine.request(url,options,csrf);}
export class Engine{
 cache:Cache=blank();status='Connecting';listeners=listeners;authRequired=false;connected=true;
 acknowledgements=new Map<string,{from:number;to:number}>();onlineNotes=new Map<string,Note>();mediaURLs=new Map<string,string>();
 constructor(public scope?:MountScope,public cacheKey='current'){}
 get remote(){return this.scope?.kind==='server';}
 get manualLocal(){return !!globalThis.spireLocalManual&&!this.remote;}
 get lockName(){return this.cacheKey==='current'?'spire-cache':'spire-cache:'+this.cacheKey;}
 emit(){for(const l of this.listeners)l();}
 async raw(url:string,options:RequestInit={}){return traceOperation((options.method??'GET')+' '+operationRoute(url),this.remote?'Server':'Local',async()=>{if(!this.connected)throw Error('Server disconnected');return this.remote?remoteFetch(this.scope!.origin,url,options):fetch('/api'+url,{...options,signal:AbortSignal.timeout(25000)});});}
 async request(url:string,options:RequestInit={},csrf?:string){if(this.manualLocal&&/^\/folders(?:\/(?:move|rename))?$/.test(url)&&['POST','DELETE'].includes(options.method??''))return this.folderAction(url,options,csrf);const headers=new Headers(options.headers);if(!(options.body instanceof Blob)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');if(csrf)headers.set('X-CSRF-Token',csrf);const r=await this.raw(url,{...options,headers});if(!r.ok){const e=await r.json().catch(()=>({error:r.statusText}));throw new ApiError(r.status,e.error,e.details);}return r.json();}
 private async deltaRequest(url:string,options:RequestInit,csrf?:string){
  const response:{result:unknown;delta:LocalDelta}=await this.request(url+'?localDelta=1',options,csrf);
  this.cache.snapshot=applyLocalDelta(this.cache.snapshot,response.delta)??await this.request('/snapshot');
  return response.result;
 }
 private async folderAction(url:string,options:RequestInit,csrf?:string){return this.exclusive(async()=>{
  const action=options.method==='DELETE'?'Deleting':url==='/folders'?'Creating':url.endsWith('/rename')?'Renaming':'Moving';
  this.status=action+' folder…';this.emit();
  try{const result=await this.deltaRequest(url,options,csrf);this.status='Folder updated';await this.persistRuntime();return result;}
  catch(error){this.status=action+' folder failed · operation not confirmed';this.emit();throw error;}
 });}
 async load(){const liveIdentity=this.cache.identity;this.cache=(await(await db).get('cache',this.cacheKey))??blank();if(this.remote&&liveIdentity&&this.cache.identity&&liveIdentity.owner===this.cache.identity.owner&&liveIdentity.device?.id===this.cache.identity.device?.id)this.cache.identity={...this.cache.identity!,csrf:liveIdentity!.csrf};this.cache.opened??=[];this.cache.media??={};if(this.remote)this.cache.snapshot.notes=this.cache.snapshot.notes.map(n=>this.cache.opened!.includes(n.id)?n:(this.onlineNotes.get(n.id)??n));}
 async exclusive<T>(fn:()=>Promise<T>):Promise<T>{return navigator.locks.request(this.lockName,async()=>{if(!this.manualLocal)await this.load();return fn();});}
 private async persistRuntime(){if(this.manualLocal){this.emit();return;}await this.persist();}
 async persist(){const copy=structuredClone(this.cache);if(this.remote){if(copy.workspaceBase)copy.workspaceBase.snapshot.notes=copy.workspaceBase.snapshot.notes.map(n=>copy.opened!.includes(n.id)?n:{...n,content:'',history:[]});if(copy.identity)copy.identity.csrf='';copy.snapshot.notes=copy.snapshot.notes.map(n=>copy.opened!.includes(n.id)?n:{...n,content:'',history:[]});copy.snapshot.styles=Object.fromEntries(Object.entries(copy.snapshot.styles).filter(([p])=>copy.snapshot.notes.some(n=>copy.opened!.includes(n.id)&&n.path.replace(/\.md$/i,'.css')===p)));}await(await db).put('cache',copy,this.cacheKey);this.emit();}
 async init(){await this.load();const local=globalThis.spireLocalIdentity;if(local&&!this.remote){await this.exclusive(async()=>{if(this.cache.identity&&this.cache.identity.owner!==local.owner)throw Error('Local workspace identity changed; existing drafts retained.');this.cache.identity=local;this.authRequired=false;await this.persist();});void this.sync();return;}this.restoreMedia();this.emit();if(this.cache.identity){void this.sync();return;}await this.sync();}
 async login(identity:Identity){await this.exclusive(async()=>{if(this.cache.identity&&this.cache.identity.owner!==identity.owner){if(this.cache.outbox.length)throw Error('A different owner has pending local edits. Export them before signing in.');this.cache=blank();}this.cache.identity=identity;this.authRequired=false;await this.persist();});await this.sync();}
 async openFile(note:Note){
  if(globalThis.spireLocalWorkspace&&!this.remote){
   const current:Note=await this.request('/local/open',{method:'POST',body:JSON.stringify({id:note.id,deleted:note.deleted})},this.cache.identity?.csrf);
   this.cache.snapshot.styles={...this.cache.snapshot.styles,...(current as Note&{styles?:Record<string,string>}).styles};this.cache.snapshot.notes=this.cache.snapshot.notes.map(n=>n.id===current.id?current:n);this.emit();return current;
  }
  let current=this.cache.snapshot.notes.find(n=>n.id===note.id)??note;
  if(current.contentLoaded===false){
   const full:Note={...await this.request('/workspace/files/'+encodeURIComponent(note.id)+'/content'+(note.deleted?'?deleted=true':'')),history:[],contentLoaded:true};
   const indexed=this.cache.workspaceBase?.index.files.find(f=>f.id===note.id);
   const {contentFingerprint}=await import('../shared/workspace-index');
   if(full.id!==note.id||full.path!==note.path||full.rev!==note.rev||full.deleted!==note.deleted||indexed&&indexed.contentHash!==contentFingerprint(full.content)){
    await this.sync();throw Error('Server file changed while opening. Try again; existing drafts were retained.');
   }
   current=full;
  }
  this.onlineNotes.set(current.id,current);
  await this.exclusive(async()=>{if(this.cache.workspaceBase)this.cache.workspaceBase.snapshot.notes=this.cache.workspaceBase.snapshot.notes.map(n=>n.id===current.id?current:n);this.cache.opened=[...new Set([...(this.cache.opened??[]),note.id])];this.cache.snapshot.notes=this.cache.snapshot.notes.map(n=>n.id===note.id?current:n);await this.persist();});
  await this.cacheMedia(current);return current;
 }
 async loadMergeParents(note:Note):Promise<NonNullable<Note['mergeParents']>>{
  if(this===localEngine&&mounted.remote?.cache.identity?.device){const record=await(await db).get('cache','device-publication:'+mounted.remote.cache.identity.device.id);return record?.mirror?.notes.find((n:Note)=>n.id===note.id)?.mergeParents??note.mergeParents??[];}
  return note.mergeParents??[];
 }
 async loadHistory(note:Note):Promise<Note['history']>{
  const history=await this.request('/workspace/files/'+encodeURIComponent(note.id)+'/history');
  if(!Array.isArray(history))throw Error('Invalid revision response');return history;
 }
 private restoreMedia(){for(const [p,m]of Object.entries(this.cache.media??{})){if(!this.mediaURLs.has(p))this.mediaURLs.set(p,URL.createObjectURL(new Blob([bytesFromBase64(m.data)],{type:m.type})));}}
 async cacheMedia(note:Note){if(!this.remote)return;const paths=this.cache.snapshot.attachments.map(a=>a.path);const {linkedMedia}=await import('./workspace-media');for(const p of linkedMedia(note,paths)){try{const response=await this.raw('/attachment?path='+encodeURIComponent(p));if(!response.ok)throw Error('Attachment unavailable');const blob=await response.blob();if(blob.size>10_000_000)throw Error('Attachment exceeds cache limit');const {base64FromBytes}=await import('./mount-transport');const data=base64FromBytes(new Uint8Array(await blob.arrayBuffer()));await this.exclusive(async()=>{this.cache.media![p]={data,type:blob.type};await this.persist();});const old=this.mediaURLs.get(p);if(old)URL.revokeObjectURL(old);this.mediaURLs.set(p,URL.createObjectURL(blob));}catch{/* Previously cached media remains available; never substitute Local bytes. */}}this.restoreMedia();this.emit();}
 async save(note:Note){if(note.contentLoaded===false){const indexed=this.cache.snapshot.notes.find(n=>n.id===note.id);if(!indexed||indexed.rev!==note.rev)throw Error("The file changed. Refresh before editing.");const current=await this.openFile(indexed);note={...note,content:current.content,rev:current.rev,contentLoaded:true};}if(this.manualLocal){await this.exclusive(async()=>{
  if(!this.cache.identity)throw Error('Local folder is not ready');
  const ack=this.acknowledgements.get(note.id);const base=ack&&note.rev>=ack.from&&note.rev<ack.to&&this.cache.snapshot.notes.find(n=>n.id===note.id)?.rev===ack.to?ack.to:note.rev;
  const mutation=mutationSchema.parse({op:crypto.randomUUID(),id:note.id,base,path:note.path,content:note.content,deleted:note.deleted,templateIds:note.templateIds});
  const action=localFileAction(note,this.cache.snapshot.notes.find(n=>n.id===note.id));this.status=action.pending;this.emit();
  try{await this.deltaRequest('/mutate',{method:'POST',body:JSON.stringify(mutation)},this.cache.identity.csrf);this.acknowledgements.set(note.id,{from:ack?.to===base?ack.from:base,to:base+1});this.status=action.done;await this.persistRuntime();}
  catch(e){this.status=action.failed;this.emit();throw e;}
 });mounted.queuePublication();return;}await this.exclusive(async()=>{if(!this.cache.identity)throw Error('Sign in first');if(this.remote&&note.rev>0&&!this.cache.opened!.includes(note.id))throw Error('Open the Server file before editing it offline');const existing=this.cache.outbox.find(m=>m.id===note.id);const ack=this.acknowledgements.get(note.id);const base=ack&&note.rev>=ack.from&&note.rev<ack.to&&this.cache.snapshot.notes.find(n=>n.id===note.id)?.rev===ack.to?ack.to:note.rev;const mutation=mutationSchema.parse({op:crypto.randomUUID(),id:note.id,base:existing?.base??base,path:note.path,content:note.content,deleted:note.deleted,templateIds:note.templateIds});this.cache.outbox=this.cache.outbox.filter(m=>m.id!==note.id);this.cache.outbox.push(mutation);this.cache.opened=[...new Set([...(this.cache.opened??[]),note.id])];this.cache.snapshot.notes=this.cache.snapshot.notes.filter(n=>n.id!==note.id);this.cache.snapshot.notes.push(note);this.status=navigator.onLine?'Saved locally · queued':'Offline · saved locally';await this.persist();});}
 private syncFlight:Promise<void>|null=null;
 async sync(){if(this.manualLocal){await this.exclusive(async()=>{try{this.cache.snapshot=await this.request('/snapshot');this.status='Local folder · manual save';await this.persistRuntime();}catch(e){this.status='Folder unavailable';this.emit();throw e;}});return;}if(!this.connected)return;if(this.syncFlight)return this.syncFlight;const flight=this.syncOnce();this.syncFlight=flight;try{await flight;}finally{if(this.syncFlight===flight)this.syncFlight=null;}}
 private async syncOnce(){await this.exclusive(async()=>{if(!this.cache.identity){this.status='Sign in required';this.emit();return;}this.status='Syncing';this.emit();try{let me:Identity=await this.request('/me');if(!this.remote&&!this.manualLocal&&!me.browser)me=await this.request('/browser-session',{method:'POST'},me.csrf);if(me.owner!==this.cache.identity.owner)throw new ApiError(401,'Owner changed; sign in required');if(this.remote){const location=await this.request('/reliquary');if(location.directory!==this.scope!.workspace)throw new ApiError(401,'Server workspace changed; reconnect in Settings. Existing drafts retained.');}this.cache.identity=me;this.authRequired=false;
 while(this.cache.outbox.length){const m=this.cache.outbox[0];try{const saved:Note=await this.request('/mutate',{method:'POST',body:JSON.stringify(m)},me.csrf);const previous=this.acknowledgements.get(m.id);this.acknowledgements.set(m.id,{from:previous?.to===m.base?previous.from:m.base,to:saved.rev});}catch(e){if(!(e instanceof ApiError&&e.status===409&&e.details))throw e;if(!this.cache.snapshot.conflicts.some(c=>c.id===e.details!.id))this.cache.snapshot.conflicts.push(e.details);}this.cache.outbox.shift();await this.persist();}
 const pulled=await pullWorkspace<Snapshot>((path,options)=>this.request(path,options,me.csrf),this.cache.workspaceBase,true);this.cache.workspaceBase=pulled.base;const ids=new Set(pulled.base.index.files.map(f=>f.id));for(const id of this.onlineNotes.keys())if(!ids.has(id))this.onlineNotes.delete(id);for(const n of pulled.received){if(n.contentLoaded===false)this.onlineNotes.delete(n.id);else this.onlineNotes.set(n.id,n);}const next:Snapshot={...pulled.base.snapshot,notes:pulled.base.snapshot.notes.map(n=>this.onlineNotes.get(n.id)??n)};this.cache.snapshot=next;this.status=next.conflicts.length?'Conflicts need attention':'Synchronized';await this.persist();
 }catch(e){if(e instanceof ApiError&&e.status===401){this.authRequired=true;this.status='Session expired or device revoked · local drafts retained';}else this.status=e instanceof ApiError?e.message:'Offline · local changes retained';this.emit();}});}
 async logout(){await this.exclusive(async()=>{if(this.cache.outbox.length||this.cache.snapshot.conflicts.length)throw Error('Sync or export pending edits and conflicts before signing out.');await this.request('/logout',{method:'POST'},this.cache.identity?.csrf);this.cache=blank();this.authRequired=false;this.onlineNotes.clear();for(const url of this.mediaURLs.values())URL.revokeObjectURL(url);this.mediaURLs.clear();await this.persist();});}
 async resolveConflict(id:string,choice:{action:'keep-server'|'keep-device'|'keep-both'|'merge';expectedServerRevision:number;path?:string;content?:string}){await this.request('/conflicts/'+id+'/resolve',{method:'POST',body:JSON.stringify(choice)},this.cache.identity?.csrf);await this.sync();}
}
export const localEngine=new Engine(undefined,globalThis.spireLocalManual?'local-manual-v2':'current');
export class DeviceWorkspaceEngine extends Engine{
 workspaceRevision=0;
 constructor(public device:{id:string;name:string},identity?:Identity){super(undefined,'device-local:'+device.id);this.cache.identity=identity;this.status='Device Local workspace';}
 override async load(){try{const result:{revision:number;snapshot:Snapshot}=await this.request('/device-workspaces/'+this.device.id+'/snapshot');this.workspaceRevision=result.revision;this.cache.snapshot=result.snapshot;this.status='Device Local workspace · editable';this.emit();}catch(e){if(e instanceof ApiError&&e.status===404){this.status='Device has not published its Local files';this.emit();return;}throw e;}}
 override async init(){await this.load();}
 override async sync(){await this.load();}
 override async openFile(note:Note){return note;}
 override async loadHistory(note:Note){return note.history;}
 override async save(note:Note){if(!this.cache.identity)throw Error('Sign in first');const mutation=mutationSchema.parse({op:crypto.randomUUID(),id:note.id,base:note.rev,path:note.path,content:note.content,deleted:note.deleted,templateIds:note.templateIds});const result:{workspaceRevision:number;snapshot:Snapshot}=await this.request('/device-workspaces/'+this.device.id+'/mutate',{method:'POST',body:JSON.stringify({workspaceRevision:this.workspaceRevision,mutation})},this.cache.identity.csrf);this.workspaceRevision=result.workspaceRevision;this.cache.snapshot=result.snapshot;this.status='Saved to '+this.device.name+' Local workspace';this.emit();}
}
export let engine=localEngine;
type Journal={id:string;source:string;destination:string;path:string;phase:'prepared'|'acknowledged'|'verified'|'done'|'interrupted';message?:string;bundle?:WireBundle;time:string};
export type PublicationReview={id:string;local:Note;base:Note;server:Note};
export const mounted={
 publicationReviews:[] as PublicationReview[],
 async resolvePublication(review:PublicationReview,content:string){
  if(content.length>1_000_000)throw Error('Merged file is too large');
  return navigator.locks.request('spire-device-publication',async()=>{
   const remote=this.remote,identity=remote?.cache.identity;if(!remote||!identity?.device)throw Error('Reconnect the Server before resolving');
   const d=await db,key='device-publication:'+identity.device.id;const record=await d.get('cache',key);if(!record)throw Error('Shared version unavailable');
   await localEngine.sync();let current=localEngine.cache.snapshot.notes.find(n=>n.id===review.id);if(current?.contentLoaded===false)current=await localEngine.openFile(current);
   const head=await remote.request('/device-workspaces/self/delta?after=0');const incoming=head.snapshot?.notes.find((n:Note)=>n.id===review.id);
   if(!current||!incoming||!samePublishedNote(current,review.local)||current.rev!==review.local.rev||!samePublishedNote(incoming,review.server)||incoming.rev!==review.server.rev)throw Error('File changed since review. Refresh and review the new versions; no choice was applied.');
   if(review.local.deleted||review.server.deleted||review.local.path!==review.server.path)throw Error('Resolve the path or deletion conflict explicitly before merging text');
   // Persist the user decision and both inputs before touching provider bytes.
   await d.put('cache',{review,content,time:new Date().toISOString()},key+':resolution:'+review.id);
   await localEngine.save({...current,content});await localEngine.sync();const saved=localEngine.cache.snapshot.notes.find(n=>n.id===review.id);if(!saved||saved.content!==content)throw Error('Provider did not confirm the resolved file');
   record.snapshot.notes=record.snapshot.notes.map((n:Note)=>n.id===review.id?review.server:n);await d.put('cache',record,key);
   await this.reconcileDeviceWorkspaceLocked();
   await d.delete('cache',key+':resolution:'+review.id);
  });
 },
 publicationAuthorized:false,
 publicationQueued:false,publicationTimer:undefined as ReturnType<typeof setTimeout>|undefined,
 queuePublication(){if(!this.supported||!this.remote||(globalThis.spireDeviceState&&!this.publicationAuthorized))return;this.publicationQueued=true;if(this.publicationTimer!==undefined)return;this.publicationTimer=setTimeout(()=>{this.publicationTimer=undefined;void this.flushPublication();},0);},
 async flushPublication(){if(!this.publicationQueued||!this.remote)return;if(this.busy||this.sharingFlight){this.publicationTimer=setTimeout(()=>{this.publicationTimer=undefined;void this.flushPublication();},250);return;}this.publicationQueued=false;try{await this.refreshSharing();}catch{this.publicationQueued=true;if(this.remote){this.remote.status='Saved locally · Server upload failed; retry pending';this.remote.emit();}}finally{if(this.publicationQueued&&this.publicationTimer===undefined)this.publicationTimer=setTimeout(()=>{this.publicationTimer=undefined;void this.flushPublication();},1000);}},
 remote:undefined as Engine|undefined,deviceEngines:[] as DeviceWorkspaceEngine[],journals:[] as Journal[],busy:false,sharingFlight:undefined as Promise<void>|undefined,
 async refreshSharing(){if(this.busy||(globalThis.spireDeviceState&&!this.publicationAuthorized))return;if(this.sharingFlight)return this.sharingFlight;const flight=this.supported?this.reconcileDeviceWorkspace():this.refreshDevices();this.sharingFlight=flight;try{await flight;}finally{if(this.sharingFlight===flight)this.sharingFlight=undefined;}},
 get supported(){return !!globalThis.spireRemoteTransport;},
 get engines(){return [localEngine,...(this.remote?[this.remote]:[])];},
 get visibleEngines(){return [...this.engines,...this.deviceEngines];},
 async refreshDevices(){if(localEngine.manualLocal||this.supported||!localEngine.cache.identity){this.deviceEngines=[];return;}const rows:{id:string;name:string;published:boolean}[]=await localEngine.request('/device-workspaces');this.deviceEngines=rows.filter(row=>row.published).map(row=>{const existing=this.deviceEngines.find(e=>e.device.id===row.id);if(existing){existing.cache.identity=localEngine.cache.identity;return existing;}return new DeviceWorkspaceEngine(row,localEngine.cache.identity);});await Promise.all(this.deviceEngines.filter(e=>rows.find(r=>r.id===e.device.id)?.published).map(e=>e.init()));localEngine.emit();},
 async restore(){if(!this.supported)return;const d=await db;this.journals=[];for(const k of await d.getAllKeys('cache'))if(String(k).startsWith('transfer:')){const j=await d.get('cache',k);if(j.phase!=='done')this.journals.push(j);}const profile=await d.get('cache','server-profile');if(profile){const scope:MountScope=profile;scopeKey(scope,'cache');const consent=await d.get('cache','publication-consent');this.publicationAuthorized=!!consent&&scopeKey(consent,'cache')===scopeKey(scope,'cache');const remote=new Engine(scope,scopeKey(scope,'cache'));this.remote=remote;await remote.init();await remote.sync();if(!remote.authRequired&&remote.cache.identity?.device&&remote.cache.identity.csrf){const installation=await installationIdentity();await remote.request('/device-installation',{method:'POST',body:JSON.stringify({installation})},remote.cache.identity.csrf);}}localEngine.emit();},
 async connect(origin:string,username:string,password:string,device:string){if(this.busy)throw Error('Finish the current move first');device=device.trim();if(!device)throw Error('Give this device a unique name');origin=remoteOrigin(origin);const probe=new Engine({kind:'server',origin,account:'pending',workspace:'pending'});const installation=await installationIdentity();const profile=await(await db).get('cache','server-profile') as MountScope|undefined;if(profile?.origin===origin){const previous=new Engine(profile,scopeKey(profile,'cache'));await previous.load();if(previous.cache.identity?.device){try{const me:Identity=await previous.request('/me');if(me.device)await previous.request('/device-installation',{method:'POST',body:JSON.stringify({installation})},me.csrf);}catch(error){if(!(error instanceof ApiError)||error.status!==401)throw error;}}}const identity:Identity=await probe.request('/login',{method:'POST',body:JSON.stringify({username,password,device,installation})});const location=await probe.request('/reliquary');const scope:MountScope={kind:'server',origin,account:identity.owner,workspace:location.directory};const key=scopeKey(scope,'cache');const remote=new Engine(scope,key);await remote.load();await remote.login(identity);if(this.remote&&this.remote!==remote)this.remote.connected=false;this.remote=remote;await(await db).put('cache',scope,'server-profile');this.publicationAuthorized=false;if(!globalThis.spireDeviceState)await this.reconcileDeviceWorkspace();localEngine.emit();},
 async authorizePublication(){if(!this.remote?.scope)throw Error('Connect a Server first');await(await db).put('cache',this.remote.scope,'publication-consent');this.publicationAuthorized=true;await navigator.locks.request('spire-device-publication',()=>this.reconcileDeviceWorkspaceLocked(true));localEngine.emit();},
 async reconcileDeviceWorkspace(){if(globalThis.spireDeviceState&&!this.publicationAuthorized)return;return navigator.locks.request('spire-device-publication',()=>this.reconcileDeviceWorkspaceLocked());},
 async reconcileDeviceWorkspaceLocked(explicit=false){const remote=this.remote,identity=remote?.cache.identity;if(!this.supported||!remote||!identity?.device)return;const d=await db,key='device-publication:'+identity.device.id;// Publication consumes acknowledged Local state; provider rescans are explicit user actions.
await localEngine.sync();let local=structuredClone(localEngine.cache.snapshot),record=await d.get('cache',key) as {revision:number;snapshot:Snapshot;mirror?:Snapshot}|undefined,server:{revision:number;snapshot:Snapshot}|undefined;
if(local.notes.some(n=>n.contentLoaded===false)){
 if(explicit&&localEngine.manualLocal)local=await localEngine.request('/local/publication',{method:'POST'});
 else {
  if(!record){remote.status='Connected · explicitly publish Local files to upload unopened content';remote.emit();return;}
  const notes=await hydratePublicationNotes(local.notes,record.snapshot.notes,async id=>{const opened=await localEngine.request('/local/open',{method:'POST',body:JSON.stringify({id})});return opened;});
  local={...local,notes};
 }
}
try{const response=await remote.request('/device-workspaces/self/delta?after='+(record?.mirror?record.revision:0));const snapshot=response.snapshot??(record?.mirror?(response.unchanged?record.mirror:applyPublicationPatch(record.mirror,response.patch)):undefined);if(!snapshot||snapshotHash(snapshot)!==response.hash)throw Error('Server delta integrity failure; Local files retained');server={revision:response.revision,snapshot};}catch(error){if(!(error instanceof ApiError)||error.status!==404)throw error;const created:{revision:number;snapshot:Snapshot}=await remote.request('/device-workspaces/self/snapshot',{method:'PUT',body:JSON.stringify({base:0,snapshot:local})},identity.csrf);await d.put('cache',created,key);remote.status='Connected · Local workspace published';return;}if(!server)throw Error('Device workspace response missing');if(!record){if(publicationIsAdditive(server.snapshot,local)){const published:{revision:number;snapshot:Snapshot}=await remote.request('/device-workspaces/self/snapshot',{method:'PUT',body:JSON.stringify({base:server.revision,snapshot:local})},identity.csrf);await d.put('cache',published,key);remote.status='Connected · additive Local files published safely';remote.emit();return;}remote.status='Connected · existing device publication needs review; Local files were not overwritten';remote.emit();return;}const plan=planPublication(local,record.snapshot,server.snapshot);
this.publicationReviews=plan.conflicts.flatMap(id=>{const a=local.notes.find(n=>n.id===id),b=record!.snapshot.notes.find(n=>n.id===id),s=server!.snapshot.notes.find(n=>n.id===id);return a&&b&&s&&a.contentLoaded!==false&&s.contentLoaded!==false?[{id,local:a,base:b,server:s}]:[];});
let confirmed=server;
if(plan.upload){
 const receipt=await remote.request('/device-workspaces/self/patch',{method:'POST',body:JSON.stringify({base:server.revision,operation:crypto.randomUUID(),patch:makePublicationPatch(server.snapshot,plan.outgoing)})},identity.csrf);
 if(receipt.hash!==snapshotHash(plan.outgoing)||receipt.revision!==server.revision+1)throw Error('Server publication acknowledgement differs; Local changes retained');
 confirmed={revision:receipt.revision,snapshot:plan.outgoing};
}
// Successful uploads must not depend on unrelated provider pull success.
await d.put('cache',{revision:confirmed.revision,snapshot:plan.baseline,mirror:confirmed.snapshot},key);
const failures:string[]=[];
for(const incoming of plan.pulls){
 try{
  const captured=local.notes.find(note=>note.id===incoming.id);
  // Never adopt a newer, unreviewed revision to bypass stale-write protection.
  await localEngine.save({...incoming,rev:captured?.rev??0});
  await localEngine.sync();
  const saved=localEngine.cache.snapshot.notes.find(note=>note.id===incoming.id);
  if(!samePublishedNote(saved,incoming))throw Error('Provider did not confirm incoming file');
  const i=plan.baseline.notes.findIndex(note=>note.id===incoming.id);
  if(i<0)plan.baseline.notes.push(structuredClone(saved!));else plan.baseline.notes[i]=structuredClone(saved!);
  await d.put('cache',{revision:confirmed.revision,snapshot:plan.baseline,mirror:confirmed.snapshot},key);
 }catch{failures.push(incoming.path);}
}
const pending=[...plan.conflicts.map(id=>id.startsWith('workspace:')?id:(local.notes.find(n=>n.id===id)?.path??server!.snapshot.notes.find(n=>n.id===id)?.path??id)),...failures];
remote.status=pending.length?'Connected · independent files synchronized; review conflicts: '+pending.join(', '):'Connected · Local files confirmed on Server';
remote.emit();},
 select(target:Engine){if(this.busy)throw Error('Finish the current move first');if(!this.visibleEngines.includes(target)||!target.connected)throw Error('Mount unavailable');engine=target;setAttachmentResolver(p=>target.remote?(target.mediaURLs.get(p)??'data:application/octet-stream,'):'/api/attachment?path='+encodeURIComponent(p));target.emit();},
 async disconnect(){const remote=this.remote;if(!remote)return;if(this.busy)throw Error('Finish the current move first');await remote.logout();remote.connected=false;this.remote=undefined;await(await db).delete('cache','server-profile');await(await db).delete('cache','publication-consent');this.publicationAuthorized=false;if(engine===remote)this.select(localEngine);localEngine.emit();},
 async move(source:Engine,target:Engine,path:string,recovery?:Journal){safePath.parse(path);if(this.busy)throw Error('Another move is in progress');if(source===target||!this.engines.includes(source)||!this.engines.includes(target))throw Error('Choose a different storage mount');this.busy=true;source.emit();const journal:Journal=recovery??{id:crypto.randomUUID(),source:source.cacheKey,destination:target.cacheKey,path,phase:'prepared',time:new Date().toISOString()};if(journal.source!==source.cacheKey||journal.destination!==target.cacheKey||journal.path!==path)throw Error('Recovery mount identity differs');const record=async()=>{await(await db).put('cache',journal,'transfer:'+journal.id);source.emit();};
 try{await source.sync();await target.sync();const keys=[source.lockName,target.lockName].sort();await navigator.locks.request(keys[0],()=>navigator.locks.request(keys[1],async()=>{await source.load();await target.load();const available=(e:Engine)=>e.connected&&!e.authRequired&&e.status==='Synchronized'&&!e.cache.outbox.length&&!e.cache.snapshot.conflicts.length;if(!available(source)||!available(target))throw Error('Reconnect and resolve pending edits/conflicts before moving files');await record();let captured:WireBundle|undefined=journal.bundle;
 const convert=(b:WireBundle):TransferBundle=>({path:b.path,version:b.version,pending:false,files:b.files.map(f=>({path:f.path,bytes:bytesFromBase64(f.data),...(f.id?{id:f.id}:{}),...(f.rev!==undefined?{revision:f.rev}:{})}))});
 const read=async(e:Engine,p:string)=>e.request('/transfers?path='+encodeURIComponent(p));
 const a:TransferAdapter={read:async p=>{if(!captured){captured={...await read(source,p),operation:journal.id};journal.bundle=captured;await record();}return convert(captured!);},create:async()=>{throw Error('Invalid transfer direction');},removeIfUnchanged:async()=>{await source.load();if(source.cache.outbox.length||source.cache.snapshot.conflicts.length)throw Error('Source acquired pending edits; source retained');journal.phase='verified';await record();await source.request('/transfers/remove',{method:'POST',body:JSON.stringify(captured)},source.cache.identity?.csrf);}};
 const b:TransferAdapter={read:async p=>convert(await read(target,p)),create:async()=>{if(!source.remote&&target.remote)captured=attachReturnProvenance(captured!,source.cache.provenance,target.scope);const ack=await target.request('/transfers',{method:'POST',body:JSON.stringify(captured)},target.cache.identity?.csrf);if(ack.acknowledged===true){journal.phase='acknowledged';await record();if(source.remote&&!target.remote&&source.scope){target.cache.provenance??={};for(const f of captured!.files)if(f.kind==='note'&&f.id&&f.rev!==undefined)target.cache.provenance[f.id]={origin:source.scope.origin,account:source.scope.account,workspace:source.scope.workspace,revision:f.rev};await target.persist();}}return ack;},removeIfUnchanged:async()=>{throw Error('Invalid transfer direction');}};
 if(recovery&&captured){const ack=await b.create(convert(captured));if(ack.acknowledged!==true)throw Error('Destination acknowledgement missing');const current=await b.read(path);const expected=convert(captured);if(JSON.stringify(current.files.map(f=>[f.path,Array.from(f.bytes)]))!==JSON.stringify(expected.files.map(f=>[f.path,Array.from(f.bytes)])))throw Error('Destination bytes changed; source retained');await a.removeIfUnchanged(path,expected);}else await transferMountedFile(a,b,path);journal.phase='done';delete journal.bundle;delete journal.message;await record();this.journals=this.journals.filter(j=>j.id!==journal.id);}));await source.sync();await target.sync();
 }catch(error){journal.phase='interrupted';journal.message=error instanceof Error?error.message:'Move interrupted; source retained';await record();this.journals=this.journals.filter(j=>j.id!==journal.id);this.journals.push(journal);throw Error(journal.message+' Source removal was not assumed. Use Resume move in Settings after reconnecting.');}finally{this.busy=false;source.emit();}},
 async resumeJournal(id:string){const journal=this.journals.find(j=>j.id===id);if(!journal?.bundle?.operation)throw Error('This older transfer has no retry-safe receipt. Review both trees; source retained.');const source=this.engines.find(e=>e.cacheKey===journal.source),target=this.engines.find(e=>e.cacheKey===journal.destination);if(!source||!target)throw Error('Reconnect the original mounts/account to resume this move');await this.move(source,target,journal.path,journal);},
 async dismissJournal(id:string){await(await db).delete('cache','transfer:'+id);this.journals=this.journals.filter(j=>j.id!==id);localEngine.emit();}
};
window.addEventListener('online',()=>{void refreshConnectedWorkspaces();});
window.addEventListener('offline',()=>{for(const e of mounted.engines){if(e.manualLocal)continue;e.onlineNotes.clear();e.status='Offline · local changes retained';e.emit();}});
async function refreshConnectedWorkspaces(){
 if(document.visibilityState!=='visible'||mounted.busy)return;
 await Promise.all(mounted.engines.filter(e=>!e.manualLocal).map(e=>e.sync()));
 try{await mounted.refreshSharing();}catch(error){if(mounted.remote){mounted.remote.status='Local synchronization paused · '+(error instanceof Error?error.message:'connection unavailable');mounted.remote.emit();}}
}
setInterval(()=>{void refreshConnectedWorkspaces();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshConnectedWorkspaces();});
// Native remote downloads use the mount transport; never resolve a Server URL
// against the local SAF/loopback origin, even for equal paths.
document.addEventListener('click',event=>{const anchor=(event.target as HTMLElement).closest?.('a');if(!anchor||!engine.remote)return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return;event.preventDefault();event.stopImmediatePropagation();const owner=engine;void owner.raw(url.pathname.slice(4)+url.search).then(async r=>{if(!r.ok)throw Error('Server download unavailable');const blob=await r.blob(),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=anchor.download||'Spire.zip';a.click();setTimeout(()=>URL.revokeObjectURL(href),60000);}).catch(()=>alert('Server download unavailable. Local files were not accessed.'));},true);
