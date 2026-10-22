import {diffArrays} from 'diff';
import {z} from 'zod';
import {contentFingerprint} from './workspace-index';
export const textPatchSchema=z.object({version:z.literal(1),baseHash:z.string().regex(/^[a-f0-9]{64}$/),resultHash:z.string().regex(/^[a-f0-9]{64}$/),hunks:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().nonnegative(),lines:z.array(z.string()).max(100000)})).max(100000)});
export type TextPatch=z.infer<typeof textPatchSchema>;
type Hunk=TextPatch['hunks'][number];
export type MergePart={kind:'text';text:string}|{kind:'conflict';base:string;local:string;server:string;start:number;end:number};
export type MergeResult={clean:boolean;content:string|null;parts:MergePart[]};
export type MergeChoice='local'|'server'|'both'|{text:string};
const lines=(text:string)=>text.match(/[^\n]*\n|[^\n]+$/g)??[];
function edits(base:string[],next:string[]):Hunk[]{
 const diff=diffArrays(base,next,{timeout:1000});
 if(!diff)throw Error('File comparison exceeded its budget; manual review required');
 let pos=0,pending:Hunk|undefined;const result:Hunk[]=[];
 for(const part of diff){
  if(!part.added&&!part.removed){if(pending){result.push(pending);pending=undefined;}pos+=part.count;continue;}
  pending??={start:pos,end:pos,lines:[]};
  if(part.removed){pos+=part.count;pending.end=pos;}else pending.lines.push(...part.value);
 }
 if(pending)result.push(pending);return result;
}
export function makeTextPatch(base:string,next:string):TextPatch{return {version:1,baseHash:contentFingerprint(base),resultHash:contentFingerprint(next),hunks:edits(lines(base),lines(next))};}
export function applyTextPatch(base:string,input:TextPatch):string{
 const patch=textPatchSchema.parse(input);if(contentFingerprint(base)!==patch.baseHash)throw Error('Patch base hash mismatch');
 const source=lines(base),out:string[]=[];let cursor=0,previous=-1;
 for(const h of patch.hunks){if(h.start<cursor||h.start<=previous||h.end<h.start||h.end>source.length)throw Error('Invalid patch bounds or overlapping hunks');out.push(...source.slice(cursor,h.start),...h.lines);cursor=h.end;previous=h.start;}
 out.push(...source.slice(cursor));const next=out.join('');if(next.length>1_000_000)throw Error('Patched file is too large');if(contentFingerprint(next)!==patch.resultHash)throw Error('Patch integrity failure');return next;
}
function overlaps(a:Hunk,b:Hunk){
 if(a.start===a.end)return a.start>=b.start&&a.start<=b.end;
 if(b.start===b.end)return b.start>=a.start&&b.start<=a.end;
 return a.start<b.end&&b.start<a.end;
}
export function mergeMarkdown(base:string,local:string,server:string):MergeResult{
 if(local===server||local===base||server===base){const content=local===base?server:local;return {clean:true,content,parts:[{kind:'text',text:content}]};}
 const source=lines(base);let all:(Hunk&{side:'local'|'server'})[];
 try{all=[...edits(source,lines(local)).map(h=>({...h,side:'local' as const})),...edits(source,lines(server)).map(h=>({...h,side:'server' as const}))].sort((a,b)=>a.start-b.start||a.end-b.end);}
 catch{return {clean:false,content:null,parts:[{kind:'conflict',base,local,server,start:0,end:source.length}]};}
 const groups:typeof all[]=[];
 for(const h of all){const last=groups.at(-1);if(last?.some(other=>overlaps(other,h)))last.push(h);else groups.push([h]);}
 const parts:MergePart[]=[];let cursor=0;
 for(const group of groups){const start=Math.min(...group.map(h=>h.start)),end=Math.max(...group.map(h=>h.end));
  if(start>cursor)parts.push({kind:'text',text:source.slice(cursor,start).join('')});
  const original=source.slice(start,end).join('');
  const render=(side:'local'|'server')=>{let p=start,out='';for(const h of group.filter(h=>h.side===side)){out+=source.slice(p,h.start).join('')+h.lines.join('');p=h.end;}return out+source.slice(p,end).join('');};
  const a=render('local'),b=render('server');
  if(a===b||a===original||b===original)parts.push({kind:'text',text:a===original?b:a});
  else parts.push({kind:'conflict',base:original,local:a,server:b,start,end});
  cursor=end;
 }
 parts.push({kind:'text',text:source.slice(cursor).join('')});const clean=parts.every(p=>p.kind==='text');return {clean,parts,content:clean?parts.map(p=>p.kind==='text'?p.text:'').join(''):null};
}
export function resolveMerge(result:MergeResult,choices:Record<number,MergeChoice>):string{
 let i=0;return result.parts.map(p=>{if(p.kind==='text')return p.text;const choice=choices[i++];if(!choice)throw Error('Unresolved merge section');return typeof choice==='object'?choice.text:choice==='both'?p.local+p.server:p[choice];}).join('');
}
