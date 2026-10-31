import type {Note} from '../shared/model';
import type {Snapshot} from './sync';
export type LocalDelta={base:number;seq:number;notes:Note[];removed:string[];foldersAdded:string[];foldersRemoved:string[];styles:Record<string,string>;stylesRemoved:string[];conflicts:Snapshot['conflicts'];attachments:Snapshot['attachments']};
export function applyLocalDelta(snapshot:Snapshot,delta:LocalDelta):Snapshot|null{
 if(snapshot.seq!==delta.base)return null;
 const changed=new Map(delta.notes.map(n=>[n.id,n])),removed=new Set(delta.removed);
 const notes=snapshot.notes.filter(n=>!removed.has(n.id)).map(n=>{const next=changed.get(n.id);changed.delete(n.id);return next??n;});
 const styles={...snapshot.styles,...delta.styles};for(const p of delta.stylesRemoved)delete styles[p];
 return {...snapshot,seq:delta.seq,notes:[...notes,...changed.values()],folders:[...new Set([...snapshot.folders.filter(p=>!delta.foldersRemoved.includes(p)),...delta.foldersAdded])],styles,conflicts:delta.conflicts,attachments:delta.attachments};
}
export function localFileAction(note:Note,previous?:Note){
 if(note.deleted)return {pending:'Deleting file…',done:'File deleted',failed:'Delete failed · operation not confirmed'};
 if(!previous||note.rev===0)return {pending:'Creating file…',done:'File created',failed:'Create failed · operation not confirmed'};
 if(previous.path!==note.path)return {pending:'Moving file…',done:'File moved',failed:'Move failed · operation not confirmed'};
 return {pending:'Saving file…',done:'Saved to folder',failed:'Save failed · editor changes are not saved'};
}
