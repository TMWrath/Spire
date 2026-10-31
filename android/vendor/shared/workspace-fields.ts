import {z} from 'zod';
import {safePath,savedTemplateSchema,type State} from './model';
import {quickActionSchema} from './quick-actions';
import {sourceSchema} from './sources';
import {snapshotHash} from './publication-patch';
const fields=z.object({folders:z.array(safePath).max(20000).optional(),styles:z.record(safePath.refine(p=>p.endsWith('.css')),z.string().max(100000)).optional(),templates:z.array(savedTemplateSchema).max(1000).optional(),sources:z.array(sourceSchema).max(1000).optional(),quickActions:z.array(quickActionSchema).max(1000).optional()}).strict();
export const workspaceFieldsSchema=z.object({expected:fields,changes:fields}).strict();
export const portableWorkspaceFields=['folders','styles','templates','sources','quickActions'] as const;
const equal=(a:unknown,b:unknown)=>snapshotHash({value:a})===snapshotHash({value:b});
/** Validate the whole CAS before creating a candidate; never import device credentials. */
export function applyWorkspaceFields(state:State,input:unknown):State{
 const {expected,changes}=workspaceFieldsSchema.parse(input);
 for(const field of portableWorkspaceFields){
  if(!Object.hasOwn(changes,field))continue;
  if(!Object.hasOwn(expected,field))throw Error('Expected workspace field required: '+field);
  const current=state[field]??(field==='styles'?{}:[]);
  if(!equal(current,expected[field])&&!equal(current,changes[field]))throw Error('Workspace field changed: '+field);
 }
 const next=structuredClone(state);
 for(const field of portableWorkspaceFields)if(Object.hasOwn(changes,field))(next as any)[field]=structuredClone(changes[field]);
 const paths=[...(next.folders??[]),...Object.keys(next.styles??{}),...Object.values(next.notes).filter(n=>!n.deleted).map(n=>n.path),...next.attachments.map(a=>a.path)];
 if(new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw Error('Workspace paths collide');
 for(const field of ['quickActions','templates','sources'] as const){const items=next[field]??[];if(new Set(items.map(i=>i.id)).size!==items.length)throw Error('Duplicate workspace identities');}
 return next;
}
