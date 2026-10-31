import {z} from 'zod';
import {safePath,type Note} from './model';
export const sourceInputSchema=z.object({kind:z.enum(['book','website','image','audio','video','document','other']),title:z.string().trim().min(1).max(300),author:z.string().trim().max(300).default(''),year:z.string().trim().max(40).default(''),edition:z.string().trim().max(100).default(''),publisher:z.string().trim().max(200).default(''),isbn:z.string().trim().max(80).default(''),url:z.string().trim().max(2000).refine(v=>!v||/^https?:\/\//i.test(v)&&(()=>{try{new URL(v);return true;}catch{return false;}})(),'Use an HTTP or HTTPS URL').default(''),accessed:z.string().max(40).default(''),attachment:z.string().max(240).refine(v=>!v||safePath.safeParse(v).success,'Invalid attachment path').default(''),description:z.string().max(10000).default('')}).strict();
export const sourceSchema=sourceInputSchema.extend({id:z.string().uuid(),revision:z.number().int().positive(),created:z.string().datetime()});
export type Source=z.infer<typeof sourceSchema>;
export type SourceInput=z.infer<typeof sourceInputSchema>;
export const sourceArchiveSchema=z.object({format:z.literal('spire-sources-1'),sources:z.array(sourceSchema).max(1000)}).strict().superRefine((v,ctx)=>{if(new Set(v.sources.map(s=>s.id)).size!==v.sources.length)ctx.addIssue({code:'custom',message:'Duplicate source identities'});});
export const sourcePath=(id:string)=>`Sources/${id}.md`;
export function relativeSourcePath(filePath:string,id:string){return '../'.repeat(filePath.split('/').length-1)+sourcePath(id);}
export function escapeCitation(value:string){return value.replace(/\\/g,'\\\\').replace(/[\[\]*_`<>]/g,'\\$&').replace(/\r?\n/g,' ');}
export function citationMarkdown(source:Source,filePath:string,locator='',quote=''){
 if(locator.length>300||quote.length>10000)throw new Error('Citation exceeds supported size');
 const label=[source.author,source.title,source.year,locator.trim()].filter(Boolean).map(escapeCitation).join(', ');
 const citation=`[${label}](${relativeSourcePath(filePath,source.id)})`;
 return quote.trim()?`\n\n${quote.trim().split(/\r?\n/).map(line=>'> '+line).join('\n')}\n>\n> — ${citation}\n\n`:`${citation}`;
}
export function citations(content:string){const masked=content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|(?<!\\)`[^`]*(?<!\\)`|<!--[\s\S]*?-->/g,m=>' '.repeat(m.length));return [...masked.matchAll(/(?<!!)\[((?:\\.|[^\]\\])*)\]\(((?:\.\.\/|\.\/)*Sources\/([a-f0-9-]{36})\.md)\)/gi)].flatMap(m=>z.string().uuid().safeParse(m[3]).success?[{sourceId:m[3],start:m.index!,end:m.index!+m[0].length,label:m[1]}]:[]);}
export function rebaseCitations(content:string,newPath:string){let value=content;for(const c of citations(content).reverse()){const raw=content.slice(c.start,c.end);const replacement=raw.replace(/\]\([^)]*\)$/,`](${relativeSourcePath(newPath,c.sourceId)})`);value=value.slice(0,c.start)+replacement+value.slice(c.end);}return value;}
export function sourceRecordMarkdown(source:Source){
 const text=(s:string)=>s.replace(/\r?\n/g,' ');
 return `# ${escapeCitation(source.title)}\n\n`+[['Type',source.kind],['Author',source.author],['Year',source.year],['Edition',source.edition],['Publisher',source.publisher],['ISBN',source.isbn],['URL',source.url],['Accessed',source.accessed]].filter(([,v])=>v).map(([k,v])=>`- **${k}:** ${escapeCitation(text(v))}\n`).join('')+(source.attachment?`\n[Attached media](../${encodeURI(source.attachment)})\n`:'')+(source.description?'\n'+source.description+'\n':'');
}
export function sourceUses(files:Note[],id:string){return files.filter(n=>!n.deleted).flatMap(file=>citations(file.content).filter(c=>c.sourceId===id).map(c=>({...c,file})));}
