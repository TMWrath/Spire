import type {Revision} from './model';
/** Navigation records deliberately cannot carry document bodies or history. */
export type DirectoryFile=Pick<Revision,'rev'|'path'|'deleted'|'time'|'templateIds'>&{id:string;navigation?:import('./model').NavigationIndex;createdTime:string;editTimes:string[]};
export type WorkspaceDirectory={version:1;seq:number;files:DirectoryFile[];folders:string[];attachments:{path:string}[]};
type ActivityEvent={seq:number;id:string;rev:number;device:string;time:string};
type DirectoryState={seq:number;notes:Record<string,Omit<DirectoryFile,'createdTime'|'editTimes'>>;folders?:string[];attachments:{path:string}[];events?:ActivityEvent[]};
export function workspaceDirectory(state:DirectoryState):WorkspaceDirectory{
 const activity=new Map<string,ActivityEvent[]>();for(const event of state.events??[]){const list=activity.get(event.id)??[];list.push(event);activity.set(event.id,list);}
 return {version:1,seq:state.seq,files:Object.values(state.notes).map(n=>{const events=(activity.get(n.id)??[]).sort((a,b)=>a.rev-b.rev||a.seq-b.seq),createdTime=events[0]?.time??n.time,editTimes=[...new Set(events.filter(event=>event.rev>1).map(event=>event.time))];return {id:n.id,path:n.path,rev:n.rev,deleted:n.deleted,time:n.time,createdTime,editTimes,...(n.navigation?{navigation:structuredClone(n.navigation)}:{}),...(n.templateIds?{templateIds:[...n.templateIds]}:{})};}),folders:[...(state.folders??[])],attachments:state.attachments.map(a=>({path:a.path}))};
}
export type OpenedFile=Omit<DirectoryFile,'createdTime'|'editTimes'>&{content:string};
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
