import {mergeMarkdown,type MergeResult} from '../shared/markdown-sync';
import {contentFingerprint} from '../shared/workspace-index';
import type {Note} from '../shared/model';
import type {Snapshot} from './sync';
import {samePublication} from './publication-state';
/** Revision counters/hydration are transport metadata, not authored changes. */
export function samePublishedNote(a:Note|undefined,b:Note|undefined):boolean{
 if(!a||!b)return a===b;
 if(a.contentLoaded===false||b.contentLoaded===false)return false;
 return a.id===b.id&&a.path===b.path&&a.content===b.content&&a.deleted===b.deleted&&samePublication(a.templateIds??[],b.templateIds??[]);
}
/** A per-file common base: a conflict never acknowledges either unreviewed side. */
export function planPublication(local:Snapshot,base:Snapshot,server:Snapshot){
 const outgoing=structuredClone(server),baseline=structuredClone(base),pulls:Note[]=[],conflicts:string[]=[];
 const l=new Map(local.notes.map(n=>[n.id,n])),b=new Map(base.notes.map(n=>[n.id,n])),s=new Map(server.notes.map(n=>[n.id,n]));
 const uploaded=new Map<string,Note>(),ack=new Map<string,Note>(),reviews=new Map<string,MergeResult>();
 for(const id of new Set([...b.keys(),...l.keys(),...s.keys()])){
  const a=l.get(id),old=b.get(id),remote=s.get(id);
  if(a?.contentLoaded===false||remote?.contentLoaded===false){conflicts.push(id);continue;}
  if(samePublishedNote(a,remote)){if(a)ack.set(id,a);continue;}
  // Missing index entries are unknown, not deletion tombstones.
  if(old&&(!a||!remote)){conflicts.push(id);continue;}
  if(samePublishedNote(remote,old)&&a){
   // Never discard Server-retained history as collateral of a body upload.
   const history=structuredClone(remote?.history??[]),parents=new Map([...(remote?.mergeParents??[]),...(a.mergeParents??[])].map(v=>[v.hash,v]));
   for(const revision of a.history??[]){
    const same=history.find(h=>h.rev===revision.rev);
    if(same&&!samePublication(same,revision))for(const version of [same,revision]){const hash=contentFingerprint(JSON.stringify(version));parents.set(hash,{hash,revision:structuredClone(version)});}
    if(!same)history.push(structuredClone(revision));
   }
   uploaded.set(id,{...a,history:history.sort((x,y)=>x.rev-y.rev),...(parents.size?{mergeParents:[...parents.values()]}:{})});continue;
  }
  if(samePublishedNote(a,old)&&remote){pulls.push(remote);continue;}
  if(a&&old&&remote&&!a.deleted&&!remote.deleted){
   const choose=(local:unknown,ancestor:unknown,server:unknown)=>samePublication(local,server)||samePublication(server,ancestor)?{ok:true,value:local}:samePublication(local,ancestor)?{ok:true,value:server}:{ok:false,value:undefined};
   const path=choose(a.path,old.path,remote.path),templates=choose(a.templateIds??[],old.templateIds??[],remote.templateIds??[]);
   const result=mergeMarkdown(old.content,a.content,remote.content);reviews.set(id,result);
   if(path.ok&&templates.ok&&result.clean){
    const parents=new Map((remote.mergeParents??[]).map(v=>[v.hash,v]));
    for(const n of [old,a,remote])for(const revision of [...n.history,n]){const {rev,path,content,deleted,time,templateIds}=revision;const version={rev,path,content,deleted,time,templateIds};const hash=contentFingerprint(JSON.stringify(version));parents.set(hash,{hash,revision:version});}
    const merged:Note={...remote,path:path.value as string,templateIds:templates.value as string[],content:result.content!,rev:Math.max(a.rev,remote.rev)+1,mergeParents:[...parents.values()]};
    if(!samePublishedNote(merged,remote))uploaded.set(id,merged);
    if(!samePublishedNote(merged,a))pulls.push(merged);
    continue;
   }
  }
  conflicts.push(id);
 }
 // Validate both projected destinations. Reject only the operations that collide.
 let changed=true;
 while(changed){changed=false;
  for(const [original,updates] of [[server.notes,[...uploaded.values()]],[local.notes,pulls]] as const){
   const changes=new Map(updates.map(n=>[n.id,n])),projected=[...original.filter(n=>!changes.has(n.id)),...changes.values()].filter(n=>!n.deleted);
   const bad=new Set<string>();for(const a of projected)for(const z of projected)if(a.id!==z.id){const p=a.path.toLowerCase(),q=z.path.toLowerCase();if(p===q||p.startsWith(q+'/')||q.startsWith(p+'/')){bad.add(a.id);bad.add(z.id);}}
   for(const id of bad){if(changes.has(id)){uploaded.delete(id);const i=pulls.findIndex(n=>n.id===id);if(i>=0)pulls.splice(i,1);if(!conflicts.includes(id))conflicts.push(id);changed=true;}}
  }
 }
 outgoing.notes=[...server.notes.map(n=>uploaded.get(n.id)??n),...[...uploaded.values()].filter(n=>!s.has(n.id))];
 for(const [id,n] of uploaded)if(!pulls.some(p=>p.id===id))ack.set(id,n);
 baseline.notes=[...base.notes.map(n=>ack.get(n.id)??n),...[...ack.values()].filter(n=>!b.has(n.id))];
 let upload=uploaded.size>0;
 // Structural changes require their own common base; never replace remote-only
 // structures as collateral damage of an unrelated body upload.
 for(const field of new Set([...Object.keys(local),...Object.keys(base),...Object.keys(server)])){
  if(field==='notes'||field==='seq')continue;
  const a=(local as any)[field],old=(base as any)[field],r=(server as any)[field];
  if(samePublication(a,r)){(baseline as any)[field]=structuredClone(a);}
  else if(samePublication(r,old)){(outgoing as any)[field]=structuredClone(a);(baseline as any)[field]=structuredClone(a);upload=true;}
  else conflicts.push('workspace:'+field);
 }
 if(upload)outgoing.seq=Math.max(local.seq,server.seq)+1;
 return {outgoing,baseline,pulls,conflicts,upload,reviews};
}
