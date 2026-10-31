export type MountScope={kind:'local'|'server';origin:string;account:string;workspace:string};
export type CachedServerFile={path:string;base:number;content:string;pending:boolean;conflict?:{content:string;rev:number}};
/** Receipt for an explicitly moved Server file. It tracks identity, not sync permission. */
export type MovedServerFile={id:string;path:string;origin:MountScope;revision:number;bytes:string;state:'moved-away'};
export type MovedReturnCheck=
 |{kind:'unmatched'}
 |{kind:'collision'}
 |{kind:'unchanged';serverPath:string;revision:number}
 |{kind:'conflict';reason:'remote-edited'|'server-deleted';serverPath:string;revision:number;localBytes:string;serverBytes:string};
export type ServerReturnSnapshot={id:string;path:string;revision:number;bytes:string;deleted:boolean};
function checked(scope:MountScope):MountScope{
 if(!scope.account||!scope.workspace||!scope.origin)throw new Error('Incomplete mount identity');
 if(scope.kind==='server'){
  const url=new URL(scope.origin);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Server requires an HTTPS origin without embedded credentials');
  return {...scope,origin:url.origin};
 }
 if(scope.kind!=='local')throw new Error('Invalid mount kind');
 return {...scope};
}
function validSnapshot(file:ServerReturnSnapshot):boolean{return typeof file.id==='string'&&!!file.id&&typeof file.bytes==='string'&&typeof file.deleted==='boolean'&&Number.isSafeInteger(file.revision)&&file.revision>=0&&(()=>{try{checkedPath(file.path);return true;}catch{return false;}})();}
function checkedPath(path:string):string{
 if(!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Invalid mounted path');
 return path;
}
export function scopeKey(scope:MountScope,path:string):string{
 const s=checked(scope);return JSON.stringify([s.kind,s.origin,s.account,s.workspace,checkedPath(path)]);
}
/** Domain state only. Platform adapters must persist before acknowledging edits.
 * No Local contents enter this cache; disconnect never destroys cached drafts.
 */
export class MountedWorkspace{
 readonly local:MountScope;
 private server?:MountScope;
 private files=new Map<string,CachedServerFile>();
 private moved=new Map<string,MovedServerFile>();
 constructor(local:MountScope){this.local=checked(local);if(local.kind!=='local')throw new Error('Local mount required');}
 get mounts():MountScope[]{return [structuredClone(this.local),...(this.server?[structuredClone(this.server)]:[])];}
 connect(scope:MountScope):void{if(scope.kind!=='server')throw new Error('Server mount required');this.server=checked(scope);}
 disconnect():void{this.server=undefined;}
 private key(path:string):string{if(!this.server)throw new Error('Server not connected');return scopeKey(this.server,path);}
 openServer(path:string,content:string,rev:number):void{this.acceptServer(path,content,rev);}
 editServer(path:string,content:string):void{
  const key=this.key(path),file=this.files.get(key);if(!file)throw new Error('Server file must have been opened before offline editing');
  this.files.set(key,{...file,content,pending:true});
 }
 acceptServer(path:string,content:string,rev:number):void{
  if(!Number.isSafeInteger(rev)||rev<0)throw new Error('Invalid revision');
  const key=this.key(path),file=this.files.get(key);
  if(file?.pending){if(rev!==file.base)this.files.set(key,{...file,conflict:{content,rev}});return;}
  this.files.set(key,{path,base:rev,content,pending:false});
 }
 acknowledgeServer(path:string,content:string,base:number,rev:number):void{
  const key=this.key(path),file=this.files.get(key);
  if(!Number.isSafeInteger(rev)||rev<=base)throw new Error('Invalid acknowledgement revision');
  if(!file||!file.pending||file.base!==base||file.conflict)throw new Error('Stale or conflicting acknowledgement');
  this.files.set(key,{...file,base:rev,pending:file.content!==content});
 }
 serverFile(path:string):CachedServerFile|undefined{const file=this.files.get(this.key(path));return file?structuredClone(file):undefined;}
 private movedKey(scope:MountScope,id:string):string{const s=checked(scope);if(s.kind!=='server'||!id)throw new Error('Invalid moved-file identity');return JSON.stringify([s.kind,s.origin,s.account,s.workspace,id]);}
 rememberMovedServerFile(file:MovedServerFile):void{
  const origin=checked(file.origin);if(origin.kind!=='server'||file.state!=='moved-away'||!Number.isSafeInteger(file.revision)||file.revision<0||typeof file.bytes!=='string')throw new Error('Invalid moved-file receipt');
  const key=this.movedKey(origin,file.id);const old=this.moved.get(key);
  if(old&&old.path!==file.path)throw new Error('Moved-file identity collision');
  this.moved.set(key,structuredClone({...file,origin}));
 }
 updateMovedServerFile(file:MovedServerFile):void{const key=this.movedKey(file.origin,file.id);if(!this.moved.has(key))throw new Error('Unknown moved-file identity');const origin=checked(file.origin);if(origin.kind!=='server'||file.state!=='moved-away'||!Number.isSafeInteger(file.revision)||file.revision<0||typeof file.bytes!=='string')throw new Error('Invalid moved-file receipt');this.moved.set(key,structuredClone({...file,origin}));}
 findMovedServerFile(scope:MountScope,id:string):MovedServerFile|undefined{const file=this.moved.get(this.movedKey(scope,id));return file?structuredClone(file):undefined;}
 /** Classifies an explicit return using the origin-scoped stable ID and exact acknowledged revision.
  * A match never authorizes a write; callers must resolve conflicts or explicitly transfer. */
 checkMovedReturn(scope:MountScope,id:string,server:ServerReturnSnapshot):MovedReturnCheck{
  const receipt=this.findMovedServerFile(scope,id);if(!receipt)return {kind:'unmatched'};
  if(server.id!==receipt.id)return {kind:'collision'};
  if(!validSnapshot(server))throw new Error('Invalid Server return snapshot');
  if(server.deleted)return {kind:'conflict',reason:'server-deleted',serverPath:server.path,revision:server.revision,localBytes:receipt.bytes,serverBytes:server.bytes};
  if(server.revision===receipt.revision&&server.bytes===receipt.bytes)return {kind:'unchanged',serverPath:server.path,revision:server.revision};
  return {kind:'conflict',reason:'remote-edited',serverPath:server.path,revision:server.revision,localBytes:receipt.bytes,serverBytes:server.bytes};
 }
 pending(scope:MountScope):{path:string;base:number;content:string}[]{
  const s=checked(scope);return [...this.files.entries()].filter(([key,file])=>file.pending&&!file.conflict&&key===scopeKey(s,file.path)).map(([,file])=>({path:file.path,base:file.base,content:file.content}));
 }
 serialize():string{return JSON.stringify({version:2,local:this.local,server:this.server,files:[...this.files.entries()],moved:[...this.moved.entries()]});}
 static restore(serialized:string):MountedWorkspace{
  const data=JSON.parse(serialized);if(![1,2].includes(data.version)||!Array.isArray(data.files)||(data.version===2&&!Array.isArray(data.moved)))throw new Error('Invalid mounted cache');
  const state=new MountedWorkspace(data.local);if(data.server)state.connect(data.server);
  for(const [key,file] of data.files){
   const tuple=JSON.parse(key);if(!Array.isArray(tuple)||tuple.length!==5)throw new Error('Invalid cache identity');
   const [kind,origin,account,workspace,path]=tuple;
   if(kind!=='server'||key!==scopeKey({kind,origin,account,workspace},path)||file.path!==path||typeof file.content!=='string'||typeof file.pending!=='boolean'||!Number.isSafeInteger(file.base)||file.base<0||
    (file.conflict&&(typeof file.conflict.content!=='string'||!Number.isSafeInteger(file.conflict.rev)||file.conflict.rev<0)))throw new Error('Invalid cached file');
   state.files.set(key,structuredClone(file));
  }
  // Version 1 clients had no durable provenance: deliberately do not infer it by path.
  for(const [key,file] of data.moved??[]){const origin=checked(file.origin);if(origin.kind!=='server'||key!==state.movedKey(origin,file.id)||file.state!=='moved-away'||typeof file.path!=='string'||typeof file.bytes!=='string'||!Number.isSafeInteger(file.revision)||file.revision<0)throw new Error('Invalid moved-file receipt');state.moved.set(key,structuredClone(file));}
  return state;
 }
}
