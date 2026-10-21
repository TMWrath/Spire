import type {Note} from '../shared/model';

export type FileNavigationProjection={
 filtered:Note[];
 allFolders:string[];
 folders:string[];
 filesByFolder:Map<string,Note[]>;
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
 const matching=needle?allFolders.filter(folder=>folder.toLocaleLowerCase().includes(needle)||filtered.some(note=>note.path.startsWith(folder+'/'))):allFolders;
 const folders=needle?allFolders.filter(folder=>matching.some(match=>match===folder||match.startsWith(folder+'/'))):allFolders;
 return {filtered,allFolders,folders,filesByFolder};
}
