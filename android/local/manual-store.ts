import fs from 'node:fs';
import path from 'node:path';
import {Store,HttpError} from '../vendor/server/store';
import type {State} from '../vendor/shared/model';

// Android's direct provider commit validates affected source/destination paths and
// stages real writes. Do not run the server's full-vault journal/materialization
// cycle against the browser's in-memory filesystem for each file-browser action.
export function useManualCommits(store:Store){
 store.commit=(next:State)=>{
  if(store.poisoned)throw new HttpError(503,'Storage recovery required');
  const before=store.state;
  // Keep textual values textual while finding the write set. Encoding every note
  // merely to discover that one note changed made saves scale with vault bytes.
  const entries=(state:State)=>new Map<string,{kind:'text'|'base64';data:string}>([
   ...Object.values(state.notes).filter(n=>!n.deleted).map(n=>[n.path,{kind:'text' as const,data:n.content}] as const),
   ...Object.entries(state.styles??{}).map(([p,c])=>[p,{kind:'text' as const,data:c}] as const),
   ...state.attachments.map(a=>[a.path,{kind:'base64' as const,data:a.data}] as const)
  ]);
  const old=entries(before),after=entries(next),same=(a:any,b:any)=>a?.kind===b?.kind&&a?.data===b?.data;
  const changed=[...new Set([...old.keys(),...after.keys()])].filter(p=>!same(old.get(p),after.get(p)));
  // Validate the complete affected set before mutating even the memory view.
  for(const p of changed){
   const full=store.vault(p),prior=old.get(p);
   if(prior!==undefined){const expected=prior.kind==='base64'?Buffer.from(prior.data,'base64'):Buffer.from(prior.data);if(!fs.existsSync(full)||!fs.readFileSync(full).equals(expected))throw new HttpError(409,'Source changed; operation refused: '+p);}
   else if(fs.existsSync(full))throw new HttpError(409,'Destination already exists: '+p);
  }
  const folders=new Set(next.folders??[]);
  for(const p of [...folders,...after.keys()]){let parent=path.dirname(p);while(parent!=='.'){folders.add(parent);parent=path.dirname(parent);}}
  next.folders=[...folders];
  const oldFolders=new Set(before.folders??[]);
  for(const folder of next.folders??[])if(!oldFolders.has(folder)){
   const full=store.vault(folder);if(fs.existsSync(full)&&!fs.statSync(full).isDirectory())throw new HttpError(409,'Folder path occupied: '+folder);
  }
  // Store.revise already appended the prior revision. Preserve that complete
  // history in the manual commit; replacing it with the pre-mutation array makes
  // every edit compare against the original imported file instead of the last save.
  for(const n of Object.values(next.notes))n.history=[...n.history];
  for(const folder of next.folders??[])if(!oldFolders.has(folder))fs.mkdirSync(store.vault(folder),{recursive:true});
  for(const p of changed){const full=store.vault(p),entry=after.get(p);if(entry!==undefined){fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,entry.kind==='base64'?Buffer.from(entry.data,'base64'):Buffer.from(entry.data));}else fs.unlinkSync(full);}
  fs.writeFileSync(store.file('state.json'),JSON.stringify(store.metadataState(next)));
  store.state=next;
 };
 return store;
}
