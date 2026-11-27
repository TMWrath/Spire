import {ButtonCarousel} from './ButtonCarousel';
import {CollectionFileRow,ItemName} from './TreeItemParts';
import React,{useMemo,useState} from 'react';
import {ArrowLeft,FileText,List as ListIcon,Mic,Pencil,Trash2} from 'lucide-react';
import type {Note} from '../shared/model';
import {audioNoteData} from '../shared/audio-notes';
import {filePresentation,setFilePresentation} from '../shared/file-presentations';
import {StandaloneAudioTrack} from './StandaloneAudioTrack';
import {attachmentUrl} from './attachment-urls';
import './presentation-collections.css';
import {listTagLine,decodeListTags,normalizeListTags} from './list-tags';
import {TagFilter} from './ListTagEditor';

type Scope={kind:'files'}|{kind:'project';project:string};
const label=(scope:Scope)=>scope.kind==='files'?'Files':scope.project;
const backLabel=(scope:Scope)=>scope.kind==='files'?'files':scope.project;

export function ListsCollection({collectionRows,groupAction,focusCreate=false,scope,notes,onBack,onOpen,onCreate,onRename,onDelete}:{collectionRows:(directory:string,itemsLabel:string,notes:Note[],row:(note:Note)=>React.ReactNode)=>React.ReactNode;groupAction:(directory:string)=>React.ReactNode;focusCreate?:boolean;scope:Scope;notes:Note[];onDelete:(note:Note)=>void;onRename:(note:Note)=>void;onBack:()=>void;onOpen:(note:Note)=>void;onCreate:(path:string,content:string)=>Promise<void>}){
 const lists=useMemo(()=>notes.filter(note=>!note.deleted&&filePresentation(note.content)==='list'),[notes]);
 const [filter,setFilter]=useState('');
 const labels=(note:Note)=>decodeListTags(listTagLine.exec(note.content)?.[1]);
 const available=normalizeListTags(lists.flatMap(labels));
 const active=available.some(tag=>tag.toLowerCase()===filter)?filter:'';
 const shown=lists.filter(note=>!active||labels(note).some(tag=>tag.toLowerCase()===active));
 const defaultFolder=scope.kind==='files'?'Lists':`Projects/${scope.project}/Lists`;
 const[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const create=async(event:React.FormEvent)=>{event.preventDefault();const title=name.trim();if(!title)return;setBusy(true);setError('');try{if(/[\\/]/.test(title))throw Error('Enter a list name without slashes.');await onCreate(`${defaultFolder}/${title}.md`,setFilePresentation(`# ${title}\n\n- [ ] First item\n`,'list'));setName('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section className="workspace-collection presentation-collection" role="region" aria-label={`Lists in ${label(scope)}`}>{scope.kind!=='files'&&<header className="collection-header"><button type="button" aria-label={`Back to ${backLabel(scope)}`} onClick={onBack}><ArrowLeft/></button><h2>{label(scope)} Lists</h2></header>}
  {scope.kind==='project'&&<ButtonCarousel className="project-section-rail files-section-rail" role="group" aria-label="List group actions">{groupAction(defaultFolder)}</ButtonCarousel>}{scope.kind==='project'&&<form className="presentation-create" onSubmit={create}><label>List name<input autoFocus={focusCreate} aria-label="List name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Shopping list"/></label><button className="primary" disabled={busy||!name.trim()}><ListIcon/>Create List</button></form>}
  {error&&<p role="alert">{error}</p>}<TagFilter label="Filter lists by tag" tags={available} value={active} onChange={setFilter}/><nav className="collection-file-tree" aria-label="List files">{collectionRows(defaultFolder,"lists",shown,note=><CollectionFileRow key={note.id} path={note.path} name={note.path.split("/").at(-1)?.replace(/\.md$/i,"")??note.path} icon={<ListIcon/>} onDelete={()=>onDelete(note)} onRename={()=>onRename(note)} onOpen={()=>onOpen(note)}/>)}</nav>{!lists.length&&<p className="muted">No designated Lists in this {scope.kind==='files'?'Files scope':'project'} yet.</p>}
 </section>;
}

export function AudioNotesCollection({scope,notes,onBack,onOpen,onCreate,onRename,onDelete,onRenameTitle}:{scope:Scope;notes:Note[];onBack:()=>void;onOpen:(note:Note)=>void;onCreate:()=>void;onRename:(note:Note)=>void;onRenameTitle:(note:Note)=>void;onDelete:(note:Note)=>Promise<void>}){
 const audio=useMemo(()=>notes.filter(note=>!note.deleted&&audioNoteData(note.content)),[notes]);
 return <section className="workspace-collection presentation-collection" role="region" aria-label={`Audio Notes in ${label(scope)}`}>{scope.kind!=='files'&&<header className="collection-header"><button type="button" aria-label={`Back to ${backLabel(scope)}`} onClick={onBack}><ArrowLeft/></button><h2>{label(scope)} Audio Notes</h2></header>}
  {scope.kind==='project'&&<div className="files-action-rows"><ButtonCarousel className="project-section-rail files-section-rail" role="group" aria-label={`${scope.project} audio creation actions`}><button type="button" className="project-tasks-link" onClick={onCreate}><Mic aria-hidden="true"/><span>Add New Audio Note</span></button></ButtonCarousel></div>}
  <div className="audio-note-player-list">{audio.map(note=>{const data=audioNoteData(note.content)!;return <article key={note.id}><StandaloneAudioTrack titleControl={<ItemName direct path={note.path} onRename={()=>onRenameTitle(note)}>{note.path.split('/').at(-1)?.replace(/\.md$/i,'')}</ItemName>} name={note.path.split('/').at(-1)?.replace(/\.md$/i,'')||'Audio Note'} url={attachmentUrl(data.audioPath)} menuActions={[{label:'Open note',run:()=>onOpen(note)},{label:'Edit',run:()=>onRename(note)},{label:'Delete',run:()=>void onDelete(note)}]}/></article>;})}</div>{!audio.length&&<p className="muted">No Audio Notes in this {scope.kind==='files'?'Files scope':'project'} yet.</p>}
 </section>;
}
