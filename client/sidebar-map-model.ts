import {metadata,type Note} from '../shared/model';
import {buildGraph} from './mind-map-model';
export type MapTemplate={id:string;title:string;category:'section'|'full';content:string};
export function buildSidebarGraph(files:Note[],templates:MapTemplate[],tab:'files'|'tags'|'templates'){
 const active=files.filter(n=>!n.deleted);
 if(tab==='files')return buildGraph(active);
 const edges:{source:string;target:string}[]=[];
 if(tab==='tags'){
  const groups=new Map<string,string[]>(),seen=new Set<string>();
  for(const n of active)for(const tag of metadata(n.content).tags){const group=groups.get(tag)??[];group.push(n.id);groups.set(tag,group);}
  for(const group of groups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const pair=[group[i],group[j]].sort();const key=JSON.stringify(pair);if(!seen.has(key)){seen.add(key);edges.push({source:pair[0],target:pair[1]});}}
  return {nodes:active,edges};
 }
 const nodes:Note[]=templates.map(t=>({id:'template:'+t.id,path:t.title+'.md',content:'',rev:0,time:'',deleted:false,history:[]}));
 const known=new Set(templates.map(t=>t.id));
 for(const n of active)for(const id of new Set(n.templateIds??[]))if(known.has(id))edges.push({source:'template:'+id,target:n.id});
 const used=new Set(edges.map(e=>e.target));nodes.push(...active.filter(n=>used.has(n.id)));
 return {nodes,edges};
}
