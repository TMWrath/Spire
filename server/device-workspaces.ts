import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {atomic,HttpError} from './store.ts';
import {mutationSchema,safePath} from '../shared/model.ts';
import {applyPublicationPatch,makePublicationPatch,publicationPatchSchema,snapshotHash,type PublicationPatch} from '../shared/publication-patch.ts';
const noteSchema=z.object({id:z.string().uuid(),path:safePath,content:z.string().max(1_000_000),deleted:z.boolean(),rev:z.number().int().nonnegative(),history:z.array(z.unknown()).default([]),modified:z.string().optional(),templateIds:z.array(z.string()).optional()}).passthrough();
export const deviceSnapshotSchema=z.object({seq:z.number().int().nonnegative(),notes:z.array(noteSchema).max(20_000),folders:z.array(safePath).max(20_000),styles:z.record(z.string(),z.string().max(100_000)),conflicts:z.array(z.unknown()).max(10_000),attachments:z.array(z.object({path:safePath,size:z.number().int().nonnegative()})).max(20_000)}).passthrough();
export const publicationRequestSchema=z.object({base:z.number().int().nonnegative(),operation:z.string().uuid(),patch:publicationPatchSchema});
type Snapshot=z.infer<typeof deviceSnapshotSchema>;
type Receipt={revision:number;hash:string;requestHash:string};
type Mirror={revision:number;updated:string;snapshot:Snapshot;receipts?:Record<string,Receipt>};
const empty=():Snapshot=>({seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]});
export class DeviceWorkspaces{
 constructor(private root:string){fs.mkdirSync(this.directory(),{recursive:true,mode:0o700});}
 private directory(){return path.join(this.root,'device-workspaces');}
 private file(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,'Invalid device');return path.join(this.directory(),id+'.json');}
 private attachmentFile(id:string,target:string){this.file(id);return path.join(this.directory(),id,'attachments',safePath.parse(target));}
 attachment(id:string,target:string){const file=this.attachmentFile(id,target);if(!fs.existsSync(file))throw new HttpError(404,'Device attachment unavailable');return fs.readFileSync(file);}
 attachmentMatches(id:string,target:string,hash:string){if(!/^[0-9a-f]{64}$/.test(hash))throw new HttpError(400,'Invalid attachment hash');const file=this.attachmentFile(id,target);return fs.existsSync(file)&&createHash('sha256').update(fs.readFileSync(file)).digest('hex')===hash;}
 putAttachment(id:string,target:string,expectedHash:string,data:Buffer){
  if(!/^[0-9a-f]{64}$/.test(expectedHash))throw new HttpError(400,'Invalid attachment hash');
  if(!data.length)throw new HttpError(400,'Expected attachment bytes');
  const actual=createHash('sha256').update(data).digest('hex');if(actual!==expectedHash)throw new HttpError(400,'Attachment hash mismatch');
  const file=this.attachmentFile(id,target);if(fs.existsSync(file)&&createHash('sha256').update(fs.readFileSync(file)).digest('hex')===actual)return {stored:false,hash:actual,size:data.length};
  atomic(file,data);return {stored:true,hash:actual,size:data.length};
 }
 has(id:string){return fs.existsSync(this.file(id));}
 read(id:string):Mirror{const file=this.file(id);if(!fs.existsSync(file))throw new HttpError(404,'Device Local workspace has not been published');return JSON.parse(fs.readFileSync(file,'utf8'));}
 private archiveFile(id:string,revision:number){this.file(id);if(!Number.isSafeInteger(revision)||revision<1)throw new HttpError(400,'Invalid revision');return path.join(this.directory(),id,'revisions',revision+'.json');}
 history(id:string,revision:number):Mirror{const current=this.read(id);if(current.revision===revision)return current;const file=this.archiveFile(id,revision);if(!fs.existsSync(file))throw new HttpError(404,'Shared revision not retained; a verified snapshot is required');return JSON.parse(fs.readFileSync(file,'utf8'));}
 private validate(snapshot:Snapshot){
  const ids=new Set<string>(),paths:string[]=[];
  for(const n of snapshot.notes){if(ids.has(n.id))throw new HttpError(400,'Duplicate file identity');ids.add(n.id);if(!n.deleted)paths.push(n.path.toLowerCase());}
  paths.push(...snapshot.attachments.map(a=>a.path.toLowerCase()));
  const occupied=new Set<string>();for(const p of paths){if(occupied.has(p))throw new HttpError(409,'Conflicting file paths');occupied.add(p);}
  for(const p of [...paths,...snapshot.folders.map(p=>p.toLowerCase())]){const parts=p.split('/');for(let i=1;i<parts.length;i++)if(occupied.has(parts.slice(0,i).join('/')))throw new HttpError(409,'File/directory path conflict');}
  for(const folder of snapshot.folders)if(occupied.has(folder.toLowerCase()))throw new HttpError(409,'File/directory path conflict');
 }
 private commit(id:string,current:Mirror,next:Mirror){
  this.validate(next.snapshot);
  if(current.revision){const file=this.archiveFile(id,current.revision);if(fs.existsSync(file)){const retained=JSON.parse(fs.readFileSync(file,'utf8'));if(snapshotHash(retained.snapshot)!==snapshotHash(current.snapshot))throw new HttpError(409,'Retained revision differs; review required');}else{fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});atomic(file,JSON.stringify(current));}}
  atomic(this.file(id),JSON.stringify(next));return next;
 }
 publish(id:string,base:number,input:unknown){const snapshot=deviceSnapshotSchema.parse(input),current=this.has(id)?this.read(id):{revision:0,updated:'',snapshot:empty()};if(base!==current.revision)throw new HttpError(409,'Local workspace changed on both the device and server',{server:current} as any);return this.commit(id,current,{...current,revision:current.revision+1,updated:new Date().toISOString(),snapshot});}
 changes(id:string,after:number):{revision:number;hash:string;unchanged?:boolean;patch?:PublicationPatch;snapshot?:Snapshot}{
  const current=this.read(id),head={revision:current.revision,hash:snapshotHash(current.snapshot)};
  if(after===current.revision)return {...head,unchanged:true};
  if(after>0){try{return {...head,patch:makePublicationPatch(this.history(id,after).snapshot,current.snapshot)};}catch(e){if(!(e instanceof HttpError&&e.status===404))throw e;}}
  return {...head,snapshot:current.snapshot};
 }
 publishPatch(id:string,input:unknown):Receipt{
  const request=publicationRequestSchema.parse(input),current=this.read(id),requestHash=snapshotHash(request),replay=current.receipts?.[request.operation];
  if(replay){if(replay.requestHash!==requestHash)throw new HttpError(409,'Operation ID reused with different content');return replay;}
  if(request.base!==current.revision)throw new HttpError(409,'Workspace changed; retry comparison against the new shared revision');
  let snapshot:Snapshot;try{snapshot=deviceSnapshotSchema.parse(applyPublicationPatch(current.snapshot,request.patch));}catch(e){throw new HttpError(400,e instanceof Error?e.message:'Invalid patch');}
  const receipt={revision:current.revision+1,hash:snapshotHash(snapshot),requestHash};
  this.commit(id,current,{revision:receipt.revision,updated:new Date().toISOString(),snapshot,receipts:{...current.receipts,[request.operation]:receipt}});return receipt;
 }
 mutate(id:string,workspaceRevision:number,input:unknown){
  const current=this.read(id);if(current.revision!==workspaceRevision)throw new HttpError(409,'Device Local workspace changed; refresh before editing',{server:current} as any);
  const mutation=mutationSchema.parse(input),existing=current.snapshot.notes.find(n=>n.id===mutation.id);if((existing?.rev??0)!==mutation.base)throw new HttpError(409,'Device file changed; refresh before editing');
  const now=new Date().toISOString(),history=[...(existing?.history??[])];if(existing){const {id:_,history:__,...previous}=existing;if(!history.some(r=>snapshotHash(r)===snapshotHash(previous)))history.push(previous);}
  const nextNote={...(existing??{templateIds:[]}),...mutation,history,rev:mutation.base+1,modified:now,time:now};delete (nextNote as any).op;
  const snapshot={...current.snapshot,seq:current.snapshot.seq+1,notes:[...current.snapshot.notes.filter(n=>n.id!==mutation.id),nextNote]};return this.commit(id,current,{...current,revision:current.revision+1,updated:now,snapshot});
 }
}
