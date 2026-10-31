import {isMap,parseDocument} from 'yaml';
import {hasPage,readPage,writePage} from './page-layout';

export type DocumentDefinition={term:string;definition:string};
const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const begin='<!-- spire:definitions -->';
const end='<!-- /spire:definitions -->';

function normalized(value:unknown):DocumentDefinition[]{
 if(!Array.isArray(value))return [];
 const entries:DocumentDefinition[]=[];
 for(const item of value){
  if(!item||typeof item!=='object')continue;
  const term=String((item as Record<string,unknown>).term??'').trim();
  const definition=String((item as Record<string,unknown>).definition??'').trim();
  if(term&&definition&&!entries.some(entry=>entry.term.localeCompare(term,undefined,{sensitivity:'accent'})===0))entries.push({term,definition});
 }
 return entries;
}
function split(content:string){
 const match=front.exec(content),doc=parseDocument(match?.[1]??'');
 if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix invalid YAML before editing definitions.');
 return {match,doc,body:match?content.slice(match[0].length):content};
}
function stripGenerated(body:string){
 const start=body.lastIndexOf(begin);if(start<0)return body;
 const finish=body.indexOf(end,start);if(finish<0)throw new Error('Definitions page boundary is incomplete. Restore its closing comment in Source.');
 const before=body.slice(0,start).replace(/\n\n$/,'');
 const after=body.slice(finish+end.length).replace(/^\n\n/,'');
 return before+(before&&after?'\n\n':'')+after;
}
function page(entries:DocumentDefinition[]){return `${begin}\n# Definitions\n\n${entries.map(entry=>`## ${entry.term}\n${entry.definition}`).join('\n\n')}\n${end}`;}
function serialize(content:string,entries:DocumentDefinition[],enabled:boolean){
 const {doc}=split(content);doc.set('spire_definitions',entries);doc.set('spire_definitions_page',enabled);
 let base=`---\n${doc.toString()}---\n`+(front.test(content)?content.slice(front.exec(content)![0].length):content);
 if(hasPage(base)){
  const layout=readPage(base);layout.body=stripGenerated(layout.body);
  if(enabled&&entries.length)layout.body+=(layout.body?'\n\n':'')+page(entries);
  return writePage(base,layout);
 }
 let body=stripGenerated(base.slice(front.exec(base)![0].length));
 if(enabled&&entries.length)body+=(body?'\n\n':'')+page(entries);
 return `---\n${doc.toString()}---\n${body}`;
}
export function readDocumentDefinitions(content:string){const {doc}=split(content);return normalized((doc.toJSON() as Record<string,unknown>|null)?.spire_definitions);}
export function definitionsPageEnabled(content:string){const {doc}=split(content);return (doc.toJSON() as Record<string,unknown>|null)?.spire_definitions_page===true;}
export function upsertDocumentDefinition(content:string,rawTerm:string,rawDefinition:string){
 const term=rawTerm.trim(),definition=rawDefinition.trim();if(!term||/[\r\n]/.test(term))throw new Error('Enter a single-line word or term.');if(!definition)throw new Error('Enter a definition.');
 const entries=readDocumentDefinitions(content),index=entries.findIndex(entry=>entry.term.localeCompare(term,undefined,{sensitivity:'accent'})===0);
 if(index>=0)entries[index]={term:entries[index].term,definition};else entries.push({term,definition});
 return serialize(content,entries,definitionsPageEnabled(content));
}
export function setDefinitionsPageEnabled(content:string,enabled:boolean){return serialize(content,readDocumentDefinitions(content),enabled);}
