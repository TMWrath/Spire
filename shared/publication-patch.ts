import {z} from 'zod';
import {applyTextPatch,makeTextPatch,textPatchSchema} from './markdown-sync';
import {contentFingerprint} from './workspace-index';
function canonical(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';}
export const snapshotHash=(v:unknown)=>contentFingerprint(canonical(v));
type File={id:string;content:string;history:unknown[];[key:string]:unknown};
type Workspace={notes:File[];[key:string]:unknown};
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const publicationPatchSchema=z.object({version:z.literal(1),baseHash:hash,resultHash:hash,order:z.array(z.string()).max(20000),metadata:z.record(z.string(),z.unknown()),changes:z.array(z.object({id:z.string(),baseHash:hash.nullable(),fields:z.record(z.string(),z.unknown()),body:textPatchSchema,history:z.object({order:z.array(hash),added:z.array(z.unknown())})})).max(20000)});
export type PublicationPatch=z.infer<typeof publicationPatchSchema>;
export function makePublicationPatch<T extends Workspace>(before:T,after:T):PublicationPatch{
 const previous=new Map(before.notes.map(n=>[n.id,n]));const changes:PublicationPatch['changes']=[];
 for(const n of after.notes){const old=previous.get(n.id);if(old&&snapshotHash(old)===snapshotHash(n))continue;
  const {content,history,...fields}=n,known=new Set((old?.history??[]).map(snapshotHash));
  changes.push({id:n.id,baseHash:old?snapshotHash(old):null,fields,body:makeTextPatch(old?.content??'',content),history:{order:history.map(snapshotHash),added:history.filter(v=>!known.has(snapshotHash(v)))}});
 }
 const metadata=Object.fromEntries(Object.entries(after).filter(([key,value])=>key!=='notes'&&canonical(value)!==canonical(before[key])));
 for(const key of Object.keys(before))if(key!=='notes'&&!(key in after))throw Error('Metadata removal requires an explicit empty value');
 return {version:1,baseHash:snapshotHash(before),resultHash:snapshotHash(after),order:after.notes.map(n=>n.id),metadata,changes};
}
export function applyPublicationPatch<T extends Workspace>(before:T,input:PublicationPatch):T{
 const patch=publicationPatchSchema.parse(input);if(snapshotHash(before)!==patch.baseHash)throw Error('Publication patch base mismatch');
 const notes=new Map(before.notes.map(n=>[n.id,n]));const touched=new Set<string>();
 if(new Set(patch.order).size!==patch.order.length||'notes' in patch.metadata)throw Error('Invalid publication patch identities');
 for(const change of patch.changes){if(touched.has(change.id))throw Error('Duplicate changed file');touched.add(change.id);const old=notes.get(change.id);
  if((old?snapshotHash(old):null)!==change.baseHash||change.fields.id!==change.id)throw Error('File patch base mismatch');
  const revisions=new Map([...(old?.history??[]),...change.history.added].map(v=>[snapshotHash(v),v]));
  const history=change.history.order.map(h=>{if(!revisions.has(h))throw Error('Missing history entry');return revisions.get(h)!;});
  notes.set(change.id,{...change.fields,id:change.id,content:applyTextPatch(old?.content??'',change.body),history});
 }
 // Deletion is a tombstone, never an omitted file. Purges have a separate explicit API.
 for(const id of notes.keys())if(!patch.order.includes(id))throw Error('Patch cannot silently remove a file');
 const result={...before,...patch.metadata,notes:patch.order.map(id=>{const n=notes.get(id);if(!n)throw Error('Missing patch file');return n;})} as T;
 if(snapshotHash(result)!==patch.resultHash)throw Error('Publication patch integrity failure');return result;
}
