import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,ArrowLeft} from 'lucide-react';
import {VisualGroups} from './VisualGroups';
import {taskProgress,type TaskBoard} from '../shared/project-tasks';
import './project-tasks.css';
import {TaskCard} from './TaskCard';
import {TaskFileDialog} from './TaskFileDialog';
import {TaskLinkDialog} from './TaskLinkDialog';
export function ProjectTasks({project,filesMode=false,board:persistedBoard,onSave,onClose,folders,files,onCreateFile,onOpenFile,onUploadImage}:{onUploadImage:(file:File)=>Promise<string>;project:string;filesMode?:boolean;board:TaskBoard;onSave:(board:TaskBoard)=>Promise<void>;onClose:()=>void;folders:string[];files:{id:string;path:string}[];onCreateFile:(taskId:string,revision:number,path:string)=>Promise<void>;onOpenFile:(id:string)=>Promise<void>}){
 const [doneOpen,setDoneOpen]=useState(false);const [title,setTitle]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [groupOpen,setGroupOpen]=useState(false);
 const [chooseTask,setChooseTask]=useState<{id:string;title:string}|null>(null);
 const [linkTask,setLinkTask]=useState<{id:string;title:string}|null>(null);
 const [fileTask,setFileTask]=useState<{id:string;title:string}|null>(null);
 const [board,setBoard]=useState(persistedBoard);const saving=useRef(false);const latestBoard=useRef(board);latestBoard.current=board;
 useEffect(()=>{if(!saving.current)setBoard(persistedBoard);},[persistedBoard,busy]);
 const save=async(next:TaskBoard)=>{if(saving.current)throw new Error('A task change is still saving. Please retry.');const previous=board;saving.current=true;setBoard(next);setBusy(true);setError('');try{await onSave(next);}catch(e){setBoard(previous);setError(e instanceof Error?e.message:'Unable to save tasks');throw e;}finally{saving.current=false;setBusy(false);}};
 const addTask=async()=>{const text=title.trim();if(!text||busy)return;const task={id:crypto.randomUUID(),title:text,done:false};await save({...board,tasks:[...board.tasks,task]});setTitle('');};
 return <section className="project-tasks-page" aria-label={filesMode?'File tasks':'Tasks for '+project}>
 <div className="row"><button onClick={onClose} disabled={busy}><ArrowLeft/>{filesMode?'Back to files':'Back to project'}</button><strong>{project} · Tasks</strong><span className="task-progress" role="status">{taskProgress(board)}% · {board.tasks.filter(t=>t.done).length}/{board.tasks.length} complete</span></div>
 <form className="task-create" onSubmit={e=>{e.preventDefault();void addTask().catch(()=>{});}}><textarea aria-label="New task" placeholder="What needs to be done?" maxLength={1000} rows={4} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/><div className="task-create-actions"><button type="button" disabled={busy} onClick={()=>setGroupOpen(true)}>Group tasks</button><button type="submit" disabled={busy||!title.trim()}><Plus/>Add task</button></div></form>
 {busy&&<p className="muted" role="status">Saving tasks…</p>}{error&&<p role="alert">{error}</p>}
 {!board.tasks.length&&<p className="muted">No tasks yet. Add your first task above.</p>}
 <fieldset disabled={busy} className="task-entries">
 {[false,true].map(done=><section key={String(done)} aria-label={done?'Done':'To Do'} className="task-status-section">
 {done?<button className="task-section-toggle" aria-expanded={doneOpen} onClick={()=>setDoneOpen(!doneOpen)}>Done · {board.tasks.filter(t=>t.done).length} {doneOpen?'−':'+'}</button>:<h2>To Do · {board.tasks.filter(t=>!t.done).length}</h2>}
 <div hidden={done&&!doneOpen}><VisualGroups itemsLabel="tasks" selectionEntries={board.tasks.map(t=>({id:'task:'+t.id,label:t.title,node:null}))} scope={'tasks:'+project} directory={'tasks:'+project} entries={board.tasks.filter(t=>t.done===done).map(task=>({id:'task:'+task.id,label:task.title,node:<TaskCard task={task} onChange={changes=>{const current=latestBoard.current;if(!current.tasks.some(t=>t.id===task.id))return Promise.reject(new Error("This task was removed. Uploaded images remain in Attachments/tasks."));return save({...current,tasks:current.tasks.map(t=>t.id===task.id?{...t,...changes}:t)});}} onUpload={onUploadImage} onLink={()=>setChooseTask(task)} onOpen={()=>void onOpenFile(task.fileId!).catch(e=>setError(e.message))} onDelete={()=>{if(confirm('Delete this task?'))void save({...board,tasks:board.tasks.filter(t=>t.id!==task.id),groups:board.groups.map(g=>({...g,members:g.members.filter(id=>id!=='task:'+task.id)}))}).catch(()=>{});}}/>}))} groups={board.groups} openRequested={!done&&groupOpen} onRequestHandled={()=>setGroupOpen(false)} onSave={groups=>save({...board,groups})}/>{!board.tasks.some(t=>t.done===done)&&<p className="muted">{done?'No completed tasks yet.':'Nothing left to do.'}</p>}</div>
 </section>)}
 </fieldset>
 {chooseTask&&<div className="template-backdrop"><div className="file-dialog" role="dialog" aria-modal="true" aria-label="Link file" onKeyDown={e=>{if(e.key==='Escape')setChooseTask(null);}}><h2>Link file</h2><p>For task: {chooseTask.title}</p><button autoFocus onClick={()=>{setLinkTask(chooseTask);setChooseTask(null);}}>Link existing</button><button onClick={()=>{setFileTask(chooseTask);setChooseTask(null);}}>Create new</button><button onClick={()=>setChooseTask(null)}>Cancel</button></div></div>}
 {linkTask&&<TaskLinkDialog title={linkTask.title} files={files} onClose={()=>setLinkTask(null)} onLink={id=>save({...board,tasks:board.tasks.map(t=>t.id===linkTask.id?{...t,fileId:id}:t)})}/>}
 {fileTask&&<TaskFileDialog title={fileTask.title} project={project} defaultFolder={filesMode?'Tasks':undefined} folders={folders} onClose={()=>setFileTask(null)} onCreate={path=>onCreateFile(fileTask.id,board.revision,path)}/>}
 </section>;
}
