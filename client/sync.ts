import {openDB} from 'idb';
import {type Note,type Mutation,type Conflict,type SavedTemplate,mutationSchema} from '../shared/model';
export type Identity={owner:string;username:string;csrf:string;device:{id:string;name:string}};
export type Snapshot={sources?:import('../shared/sources').Source[];templates?:SavedTemplate[];seq:number;notes:Note[];folders:string[];styles:Record<string,string>;conflicts:Conflict[];attachments:{path:string;size:number}[]};
type Cache={identity?:Identity;snapshot:Snapshot;outbox:Mutation[]};
const blank=():Cache=>({snapshot:{seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]},outbox:[]});
const db=openDB('spire-private-v1',1,{upgrade(db){db.createObjectStore('cache');}});
export class ApiError extends Error{constructor(public status:number,message:string,public details?:Conflict){super(message);}}
export async function api(url:string,options:RequestInit={},csrf?:string){const r=await fetch('/api'+url,{...options,headers:{...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers},signal:AbortSignal.timeout(15000)});if(!r.ok){const e=await r.json().catch(()=>({error:r.statusText}));throw new ApiError(r.status,e.error,e.details);}return r.json();}
class Engine{
 cache:Cache=blank();status='Connecting';listeners=new Set<()=>void>();authRequired=false;
 acknowledgements=new Map<string,{from:number;to:number}>();
 emit(){for(const l of this.listeners)l();}
 async exclusive<T>(fn:()=>Promise<T>):Promise<T>{return navigator.locks.request('spire-cache',async()=>{this.cache=(await(await db).get('cache','current'))??blank();return fn();});}
 async persist(){await(await db).put('cache',this.cache,'current');this.emit();}
 async init(){this.cache=(await(await db).get('cache','current'))??blank();this.emit();await this.sync();}
 async login(identity:Identity){await this.exclusive(async()=>{if(this.cache.identity&&this.cache.identity.owner!==identity.owner){if(this.cache.outbox.length)throw new Error('A different owner has pending local edits. Export them before signing in.');this.cache=blank();}this.cache.identity=identity;this.authRequired=false;await this.persist();});await this.sync();}
 async save(note:Note){await this.exclusive(async()=>{if(!this.cache.identity)throw new Error('Sign in first');const existing=this.cache.outbox.find(m=>m.id===note.id);const ack=this.acknowledgements.get(note.id);const base=ack&&note.rev>=ack.from&&note.rev<ack.to&&this.cache.snapshot.notes.find(n=>n.id===note.id)?.rev===ack.to?ack.to:note.rev;const mutation=mutationSchema.parse({op:crypto.randomUUID(),id:note.id,base:existing?.base??base,path:note.path,content:note.content,deleted:note.deleted,templateIds:note.templateIds});this.cache.outbox=this.cache.outbox.filter(m=>m.id!==note.id);this.cache.outbox.push(mutation);this.cache.snapshot.notes=this.cache.snapshot.notes.filter(n=>n.id!==note.id);this.cache.snapshot.notes.push(note);this.status=navigator.onLine?'Saved locally · queued':'Offline · saved locally';await this.persist();});}
 private syncFlight:Promise<void>|null=null;
 async sync(){if(this.syncFlight)return this.syncFlight;const flight=this.syncOnce();this.syncFlight=flight;try{await flight;}finally{if(this.syncFlight===flight)this.syncFlight=null;}}
 private async syncOnce(){try{await this.exclusive(async()=>{if(!this.cache.identity){this.status='Sign in required';this.emit();return;}this.status='Syncing';this.emit();try{const me:Identity=await api('/me');if(me.owner!==this.cache.identity.owner)throw new ApiError(401,'Owner changed; sign in required');this.cache.identity=me;this.authRequired=false;
 while(this.cache.outbox.length){const m=this.cache.outbox[0];try{const result=await api('/mutate',{method:'POST',body:JSON.stringify(m)},me.csrf);const previous=this.acknowledgements.get(m.id);this.acknowledgements.set(m.id,{from:previous?.to===m.base?previous.from:m.base,to:m.base+1});}catch(e){if(!(e instanceof ApiError&&e.status===409&&e.details))throw e;this.cache.snapshot.conflicts.push(e.details);}this.cache.outbox.shift();await this.persist();}
 this.cache.snapshot=await api('/snapshot');this.status=this.cache.snapshot.conflicts.length?'Conflicts need attention':'Synchronized';await this.persist();
 }catch(e){if(e instanceof ApiError&&e.status===401){this.authRequired=true;this.status='Session expired or device revoked · local drafts retained';}else this.status=e instanceof ApiError?e.message:'Offline · local changes retained';this.emit();}});}finally{}}
 async logout(){await this.exclusive(async()=>{if(this.cache.outbox.length)throw new Error('Sync or export pending edits before signing out.');await api('/logout',{method:'POST'},this.cache.identity?.csrf);this.cache=blank();this.authRequired=false;await this.persist();});}
 async dismiss(id:string){await api('/conflicts/'+id,{method:'DELETE'},this.cache.identity?.csrf);await this.sync();}
}
export const engine=new Engine();
window.addEventListener('online',()=>void engine.sync());
window.addEventListener('offline',()=>{engine.status='Offline · local changes retained';engine.emit();});
setInterval(()=>void engine.sync(),5000);
