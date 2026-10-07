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
export function graphLayout(nodes:Note[],edges:{source:string;target:string}[]){
 const degree=new Map<string,number>();for(const e of edges){degree.set(e.source,(degree.get(e.source)??0)+1);degree.set(e.target,(degree.get(e.target)??0)+1);}
 const sorted=[...nodes].sort((a,b)=>(degree.get(b.id)??0)-(degree.get(a.id)??0)||a.path.localeCompare(b.path));
 // Stable, spaced phyllotaxis avoids costly per-frame force simulation on phones.
 return new Map(sorted.map((n,i)=>{const angle=i*2.399963229728653;const radius=155*Math.sqrt(i);return[n.id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius}];}));
}
