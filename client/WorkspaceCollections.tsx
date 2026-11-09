import React,{useMemo,useState} from 'react';
import {ArrowLeft,Image as ImageIcon,Plus,Tag,Trash2} from 'lucide-react';
import type {Attachment,Note} from '../shared/model';
import {collectImages,collectTasks,type CollectionScope,type WorkspaceImage,type WorkspaceTask} from '../shared/workspace-collections';
import {attachmentUrl} from './attachment-urls';

export function TasksCollection({notes,onBack,onOpen,onToggle,onAdd,onRename,onDelete}:{notes:Note[];onBack:()=>void;onOpen:(note:Note)=>void;onToggle:(task:WorkspaceTask)=>Promise<void>;onAdd:(scope:CollectionScope,group:string,text:string)=>Promise<void>;onRename:(task:WorkspaceTask,text:string)=>Promise<void>;onDelete:(task:WorkspaceTask)=>Promise<void>}){
 const scope:CollectionScope={kind:'files'};
 const[group,setGroup]=useState('General'),[text,setText]=useState(''),[busy,setBusy]=useState(false),[toggling,setToggling]=useState<Set<string>>(()=>new Set());
 const tasks=useMemo(()=>collectTasks(notes,scope),[notes]),groups=useMemo(()=>[...new Set(tasks.map(task=>task.group))],[tasks]);
 const complete=tasks.filter(task=>task.checked).length,progress=tasks.length?Math.round(complete/tasks.length*100):0;
 const add=async(event:React.FormEvent)=>{event.preventDefault();if(!text.trim())return;setBusy(true);try{await onAdd(scope,group,text);setText('');}finally{setBusy(false);}};
 const openTask=(task:WorkspaceTask)=>{const note=notes.find(note=>note.id===task.noteId);if(note)onOpen(note);};
 return <section id="files-tasks" aria-label="File tasks" className="workspace-collection project-tasks-page">
  <header className="row"><button type="button" onClick={onBack}><ArrowLeft/>Back to files</button><strong>Files · Tasks</strong><span className="task-progress" role="status">{progress}% · {complete}/{tasks.length} complete</span></header>
  <form className="task-create" onSubmit={add}><input aria-label="New task" placeholder="What needs to be done?" value={text} onChange={event=>setText(event.target.value)} disabled={busy}/><label className="task-deadline">Group<input aria-label="Task group" value={group} onChange={event=>setGroup(event.target.value)} list="task-groups" disabled={busy}/></label><datalist id="task-groups">{groups.map(value=><option key={value} value={value}/>)}</datalist><button type="submit" disabled={busy||!text.trim()}><Plus/>Add task</button></form>
  {groups.map(name=><section className="task-group visual-section file-task-group" key={name}><h3>{name}<small>{tasks.filter(task=>task.group===name&&!task.checked).length}</small></h3>{tasks.filter(task=>task.group===name).map(task=>{const key=`${task.noteId}-${task.markerOffset}`,pending=toggling.has(key),checked=pending?!task.checked:task.checked;return <div className="project-task-row" key={key}><input type="checkbox" checked={checked} disabled={pending} aria-label={`${checked?'Reopen':'Complete'} ${task.text}`} onChange={()=>{setToggling(current=>new Set(current).add(key));void onToggle(task).finally(()=>setToggling(current=>{const next=new Set(current);next.delete(key);return next;}));}}/><input type="text" aria-label={`Task title ${task.text}`} className={task.checked?'task-done':''} defaultValue={task.text} key={task.text} maxLength={1000} onBlur={event=>{const next=event.target.value.trim();if(next&&next!==task.text)void onRename(task,next);else event.target.value=task.text;}}/><button aria-label={`Open file for ${task.text}`} title={task.path} onClick={()=>openTask(task)}>Open file</button><button aria-label={`Delete task ${task.text}`} onClick={()=>{if(confirm('Delete this task?'))void onDelete(task);}}><Trash2/></button></div>;})}</section>)}
  {!tasks.length&&<p className="muted">No file tasks yet. Add one above or use task checkboxes inside any non-project file.</p>}
 </section>;
}

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
