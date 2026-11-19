import React,{useMemo,useState} from 'react';
import {ArrowLeft,FileText,List as ListIcon,Mic,Pencil,Trash2} from 'lucide-react';
import type {Note} from '../shared/model';
import {audioNoteData} from '../shared/audio-notes';
import {filePresentation,setFilePresentation} from '../shared/file-presentations';
import {documentLists,replaceDocumentStructure} from './document-structures';
import {ListDialog} from './ListDialog';
import {StandaloneAudioTrack} from './StandaloneAudioTrack';
import {attachmentUrl} from './attachment-urls';
import './presentation-collections.css';

type Scope={kind:'files'}|{kind:'project';project:string};
const label=(scope:Scope)=>scope.kind==='files'?'Files':scope.project;
const backLabel=(scope:Scope)=>scope.kind==='files'?'files':scope.project;

export function ListsCollection({scope,notes,folders,onBack,onOpen,onCreate,onSave}:{scope:Scope;notes:Note[];folders:string[];onBack:()=>void;onOpen:(note:Note)=>void;onCreate:(path:string,content:string)=>Promise<void>;onSave:(note:Note,content:string)=>Promise<void>}){
 const lists=useMemo(()=>notes.filter(note=>!note.deleted&&filePresentation(note.content)==='list'),[notes]);
 const allowedFolders=folders.filter(folder=>scope.kind==='files'?!folder.startsWith('Projects/'):folder===`Projects/${scope.project}`||folder.startsWith(`Projects/${scope.project}/`));
 const defaultFolder=scope.kind==='files'?(allowedFolders[0]??'Lists'):`Projects/${scope.project}`;
 const[name,setName]=useState(''),[folder,setFolder]=useState(defaultFolder),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Note|null>(null),[error,setError]=useState('');
 const create=async(event:React.FormEvent)=>{event.preventDefault();const title=name.trim();if(!title)return;setBusy(true);setError('');try{await onCreate(`${folder}/${title}.md`,setFilePresentation(`# ${title}\n\n- [ ] First item\n`,'list'));setName('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const edit=editing?documentLists(editing.content)[0]:null;
 return <section className="workspace-collection presentation-collection" role="region" aria-label={`Lists in ${label(scope)}`}><header className="collection-header"><button type="button" aria-label={`Back to ${backLabel(scope)}`} onClick={onBack}><ArrowLeft/></button><h2>{label(scope)} Lists</h2></header>
  <form className="presentation-create" onSubmit={create}><label>List name<input aria-label="List name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Shopping list"/></label><label>Destination<select aria-label="List destination" value={folder} onChange={e=>setFolder(e.target.value)}>{[...new Set([defaultFolder,...allowedFolders])].map(value=><option key={value}>{value}</option>)}</select></label><button className="primary" disabled={busy||!name.trim()}><ListIcon/>Create List</button></form>
  {error&&<p role="alert">{error}</p>}<div className="presentation-file-list">{lists.map(note=><article key={note.id}><ListIcon aria-hidden="true"/><div><strong>{note.path.split('/').at(-1)?.replace(/\.md$/i,'')}</strong><small>{note.path}</small></div><button onClick={()=>setEditing(note)}><Pencil/>Edit list</button><button onClick={()=>onOpen(note)}><FileText/>Open file</button></article>)}</div>{!lists.length&&<p className="muted">No designated Lists in this {scope.kind==='files'?'Files scope':'project'} yet.</p>}
  {editing&&edit&&<ListDialog initialItems={[]} initial={{title:edit.title,style:edit.style,items:edit.items}} onCancel={()=>setEditing(null)} onInsert={markdown=>void(async()=>{setBusy(true);try{await onSave(editing,replaceDocumentStructure(editing.content,edit,markdown));setEditing(null);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}})}/>} {editing&&!edit&&<div className="template-backdrop"><section className="file-dialog" role="dialog" aria-label="List needs items"><h2>No editable list found</h2><p>This designated file is preserved unchanged. Open the file to add a Markdown list.</p><button onClick={()=>setEditing(null)}>Close</button><button onClick={()=>onOpen(editing)}>Open file</button></section></div>}
 </section>;
}

export function AudioNotesCollection({scope,notes,onBack,onOpen,onCreate,onRename,onDelete}:{scope:Scope;notes:Note[];onBack:()=>void;onOpen:(note:Note)=>void;onCreate:()=>void;onRename:(note:Note)=>void;onDelete:(note:Note)=>Promise<void>}){
 const audio=useMemo(()=>notes.filter(note=>!note.deleted&&audioNoteData(note.content)),[notes]);
 return <section className="workspace-collection presentation-collection" role="region" aria-label={`Audio Notes in ${label(scope)}`}><header className="collection-header"><button type="button" aria-label={`Back to ${backLabel(scope)}`} onClick={onBack}><ArrowLeft/></button><h2>{label(scope)} Audio Notes</h2></header>
  <div className="audio-note-create"><button type="button" className="primary" onClick={onCreate}><Mic/>New Audio Note</button></div>
  <div className="presentation-file-list">{audio.map(note=>{const data=audioNoteData(note.content)!;return <article key={note.id}><Mic aria-hidden="true"/><div><strong>{note.path.split('/').at(-1)?.replace(/\.md$/i,'')}</strong><small>{note.path} · {new Date(note.time).toLocaleString()}</small></div><StandaloneAudioTrack name={note.path.split('/').at(-1)??'Audio Note'} url={attachmentUrl(data.audioPath)} initialDisplay="simple"/><button onClick={()=>onOpen(note)}>Open</button><button aria-label={`Rename ${note.path}`} onClick={()=>onRename(note)}><Pencil/></button><button aria-label={`Delete ${note.path}`} onClick={()=>void onDelete(note)}><Trash2/></button></article>;})}</div>{!audio.length&&<p className="muted">No Audio Notes in this {scope.kind==='files'?'Files scope':'project'} yet.</p>}
 </section>;
}
