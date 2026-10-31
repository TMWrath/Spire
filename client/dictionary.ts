import {metadata,type Note} from '../shared/model';
import {headingId,tableOfContents} from './table-of-contents';

export type DictionaryEntry={term:string;anchor:string;definition:string};

export function isDictionary(note:Note){
 return !note.deleted&&String(metadata(note.content).properties.spire_type??'').trim().toLowerCase()==='dictionary';
}

export function dictionaryFiles(notes:Note[]){return notes.filter(isDictionary).sort((a,b)=>a.path.localeCompare(b.path));}

export function dictionaryEntries(note:Note):DictionaryEntry[]{
 if(!isDictionary(note))return [];
 const body=metadata(note.content).body,lines=body.split(/\r?\n/),headings=tableOfContents(body);
 const titleLevel=headings[0]?.level??0;const entryLevel=headings.find((heading,index)=>index>0&&heading.level>titleLevel)?.level??titleLevel+1;
 const entries:DictionaryEntry[]=[];let headingIndex=0;
 for(let i=0;i<lines.length;i++){
  const match=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);if(!match)continue;
  const heading=headings[headingIndex++];if(!heading)continue;
  const level=match[1].length;if(entries.length===0&&level===titleLevel)continue;
  if(level!==entryLevel)continue;
  let end=i+1;while(end<lines.length){const next=/^(#{1,6})\s+/.exec(lines[end]);if(next&&next[1].length<=level)break;end++;}
  entries.push({term:heading.text.trim(),anchor:heading.id||headingId(heading.text),definition:lines.slice(i+1,end).join('\n').trim()});
 }
 return entries;
}

export function relativeTermTarget(fromPath:string,toPath:string,anchor:string){
 const from=fromPath.split('/').slice(0,-1),to=toPath.split('/');let shared=0;
 while(shared<from.length&&shared<to.length&&from[shared]===to[shared])shared++;
 return [...Array(from.length-shared).fill('..'),...to.slice(shared)].join('/')+'#'+anchor;
}

export function termLinkMarkdown(label:string,target:string){
 const safeLabel=label.replace(/\\/g,'\\\\').replace(/([\[\]])/g,'\\$1').replace(/[\r\n]+/g,' ').trim();
 return `[${safeLabel}](${encodeURI(target).replace(/\(/g,'%28').replace(/\)/g,'%29')})`;
}

export function dictionaryPageMarkdown(title:string){
 const clean=title.trim().replace(/[\r\n]+/g,' ');if(!clean)throw new Error('Enter a dictionary page name.');
 return `---\nspire_type: dictionary\n---\n\n# ${clean}\n`;
}

export function appendDictionaryEntry(content:string,term:string,definition:string){
 const cleanTerm=term.trim();if(!cleanTerm)throw new Error('Enter a word or term.');if(/[\r\n]/.test(cleanTerm))throw new Error('A term must stay on a single line.');
 const file={id:'dictionary',path:'Dictionary.md',content,rev:0,deleted:false,time:'',history:[]} as Note;
 if(dictionaryEntries(file).some(entry=>headingId(entry.term)===headingId(cleanTerm)))throw new Error('That term already exists in this dictionary.');
 const cleanDefinition=definition.trim();if(!cleanDefinition)throw new Error('Enter a definition.');
 return content.replace(/\s*$/,'')+`\n\n## ${cleanTerm}\n${cleanDefinition}\n`;
}

export function dictionaryEntryForLink(source:Note,target:string,heading:string,notes:Note[]){
 const clean=target.replace(/\.md$/i,'').toLowerCase(),parts=source.path.split('/').slice(0,-1);
 for(const p of target.split('/')){if(p==='..')parts.pop();else if(p!=='.')parts.push(p);}
 const relative=parts.join('/').replace(/\.md$/i,'').toLowerCase();
 const file=dictionaryFiles(notes).find(n=>n.path.replace(/\.md$/i,'').toLowerCase()===relative||n.path.replace(/\.md$/i,'').toLowerCase()===clean);
 if(!file)return null;const entry=dictionaryEntries(file).find(e=>e.anchor===heading||headingId(e.term)===headingId(heading));
 return entry?{file,entry}:null;
}
