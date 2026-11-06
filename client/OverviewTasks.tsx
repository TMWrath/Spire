import React,{useState} from 'react';
import {taskProgress,type TaskBoard} from '../shared/project-tasks';
import './OverviewTasks.css';
export function OverviewTasks({board,onSave,onManage,onOpenFile}:{board:TaskBoard;onSave:(board:TaskBoard)=>Promise<void>;onManage:()=>void;onOpenFile:(id:string)=>Promise<void>}){
 const [pending,setPending]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const act=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Unable to update tasks');}finally{setBusy(false);}};
 return <section className="overview-tasks" aria-label="Project tasks"><div className="overview-tasks-head"><h2>Tasks</h2><span>{taskProgress(board)}% complete</span><button disabled={busy} onClick={onManage}>Manage tasks</button></div>{error&&<p role="alert">{error}</p>}{!board.tasks.length&&<p className="muted">No tasks yet.</p>}<ul>{board.tasks.map(task=><li key={task.id}><label><input type="checkbox" aria-label={'Complete '+task.title} disabled={busy} checked={pending[task.id]??task.done} onChange={e=>{const done=e.target.checked;setPending({[task.id]:done});void act(()=>onSave({...board,tasks:board.tasks.map(t=>t.id===task.id?{...t,done}:t)})).finally(()=>setPending({}));}}/><span className={task.done?'task-done':''}>{task.title}</span></label>{task.dueDate&&<time dateTime={task.dueDate}>{task.dueDate}</time>}{task.fileId&&<button disabled={busy} aria-label={'Open file for '+task.title} onClick={()=>void act(()=>onOpenFile(task.fileId!))}>Open file</button>}</li>)}</ul></section>;
}
