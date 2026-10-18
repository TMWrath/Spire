import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {atomic,HttpError} from './store.ts';
import {mutationSchema,safePath} from '../shared/model.ts';

const noteSchema=z.object({id:z.string().uuid(),path:safePath,content:z.string().max(1_000_000),deleted:z.boolean(),rev:z.number().int().nonnegative(),history:z.array(z.unknown()).default([]),modified:z.string().optional(),templateIds:z.array(z.string()).optional()}).passthrough();
export const deviceSnapshotSchema=z.object({seq:z.number().int().nonnegative(),notes:z.array(noteSchema).max(20_000),folders:z.array(safePath).max(20_000),styles:z.record(z.string(),z.string().max(100_000)),conflicts:z.array(z.unknown()).max(10_000),attachments:z.array(z.object({path:safePath,size:z.number().int().nonnegative()})).max(20_000)}).passthrough();
type Snapshot=z.infer<typeof deviceSnapshotSchema>;
type Mirror={revision:number;updated:string;snapshot:Snapshot};
const empty=():Snapshot=>({seq:0,notes:[],folders:[],styles:{},conflicts:[],attachments:[]});

export class DeviceWorkspaces{
 constructor(private root:string){fs.mkdirSync(this.directory(),{recursive:true,mode:0o700});}
 private directory(){return path.join(this.root,'device-workspaces');}
 private file(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,'Invalid device');return path.join(this.directory(),id+'.json');}
 has(id:string){return fs.existsSync(this.file(id));}
 read(id:string):Mirror{const file=this.file(id);if(!fs.existsSync(file))throw new HttpError(404,'Device Local workspace has not been published');return JSON.parse(fs.readFileSync(file,'utf8'));}
 publish(id:string,base:number,input:unknown){const snapshot=deviceSnapshotSchema.parse(input),current=this.has(id)?this.read(id):{revision:0,updated:'',snapshot:empty()};if(base!==current.revision)throw new HttpError(409,'Local workspace changed on both the device and server',{server:current} as any);const next={revision:current.revision+1,updated:new Date().toISOString(),snapshot};atomic(this.file(id),JSON.stringify(next));return next;}
 mutate(id:string,workspaceRevision:number,input:unknown){const current=this.read(id);if(current.revision!==workspaceRevision)throw new HttpError(409,'Device Local workspace changed; refresh before editing',{server:current} as any);const mutation=mutationSchema.parse(input),existing=current.snapshot.notes.find(n=>n.id===mutation.id);if((existing?.rev??0)!==mutation.base)throw new HttpError(409,'Device file changed; refresh before editing');const now=new Date().toISOString();const nextNote={...(existing??{history:[],templateIds:[]}),...mutation,rev:mutation.base+1,modified:now};delete (nextNote as any).op;const snapshot={...current.snapshot,seq:current.snapshot.seq+1,notes:[...current.snapshot.notes.filter(n=>n.id!==mutation.id),nextNote]};const next={revision:current.revision+1,updated:now,snapshot};atomic(this.file(id),JSON.stringify(next));return next;
 }
}
