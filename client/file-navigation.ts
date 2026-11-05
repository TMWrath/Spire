import type {Note} from '../shared/model';

export type FileNavigationProjection={
 filtered:Note[];
 allFolders:string[];
 folders:string[];
 filesByFolder:Map<string,Note[]>;
 foldersByParent:Map<string,string[]>;
};

const parentFolder=(path:string)=>path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';

/**
 * Builds the sidebar projection in one pass over files. Empty-query navigation
 * deliberately never scans file bodies; only an active search inspects content.
 */
export function projectFileNavigation(notes:Note[],explicitFolders:string[],trash:boolean,query:string):FileNavigationProjection{
 const needle=query.trim().toLocaleLowerCase();
 const filtered:Note[]=[];
 const filesByFolder=new Map<string,Note[]>();
 const visibleFolders=new Set(trash?[]:explicitFolders);
 for(const note of notes){
  if(note.deleted!==trash)continue;
  if(needle&&!`${note.path}\n${note.content}`.toLocaleLowerCase().includes(needle))continue;
  filtered.push(note);
 }
 filtered.sort((a,b)=>a.path.localeCompare(b.path));
 for(const note of filtered){
  const folder=parentFolder(note.path);
  if(folder){
   visibleFolders.add(folder);
   const files=filesByFolder.get(folder);
   if(files)files.push(note);else filesByFolder.set(folder,[note]);
  }
 }
 const allFolders=[...new Set([...visibleFolders].flatMap(path=>path.split('/').map((_,index,parts)=>parts.slice(0,index+1).join('/'))))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
 const matches=new Set<string>();
 const includeAncestors=(folder:string)=>{while(folder&&!matches.has(folder)){matches.add(folder);folder=parentFolder(folder);}};
 if(needle){
  for(const folder of filesByFolder.keys())includeAncestors(folder);
  for(const folder of allFolders)if(folder.toLocaleLowerCase().includes(needle))includeAncestors(folder);
 }
 const folders=needle?allFolders.filter(folder=>matches.has(folder)):allFolders;
 const foldersByParent=new Map<string,string[]>();
 for(const folder of folders){const parent=parentFolder(folder),children=foldersByParent.get(parent);if(children)children.push(folder);else foldersByParent.set(parent,[folder]);}
 return {filtered,allFolders,folders,filesByFolder,foldersByParent};
}