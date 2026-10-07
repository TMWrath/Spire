import {spherePoints} from './mind-camera';
import {links,metadata,resolveLink,type Note} from '../shared/model';
export function buildGraph(files:Note[]){
 const nodes=files.filter(n=>!n.deleted);const edges:{source:string;target:string}[]=[];const seen=new Set<string>();
 for(const file of nodes)for(const link of links(metadata(file.content).body)){
  const source=resolveLink(link,file,nodes);if(!source||source.id===file.id)continue;
  const key=JSON.stringify([source.id,file.id]);if(seen.has(key))continue;seen.add(key);edges.push({source:source.id,target:file.id});
 }
 return {nodes,edges};
}
const names=['Origin','Architecture','Fragments','Nightfall','Characters','Worldbuilding','Sound & Motion','The Observatory','Research','Visual Language','Chapter One','Field Journal','Inspiration','Systems','Future Visions','Afterlight'];
export const demoFiles:Note[]=names.map((name,i)=>({id:`demo-${i}`,path:`Demo/${name}.md`,content:[(i+1)%names.length,...(i%2===0?[(i+5)%names.length]:[]),...(i>0&&i%3===0?[0]:[])].map(j=>`[[${names[j]}]]`).join('\n'),rev:1,deleted:false,history:[],time:''}));
export function graphLayout(nodes:Note[],_edges:{source:string;target:string}[],radius=300){
 // Fibonacci points spread files across a true sphere without a per-frame force simulation.
 const points=spherePoints(nodes.length,radius);
 return new Map(nodes.map((n,i)=>[n.id,points[i]]));
}
