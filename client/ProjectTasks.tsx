import React,{useState} from 'react';
import {Plus,Trash2,ArrowLeft} from 'lucide-react';
import {VisualGroups} from './VisualGroups';
import {taskProgress,type TaskBoard} from '../shared/project-tasks';
import './project-tasks.css';
export function ProjectTasks({project,board,onSave,onClose}:{project:string;board:TaskBoard;onSave:(board:TaskBoard)=>Promise<void>;onClose:()=>void}){
 const [title,setTitle]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [groupOpen,setGroupOpen]=useState(false);
 const save=async(next:TaskBoard)=>{setBusy(true);setError('');try{await onSave(next);}catch(e){setError(e instanceof Error?e.message:'Unable to save tasks');throw e;}finally{setBusy(false);}};
 return <section className="project-tasks-page" aria-label={'Tasks for '+project}>
 <div className="row"><button onClick={onClose} disabled={busy}><ArrowLeft/>Back to project</button><strong>{project} · Tasks</strong><span className="task-progress" role="status">{taskProgress(board)}% · {board.tasks.filter(t=>t.done).length}/{board.tasks.length} complete</span></div>
 <form className="task-create" onSubmit={e=>{e.preventDefault();const text=title.trim();if(text&&!busy)void save({...board,tasks:[...board.tasks,{id:crypto.randomUUID(),title:text,done:false}]}).then(()=>setTitle('')).catch(()=>{});}}><input aria-label="New task" placeholder="What needs to be done?" maxLength={1000} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/><button type="submit" disabled={busy||!title.trim()}><Plus/>Add task</button><button type="button" disabled={busy} onClick={()=>setGroupOpen(true)}>Group tasks</button></form>
 {error&&<p role="alert">{error}</p>}
 {!board.tasks.length&&<p className="muted">No tasks yet. Add your first task above.</p>}
 <fieldset disabled={busy} className="task-entries"><VisualGroups itemsLabel="tasks" scope={'tasks:'+project} directory={'tasks:'+project} entries={board.tasks.map(task=>({id:'task:'+task.id,label:task.title,node:<div className="project-task-row"><input type="checkbox" aria-label={'Complete '+task.title} checked={task.done} onChange={e=>void save({...board,tasks:board.tasks.map(t=>t.id===task.id?{...t,done:e.target.checked}:t)}).catch(()=>{})}/><input aria-label={'Task title '+task.title} className={task.done?'task-done':''} defaultValue={task.title} key={task.title} maxLength={1000} onBlur={e=>{const text=e.target.value.trim();if(text&&text!==task.title)void save({...board,tasks:board.tasks.map(t=>t.id===task.id?{...t,title:text}:t)}).catch(()=>{});else e.target.value=task.title;}}/><button aria-label={'Delete task '+task.title} onClick={()=>{if(confirm('Delete this task?'))void save({...board,tasks:board.tasks.filter(t=>t.id!==task.id),groups:board.groups.map(g=>({...g,members:g.members.filter(id=>id!=='task:'+task.id)}))}).catch(()=>{});}}><Trash2/></button></div>}))} groups={board.groups} openRequested={groupOpen} onRequestHandled={()=>setGroupOpen(false)} onSave={groups=>save({...board,groups})}/></fieldset>
 </section>;
}
