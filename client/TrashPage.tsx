import React,{useState} from 'react';
import {FileText,Folder,Trash2} from 'lucide-react';
import type {Note} from '../shared/model';
import {groupTrashEntries,trashFilePresentation,type TrashedFileSummary,type TrashGroupEntry} from './trash-presentation';

export type TrashedFile=TrashedFileSummary&{id:string};
type TrashEntry=TrashGroupEntry<Note,TrashedFile>;

type Props={
 notes:Note[];
 files:TrashedFile[];
 onRestoreNote:(note:Note)=>Promise<void>;
 onPurgeNote:(note:Note)=>Promise<void>;
 onRestoreFile:(file:TrashedFile)=>Promise<void>;
 onPurgeFile:(file:TrashedFile)=>Promise<void>;
};

export function TrashPage({notes,files,onRestoreNote,onPurgeNote,onRestoreFile,onPurgeFile}:Props){
 const groups=groupTrashEntries(notes,files),count=notes.length+files.length;
 const [busy,setBusy]=useState<string|null>(null);
 const restoreGroup=async(folder:string,items:TrashEntry[])=>{
  setBusy(folder);
  try{for(const item of items){if(item.note)await onRestoreNote(item.note);else if(item.file)await onRestoreFile(item.file);}}
  finally{setBusy(null);}
 };
 return <section id="sidebar-trash" className="trash-page trash-sidebar" role="tabpanel" aria-label="Trash">
  <h2>Trash</h2><p className="muted">{count} deleted {count===1?'item':'items'} in {groups.length} {groups.length===1?'folder':'folders'}</p>
  <div className="trash-folder-list">
   {groups.map(group=><details className="trash-folder" key={group.folder} open={groups.length===1}>
    <summary><span className="trash-folder-icon"><Folder aria-hidden="true"/></span><span className="trash-folder-copy"><strong>{group.folder}</strong><small>{group.items.length} deleted {group.items.length===1?'item':'items'}</small></span><button type="button" disabled={busy!==null} onClick={event=>{event.preventDefault();event.stopPropagation();void restoreGroup(group.folder,group.items);}}>{busy===group.folder?'Restoring…':'Restore all'}</button></summary>
    <div className="trash-page-grid">{group.items.map(item=>item.note?<NoteCard key={item.key} note={item.note} restore={()=>onRestoreNote(item.note!)} purge={()=>onPurgeNote(item.note!)}/>:<FileCard key={item.key} file={item.file!} restore={()=>onRestoreFile(item.file!)} purge={()=>onPurgeFile(item.file!)}/>)}</div>
   </details>)}
   {!count&&<div className="trash-empty"><Trash2 aria-hidden="true"/><h2>Trash is empty</h2><p>Deleted files will appear here until you restore or permanently remove them.</p></div>}
  </div>
 </section>;
}

function NoteCard({note,restore,purge}:{note:Note;restore:()=>Promise<void>;purge:()=>Promise<void>}){
 const name=note.path.split('/').at(-1)??note.path;
 return <article className="trash-file-card"><div className="trash-file-main"><span className="trash-file-icon"><FileText size={20} aria-hidden="true"/></span><div className="trash-file-copy"><strong title={note.path}>{name}</strong><span className="trash-file-meta">Markdown document<i aria-hidden="true">•</i>{note.history.length+1} revisions</span></div></div><details className="trash-original-path"><summary>Original path</summary><code>{note.path}</code></details><div className="trash-file-actions"><button type="button" onClick={()=>void restore()}>Restore</button><button type="button" className="danger" onClick={()=>void purge()}><Trash2 size={16}/><span>Delete forever</span></button></div></article>;
}

function FileCard({file,restore,purge}:{file:TrashedFile;restore:()=>Promise<void>;purge:()=>Promise<void>}){
 const display=trashFilePresentation(file);
 return <article className="trash-file-card"><div className="trash-file-main"><span className="trash-file-icon"><FileText size={20} aria-hidden="true"/></span><div className="trash-file-copy"><strong title={file.path}>{display.name}</strong><span className="trash-file-meta">{display.type}<i aria-hidden="true">•</i>{display.size}<i aria-hidden="true">•</i>Deleted {display.deleted}</span></div></div><details className="trash-original-path"><summary>Original path</summary><code>{file.path}</code></details><div className="trash-file-actions"><button type="button" onClick={()=>void restore()}>Restore</button><button type="button" className="danger" aria-label={'Permanently delete '+file.path} onClick={()=>void purge()}><Trash2 size={16}/><span>Delete forever</span></button></div></article>;
}
