import {spherePoints} from './mind-camera';
import {files as demoNodes,edges as demoEdges} from './dot-map/demo.mjs';
import {links,metadata,resolveLink,type Note} from '../shared/model';
export function buildGraph(files:Note[]){
 const nodes=files.filter(n=>!n.deleted);const edges:{source:string;target:string}[]=[];const seen=new Set<string>();
 for(const file of nodes)for(const link of links(metadata(file.content).body)){
  const source=resolveLink(link,file,nodes);if(!source||source.id===file.id)continue;
  const key=JSON.stringify([source.id,file.id]);if(seen.has(key))continue;seen.add(key);edges.push({source:source.id,target:file.id});
 }
 return {nodes,edges};
}
export function buildFileSlice(files:Note[],id:string){
 const graph=buildGraph(files);const ids=new Set([id]);const edges=graph.edges.filter(e=>e.source===id||e.target===id);for(const e of edges){ids.add(e.source);ids.add(e.target);}
 return {nodes:graph.nodes.filter(n=>ids.has(n.id)),edges};
}
export const demoFiles:Note[]=demoNodes.map(file=>({...file,content:demoEdges.filter(e=>e.target===file.id).map(e=>`[[${demoNodes.find(n=>n.id===e.source)!.name}]]`).join('\n'),rev:1,deleted:false,history:[],time:''}));
export function graphLayout(nodes:Note[],_edges:{source:string;target:string}[],radius=300){
 // Fibonacci points spread files across a true sphere without a per-frame force simulation.
 const points=spherePoints(nodes.length,radius);
 return new Map(nodes.map((n,i)=>[n.id,points[i]]));
}
