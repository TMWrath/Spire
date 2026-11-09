import React,{useMemo,useState} from 'react';
import {ArrowLeft,Image as ImageIcon,Plus,Tag,Trash2} from 'lucide-react';
import {VisualGroups} from './VisualGroups';
import type {Attachment,Note} from '../shared/model';
import {collectImages,collectTasks,type CollectionScope,type WorkspaceImage,type WorkspaceTask} from '../shared/workspace-collections';
import {attachmentUrl} from './attachment-urls';

function ImageCard({image,onOpen,onTag,notes}:{image:WorkspaceImage;onOpen:(note:Note)=>void;onTag:(image:WorkspaceImage,tags:string[])=>Promise<void>;notes:Note[]}){
 const[editing,setEditing]=useState(false),[value,setValue]=useState(image.tags.join(', ')),[busy,setBusy]=useState(false);
 const save=async()=>{setBusy(true);try{await onTag(image,value.split(','));setEditing(false);}finally{setBusy(false);}};
 return <article className="gallery-card"><button className="gallery-image" aria-label={`Open ${image.notePath}`} onClick={()=>{const note=notes.find(note=>note.id===image.noteId);if(note)onOpen(note);}}><img src={attachmentUrl(image.path)} alt={image.alt||image.path.split('/').at(-1)}/></button><div><strong>{image.alt||image.path.split('/').at(-1)}</strong><small>{image.notePath}</small><div className="image-tags">{image.tags.map(tag=><span key={tag}>{tag}</span>)}</div>{editing?<div className="image-tag-editor"><input autoFocus aria-label="Image tags" value={value} onChange={event=>setValue(event.target.value)} placeholder="Concept art, Proof of work"/><button disabled={busy} onClick={save}>Save</button><button onClick={()=>setEditing(false)}>Cancel</button></div>:<button className="tag-image" onClick={()=>{setValue(image.tags.join(', '));setEditing(true);}}><Tag/>Tag image</button>}</div></article>;
}

export function GalleryCollection({project,notes,attachments,onBack,onOpen,onTag}:{project:string;notes:Note[];attachments:Pick<Attachment,'path'>[];onBack:()=>void;onOpen:(note:Note)=>void;onTag:(image:WorkspaceImage,tags:string[])=>Promise<void>}){
 const[filter,setFilter]=useState('');
 const scope:CollectionScope={kind:'project',project};
 const images=useMemo(()=>collectImages(notes,attachments,scope),[notes,attachments,project]),tags=[...new Set(images.flatMap(image=>image.tags))].sort();
 const shown=filter?images.filter(image=>image.tags.includes(filter)):images;
 return <section id="project-gallery" aria-label={`Gallery for ${project}`} className="workspace-collection"><header className="collection-header"><button type="button" aria-label={`Back to ${project}`} onClick={onBack}><ArrowLeft/></button><h2>{project} Gallery</h2></header><div className="gallery-filters"><button aria-pressed={!filter} onClick={()=>setFilter('')}>All</button>{tags.map(tag=><button key={tag} aria-pressed={filter===tag} onClick={()=>setFilter(tag)}>{tag}</button>)}</div><div className="image-gallery">{shown.map(image=><ImageCard key={`${image.noteId}-${image.path}`} image={image} notes={notes} onOpen={onOpen} onTag={onTag}/>)}</div>{!shown.length&&<p className="muted"><ImageIcon/> No referenced images in this project{filter?' with that tag':''}.</p>}</section>;
}
