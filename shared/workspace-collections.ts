import {isMap,parseDocument} from 'yaml';
import {metadata,type Attachment,type Note} from './model';

export type CollectionScope={kind:'all'}|{kind:'files'}|{kind:'project';project:string};
export type WorkspaceTask={noteId:string;path:string;folder:string;group:string;text:string;checked:boolean;markerOffset:number};
export type WorkspaceImage={noteId:string;notePath:string;path:string;alt:string;tags:string[]};

const inScope=(path:string,scope:CollectionScope)=>scope.kind==='all'||(scope.kind==='files'?!path.startsWith('Projects/'):path.startsWith(`Projects/${scope.project}/`));
const folderOf=(path:string)=>path.includes('/')?path.slice(0,path.lastIndexOf('/')):'Root';

export function collectTasks(notes:Note[],scope:CollectionScope):WorkspaceTask[]{
 const tasks:WorkspaceTask[]=[];
 for(const note of notes){
  if(note.deleted||!inScope(note.path,scope))continue;
  let group='Ungrouped';
  let offset=0;
  for(const line of note.content.split(/(?<=\n)/)){
   const heading=/^#{1,6}\s+(.+?)\s*$/.exec(line.trimEnd());
   if(heading)group=heading[1];
   const task=/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line.trimEnd());
   if(task){const bracket=line.indexOf('[');tasks.push({noteId:note.id,path:note.path,folder:folderOf(note.path),group,text:task[2],checked:task[1].toLowerCase()==='x',markerOffset:offset+bracket});}
   offset+=line.length;
  }
 }
 return tasks;
}

function resolvePath(notePath:string,raw:string):string|null{
 let value=raw.trim().replace(/^<|>$/g,'');
 try{value=decodeURI(value);}catch{}
 if(!value||/^(?:[a-z][a-z\d+.-]*:|\/\/|data:|blob:|#)/i.test(value))return null;
 if(value.startsWith('/api/attachment?'))value=new URL(value,'https://spire.invalid').searchParams.get('path')??'';
 const parts=value.startsWith('/')?[]:notePath.split('/').slice(0,-1);
 for(const part of value.replace(/^\//,'').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
 return parts.join('/');
}

const list=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):typeof value==='string'?[value]:[];
export function collectImages(notes:Note[],attachments:Pick<Attachment,'path'>[],scope:CollectionScope):WorkspaceImage[]{
 const available=new Set(attachments.filter(item=>/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(item.path)).map(item=>item.path));
 const images:WorkspaceImage[]=[];
 for(const note of notes){
  if(note.deleted||!inScope(note.path,scope))continue;
  const tags=metadata(note.content).properties.spire_image_tags;
  const tagMap=tags&&typeof tags==='object'&&!Array.isArray(tags)?tags as Record<string,unknown>:{};
  const found=new Map<string,string>();
  for(const match of note.content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)){const path=resolvePath(note.path,match[2]);if(path&&available.has(path)&&!found.has(path))found.set(path,match[1]);}
  for(const match of note.content.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)){const path=resolvePath(note.path,match[1]);if(path&&available.has(path)&&!found.has(path)){const alt=/\balt=["']([^"']*)["']/i.exec(match[0])?.[1]??'';found.set(path,alt);}}
  for(const [path,alt] of found)images.push({noteId:note.id,notePath:note.path,path,alt,tags:list(tagMap[path])});
 }
 return images;
}

export function setImageTags(content:string,path:string,tags:string[]):string{
 const match=/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(content);
 const doc=parseDocument(match?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML frontmatter before tagging images.');
 const current=doc.get('spire_image_tags');
 const map=current&&typeof current==='object'&&!Array.isArray(current)?{...(current as Record<string,unknown>)}:{};
 const clean=[...new Set(tags.map(tag=>tag.trim()).filter(Boolean))];
 if(clean.length)map[path]=clean;else delete map[path];
 if(Object.keys(map).length)doc.set('spire_image_tags',map);else doc.delete('spire_image_tags');
 const body=match?content.slice(match[0].length):content;
 return `---\n${doc.toString()}---\n${body}`;
}

export function appendGroupedTask(content:string,group:string,text:string):string{
 const cleanGroup=group.trim()||'Ungrouped',cleanText=text.trim();
 if(!cleanText)throw new Error('Enter a task.');
 const heading=new RegExp(`(^|\\n)(#{1,6})\\s+${cleanGroup.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*(?=\\n|$)`,'i');
 const match=heading.exec(content);
 if(!match)return content.replace(/\s*$/,'')+`\n\n## ${cleanGroup}\n- [ ] ${cleanText}\n`;
 const start=match.index+match[0].length;
 const next=/\n#{1,6}\s+/.exec(content.slice(start));
 const end=next?start+next.index:content.length;
 const section=content.slice(start,end).replace(/\s*$/,'');
 return content.slice(0,start)+section+`\n- [ ] ${cleanText}\n`+content.slice(end).replace(/^\n?/,next?'\n':'');
}
