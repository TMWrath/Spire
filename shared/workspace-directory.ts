import type {Revision} from './model';
/** Navigation records deliberately cannot carry document bodies or history. */
export type DirectoryFile=Pick<Revision,'rev'|'path'|'deleted'|'time'|'templateIds'>&{id:string;navigation?:import('./model').NavigationIndex};
export type WorkspaceDirectory={version:1;seq:number;files:DirectoryFile[];folders:string[];attachments:{path:string}[]};
type DirectoryState={seq:number;notes:Record<string,DirectoryFile>;folders?:string[];attachments:{path:string}[]};
export function workspaceDirectory(state:DirectoryState):WorkspaceDirectory{
 return {version:1,seq:state.seq,files:Object.values(state.notes).map(n=>({id:n.id,path:n.path,rev:n.rev,deleted:n.deleted,time:n.time,...(n.navigation?{navigation:structuredClone(n.navigation)}:{}),...(n.templateIds?{templateIds:[...n.templateIds]}:{})})),folders:[...(state.folders??[])],attachments:state.attachments.map(a=>({path:a.path}))};
}
export type OpenedFile=DirectoryFile&{content:string};
type Readers={file:(id:string)=>Promise<OpenedFile>;history:(id:string)=>Promise<Revision[]>};
/** One instance per workspace. Unloaded content is absence, never an empty string. */
export class DirectoryReader{
 private files=new Map<string,DirectoryFile>();
 private pending=new Map<string,Promise<OpenedFile>>();
 private histories=new Map<string,Promise<Revision[]>>();
 private generation=0;
 constructor(directory:WorkspaceDirectory,private readers:Readers){this.replace(directory);}
 replace(directory:WorkspaceDirectory){
  const files=new Map(directory.files.map(f=>[f.id,f]));
  if(files.size!==directory.files.length)throw Error('Duplicate file identity');
  this.files=files;this.generation++;this.pending.clear();this.histories.clear();
 }
 private current(id:string){const n=this.files.get(id);if(!n||n.deleted)throw Error('File unavailable');return n;}
 async open(id:string):Promise<OpenedFile>{
  const expected=this.current(id),generation=this.generation;
  let pending=this.pending.get(id);
  if(!pending){
   pending=Promise.resolve().then(()=>this.readers.file(id)).then(file=>{
    if(generation!==this.generation||file.id!==expected.id||file.path!==expected.path||file.rev!==expected.rev||file.deleted!==expected.deleted)throw Error('File changed while opening; refresh its directory entry');
    return file;
   });
   this.pending.set(id,pending);
   void pending.catch(()=>{if(this.pending.get(id)===pending)this.pending.delete(id);});
  }
  return pending;
 }
 async history(id:string):Promise<Revision[]>{
  this.current(id);const generation=this.generation;let pending=this.histories.get(id);
  if(!pending){
   pending=Promise.resolve().then(()=>this.readers.history(id)).then(history=>{if(generation!==this.generation)throw Error('File changed while loading history');return history;});
   this.histories.set(id,pending);void pending.catch(()=>{if(this.histories.get(id)===pending)this.histories.delete(id);});
  }
  return pending;
 }
}
