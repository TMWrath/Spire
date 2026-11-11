import React,{useLayoutEffect,useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import type {TaskBoard} from '../shared/project-tasks';
import {attachmentUrl} from './attachment-urls';
type Task=TaskBoard['tasks'][number];
export function TaskCard({task,onChange,onDelete,onLink,onOpen,onUpload}:{task:Task;onChange:(changes:Partial<Task>)=>Promise<void>;onDelete:()=>void;onLink:()=>void;onOpen:()=>void;onUpload:(file:File)=>Promise<string>}){
 const text=useRef<HTMLTextAreaElement>(null);const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
 const resize=()=>{const el=text.current;if(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';}};
 useLayoutEffect(()=>{resize();const observer=new ResizeObserver(resize);if(text.current?.parentElement)observer.observe(text.current.parentElement);return()=>observer.disconnect();},[task.title]);
 const update=(changes:Partial<Task>)=>{setError('');void onChange(changes).catch(e=>setError(e instanceof Error?e.message:'Unable to save task'));};
 return <article className="project-task-card" aria-label={'Task '+task.title}>
 <fieldset disabled={uploading}>
 <div className="task-card-heading"><input type="checkbox" aria-label={'Complete '+task.title} checked={task.done} onChange={e=>update({done:e.target.checked})}/><textarea ref={text} rows={1} aria-label={'Task title '+task.title} className={task.done?'task-done':''} defaultValue={task.title} key={task.title} maxLength={1000} onInput={resize} onBlur={e=>{const title=e.target.value.replace(/\s*\n\s*/g,' ').trim();if(title&&title!==task.title)update({title});else{e.target.value=task.title;resize();}}}/></div>
 {task.image&&<img className="task-card-image" src={attachmentUrl(task.image)} alt={'Image for '+task.title} onError={()=>setError('Task image is unavailable. You can replace or remove its link.')}/>}
 <div className="task-card-controls">{task.priority&&task.priority!=='none'&&<span className={'task-priority-tag priority-'+task.priority}>{task.priority}</span>}<label>Priority<select aria-label={'Priority for '+task.title} value={task.priority??'none'} onChange={e=>update({priority:e.target.value as Task['priority']})}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="task-deadline">Deadline<input type="date" aria-label={'Deadline for '+task.title} value={task.dueDate??''} onChange={e=>update({dueDate:e.target.value||undefined})}/></label></div>
 <div className="task-card-actions">{task.fileId?<><button aria-label={'Open file for '+task.title} onClick={onOpen}>Open file</button><button aria-label={'Unlink file for '+task.title} onClick={()=>update({fileId:undefined})}>Unlink</button></>:<button aria-label={'Link file for '+task.title} onClick={onLink}>Link file</button>}
 <label className="task-image-picker">{uploading?'Uploading…':task.image?'Replace image':'Add image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label={'Image for '+task.title} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setUploading(true);setError('');try{const image=await onUpload(file);await onChange({image});}catch(e){setError(e instanceof Error?e.message:'Unable to attach image');}finally{setUploading(false);}}}/></label>
 {task.image&&<button aria-label={'Remove image for '+task.title} onClick={()=>update({image:undefined})}>Remove image</button>}
 <button className="task-delete" aria-label={'Delete task '+task.title} onClick={onDelete}><Trash2/></button></div>
 </fieldset>{error&&<p role="alert">{error}</p>}
 </article>;
}
