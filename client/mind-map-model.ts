import {spherePoints} from './mind-camera';
import {files as demoNodes,edges as demoEdges} from './dot-map/demo.mjs';
import {createLinkResolver,metadata,noteNavigation,type Note} from '../shared/model';
export function buildGraph(files:Note[]){
 const nodes=files.filter(n=>!n.deleted),resolve=createLinkResolver(nodes);const edges:{source:string;target:string}[]=[];const seen=new Set<string>();
 for(const file of nodes)for(const link of noteNavigation(file).links){
  const source=resolve(link,file);if(!source||source.id===file.id)continue;
  const key=JSON.stringify([source.id,file.id]);if(seen.has(key))continue;seen.add(key);edges.push({source:source.id,target:file.id});
 }
 return {nodes,edges};
}
export function buildFileSlice(files:Note[],id:string){
 const graph=buildGraph(files);const ids=new Set([id]);const edges=graph.edges.filter(e=>e.source===id||e.target===id);for(const e of edges){ids.add(e.source);ids.add(e.target);}
 return {nodes:graph.nodes.filter(n=>ids.has(n.id)),edges};
}
export type TimelineItem={note:Note;created:string;direction:'incoming'|'outgoing'|'mutual'};
export type TimelineRow={before?:TimelineItem;after?:TimelineItem};
export function buildTimelineRows(past:TimelineItem[],future:TimelineItem[]):TimelineRow[]{
 const before=[...past].reverse(),length=Math.max(before.length,future.length,1);
 return Array.from({length},(_,index)=>({before:before[index],after:future[index]}));
}
const created=(note:Note)=>note.history[0]?.time||note.time||'';
const textList=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):typeof value==='string'?[value]:[];
export function buildTimeline(files:Note[],currentId:string){
 const graph=buildGraph(files),current=graph.nodes.find(note=>note.id===currentId);
 if(!current)return null;
 const related=new Map<string,{incoming:boolean;outgoing:boolean}>();
 for(const edge of graph.edges){
  if(edge.target===currentId){const relation=related.get(edge.source)??{incoming:false,outgoing:false};relation.outgoing=true;related.set(edge.source,relation);}
  if(edge.source===currentId){const relation=related.get(edge.target)??{incoming:false,outgoing:false};relation.incoming=true;related.set(edge.target,relation);}
 }
 const currentCreated=created(current);
 const items=[...related].flatMap(([id,relation])=>{const note=graph.nodes.find(candidate=>candidate.id===id);if(!note)return[];return [{note,created:created(note),direction:relation.incoming&&relation.outgoing?'mutual':relation.incoming?'incoming':'outgoing'} as TimelineItem];}).sort((a,b)=>a.created.localeCompare(b.created)||a.note.path.localeCompare(b.note.path)||a.note.id.localeCompare(b.note.id));
 const topicSet=new Set<string>();
 for(const note of [current,...items.map(item=>item.note)]){
  const navigation=noteNavigation(note);for(const tag of navigation.tags)topicSet.add(tag);
  if(note.contentLoaded===false)continue;
  const properties=metadata(note.content).properties;
  for(const topic of [...textList(properties.topic),...textList(properties.topics)])topicSet.add(topic);
 }
 return {current:{id:current.id,note:current,created:currentCreated},past:items.filter(item=>item.created<currentCreated),future:items.filter(item=>item.created>=currentCreated),topics:[...topicSet].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}))};
}
export const demoFiles:Note[]=demoNodes.map(file=>({...file,content:demoEdges.filter(e=>e.target===file.id).map(e=>`[[${demoNodes.find(n=>n.id===e.source)!.name}]]`).join('\n'),rev:1,deleted:false,history:[],time:''}));
export function graphLayout(nodes:Note[],_edges:{source:string;target:string}[],radius=300){
 // Fibonacci points spread files across a true sphere without a per-frame force simulation.
 const points=spherePoints(nodes.length,radius);
 return new Map(nodes.map((n,i)=>[n.id,points[i]]));
}
