import type {Snapshot} from './sync';

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/**
 * A publication can safely re-establish its missing local baseline when the
 * current Local snapshot only adds data. Existing published values must remain
 * byte-for-byte represented, so this never guesses through edits or deletes.
 */
export function publicationIsAdditive(server:Snapshot,local:Snapshot){
 const notes=new Map(local.notes.map(note=>[note.id,note]));
 if(!server.notes.every(note=>same(notes.get(note.id),note)))return false;
 if(!server.folders.every(folder=>local.folders.includes(folder)))return false;
 if(!Object.entries(server.styles).every(([path,css])=>local.styles[path]===css))return false;
 const attachments=new Map(local.attachments.map(item=>[item.path,item]));
 if(!server.attachments.every(item=>same(attachments.get(item.path),item)))return false;
 return same(server.conflicts,local.conflicts)
  &&same(server.sources??[],local.sources??[])
  &&same(server.templates??[],local.templates??[])
  &&same(server.quickActions??[],local.quickActions??[]);
}
