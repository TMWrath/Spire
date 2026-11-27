import {mutationSchema,type Conflict,type Mutation,type Note,type SavedTemplate} from '../shared/model';
import {rememberRecent} from './recent-files';

export type Identity={owner:string;username:string;csrf:string;browser?:boolean;server?:{id:string;name:string};device?:{id:string;name:string}};
export type Snapshot={visualGroups?:Record<string,import('../shared/visual-groups').VisualGroup[]>;quickActions?:import('../shared/quick-actions').QuickAction[];recentFiles?:string[];sources?:import('../shared/sources').Source[];templates?:SavedTemplate[];seq:number;notes:Note[];folders:string[];styles:Record<string,string>;conflicts:Conflict[];attachments:{path:string;size:number}[];trashedFiles?:{id:string;path:string;kind:'attachment'|'style';time:string;size:number}[]};
type Cache={identity?:Identity;snapshot:Snapshot;outbox:Mutation[]};
const blank=():Cache=>({snapshot:{seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]},outbox:[]});
const listeners=new Set<()=>void>();

export class ApiError extends Error{constructor(public status:number,message:string,public details?:Conflict){super(message);}}

export class Engine{
 cache:Cache=blank();status='Opening server workspace';listeners=listeners;authRequired=false;connected=true;
 readonly cacheKey='server';readonly remote=false;readonly manualLocal=false;
 emit(){for(const listener of this.listeners)listener();}
 async raw(url:string,options:RequestInit={}){return fetch('/api'+url,{...options,signal:options.signal??AbortSignal.timeout(25000)});}
 async request(url:string,options:RequestInit={},csrf?:string){const headers=new Headers(options.headers);if(!(options.body instanceof Blob)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');if(csrf)headers.set('X-CSRF-Token',csrf);const response=await this.raw(url,{...options,headers});if(!response.ok){const body=await response.json().catch(()=>({error:response.statusText}));throw new ApiError(response.status,body.error,body.details);}return response.json();}
 async init(){try{this.cache.identity=await this.request('/me');this.authRequired=false;await this.sync();}catch(error){if(error instanceof ApiError&&error.status===401){this.cache=blank();this.authRequired=true;this.status='Sign in required';this.emit();return;}throw error;}}
 async login(identity:Identity){this.cache.identity=identity;this.authRequired=false;await this.sync();}
 async sync(){if(!this.cache.identity)return;this.status='Refreshing';this.emit();try{const next:Snapshot=await this.request('/snapshot');const loaded=new Map(this.cache.snapshot.notes.filter(n=>n.contentLoaded!==false).map(n=>[n.id,n]));next.notes=next.notes.map(n=>{const cached=loaded.get(n.id);return n.contentLoaded===false&&cached?.rev===n.rev&&cached.path===n.path&&cached.deleted===n.deleted?cached:n;});this.cache.snapshot=next;this.status='Saved on server';this.authRequired=false;}catch(error){if(error instanceof ApiError&&error.status===401){this.authRequired=true;this.status='Session expired';}else this.status=error instanceof Error?error.message:'Server unavailable';throw error;}finally{this.emit();}}
 async openFile(note:Note){const current=this.cache.snapshot.notes.find(item=>item.id===note.id)??note;if(current.contentLoaded!==false)return current;const loaded:Note=await this.request('/workspace/files/'+encodeURIComponent(note.id)+'/content'+(note.deleted?'?deleted=true':''));const index=this.cache.snapshot.notes.findIndex(n=>n.id===loaded.id);if(index>=0&&this.cache.snapshot.notes[index].rev<=loaded.rev)this.cache.snapshot.notes[index]=loaded;return loaded;}

 async loadHistory(note:Note):Promise<Note['history']>{const history=await this.request('/workspace/files/'+encodeURIComponent(note.id)+'/history');if(!Array.isArray(history))throw Error('Invalid revision response');return history;}
 async loadMergeParents(_note:Note){return [];}
 attachmentURL(target:string){return '/api/attachment?path='+encodeURIComponent(target);}
 async save(note:Note){if(!this.cache.identity)throw Error('Sign in first');const current=this.cache.snapshot.notes.find(item=>item.id===note.id);const base=current?.rev??note.rev;const mutation=mutationSchema.parse({op:crypto.randomUUID(),id:note.id,base,path:note.path,content:note.content,deleted:note.deleted,templateIds:note.templateIds});this.status='Saving…';this.emit();try{const saved:Note=await this.request('/mutate',{method:'POST',body:JSON.stringify(mutation)},this.cache.identity.csrf);this.cache.snapshot.notes=this.cache.snapshot.notes.filter(item=>item.id!==saved.id);this.cache.snapshot.notes.push(saved);this.status='Saved on server';this.emit();return saved;}catch(error){this.status=error instanceof Error?error.message:'Save failed';this.emit();throw error;}}
 async rememberRecent(id:string){if(!this.cache.identity)return;for(let attempt=0;attempt<2;attempt++){const expected=this.cache.snapshot.recentFiles??[],changes=rememberRecent(expected,id);try{await this.request('/workspace/fields',{method:'POST',body:JSON.stringify({expected:{recentFiles:expected},changes:{recentFiles:changes}})},this.cache.identity.csrf);this.cache.snapshot.recentFiles=changes;this.emit();return;}catch(error){if(!(error instanceof ApiError)||error.status!==409||attempt)return await Promise.reject(error);await this.sync();}}}
 async persist(){this.emit();}
 async logout(){if(!this.cache.identity)return;await this.request('/logout',{method:'POST'},this.cache.identity.csrf);this.cache=blank();this.authRequired=false;this.status='Signed out';this.emit();}
 async resolveConflict(id:string,choice:{action:'keep-server'|'keep-device'|'keep-both'|'merge';expectedServerRevision:number;path?:string;content?:string}){await this.request('/conflicts/'+id+'/resolve',{method:'POST',body:JSON.stringify(choice)},this.cache.identity?.csrf);await this.sync();}
}

export const engine=new Engine();
/** Server-only workspace facade retained only for existing editor call sites during the cutover. */
export const localEngine=engine;
export class DeviceWorkspaceEngine extends Engine{}
export const mounted={
 supported:false,busy:false,remote:undefined as undefined,deviceEngines:[] as DeviceWorkspaceEngine[],publicationReviews:[] as Array<{id:string}>,engines:[engine],visibleEngines:[engine],
 async restore(){},async refreshDevices(){},async reconcileDeviceWorkspace(){},async refreshSharing(){},async disconnect(){await engine.logout();},
 select(_target:Engine){},async move(..._args:unknown[]){throw Error('Cross-workspace transfer was removed from server-only Spire.');},
 async resolvePublication(){throw Error('Client publication was removed from server-only Spire.');}
};
export async function api(url:string,options:RequestInit={},csrf?:string){return engine.request(url,options,csrf);}
