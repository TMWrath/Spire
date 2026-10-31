import {metadata,noteNavigation,type Note} from '../shared/model';
import {buildGraph} from './mind-map-model';
import {citations,type Source} from '../shared/sources';
// Per-workspace, bounded to the four sidebar modes. Compare source values rather
// than snapshot identity: polling can replace unchanged Note objects.
export function createSidebarGraphCache(){
 const cache=new Map<string,{files:Note[];templates:MapTemplate[];sources:Source[];graph:ReturnType<typeof buildSidebarGraph>}>();
 return (files:Note[],templates:MapTemplate[],tab:'files'|'tags'|'templates'|'sources',sources:Source[]=[])=>{
  const previous=cache.get(tab);
  const sameFiles=previous&&files.length===previous.files.length&&files.every((n,i)=>{const p=previous.files[i];return n.id===p.id&&n.path===p.path&&(n.contentLoaded===false&&p.contentLoaded===false||n.content===p.content)&&n.rev===p.rev&&n.time===p.time&&n.deleted===p.deleted&&JSON.stringify(n.navigation)===JSON.stringify(p.navigation)&&JSON.stringify(n.templateIds)===JSON.stringify(p.templateIds);});
  const sameTemplates=tab!=='templates'||JSON.stringify(templates.map(t=>[t.id,t.title]))===JSON.stringify(previous?.templates.map(t=>[t.id,t.title]));
  const sameSources=tab!=='sources'||JSON.stringify(sources.map(s=>[s.id,s.title]))===JSON.stringify(previous?.sources.map(s=>[s.id,s.title]));
  if(previous&&sameFiles&&sameTemplates&&sameSources)return previous.graph;
  const graph=buildSidebarGraph(files,templates,tab,sources);
  cache.set(tab,{files:files.map(n=>({...n,templateIds:n.templateIds?.slice()})),templates:templates.map(t=>({...t})),sources:sources.map(s=>({...s})),graph});
  return graph;
 };
}
export type MapTemplate={id:string;title:string;category:'section'|'full';content:string};
export function buildSidebarGraph(files:Note[],templates:MapTemplate[],tab:'files'|'tags'|'templates'|'sources',sources:Source[]=[]){
 const active=files.filter(n=>!n.deleted);
 if(tab==='files')return buildGraph(active);
 const edges:{source:string;target:string}[]=[];
 if(tab==='sources'){
  const nodes:Note[]=sources.map(s=>({id:'source:'+s.id,path:s.title+'.md',content:'',rev:0,time:'',deleted:false,history:[]}));
  const known=new Set(sources.map(s=>s.id));
  for(const n of active)for(const id of new Set(citations(n.content).map(c=>c.sourceId)))if(known.has(id))edges.push({source:'source:'+id,target:n.id});
  const used=new Set(edges.map(e=>e.target));nodes.push(...active.filter(n=>used.has(n.id)));return {nodes,edges};
 }
 if(tab==='tags'){
  const groups=new Map<string,string[]>(),seen=new Set<string>();
  for(const n of active)for(const tag of noteNavigation(n).tags){const group=groups.get(tag)??[];group.push(n.id);groups.set(tag,group);}
  for(const group of groups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const pair=[group[i],group[j]].sort();const key=JSON.stringify(pair);if(!seen.has(key)){seen.add(key);edges.push({source:pair[0],target:pair[1]});}}
  return {nodes:active,edges};
 }
 const nodes:Note[]=templates.map(t=>({id:'template:'+t.id,path:t.title+'.md',content:'',rev:0,time:'',deleted:false,history:[]}));
 const known=new Set(templates.map(t=>t.id));
 for(const n of active)for(const id of new Set(n.templateIds??[]))if(known.has(id))edges.push({source:'template:'+id,target:n.id});
 const used=new Set(edges.map(e=>e.target));nodes.push(...active.filter(n=>used.has(n.id)));
 return {nodes,edges};
}
