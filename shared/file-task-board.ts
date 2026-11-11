import type {Note} from './model';
import {collectTasks,type WorkspaceTask} from './workspace-collections';
import {taskBoardSchema,type TaskBoard} from './project-tasks';
const taskMeta=/\s*<!-- spire-task:(\{.*\}) -->\s*$/;
const groupMeta=/<!-- spire-task-groups:(\[.*\]) -->/;
export const fileTasksPath='Tasks/Tasks.md';
export function readFileTaskBoard(notes:Note[]):{board:TaskBoard;sources:Map<string,WorkspaceTask>}{
 const sources=new Map<string,WorkspaceTask>();
 const tasks=collectTasks(notes,{kind:'files'}).map(source=>{
  const match=taskMeta.exec(source.text);let extra:Partial<TaskBoard['tasks'][number]>={};
  if(match){try{extra=JSON.parse(match[1]);}catch{throw Error('Invalid task metadata in '+source.path);}}
  const id=extra.id??source.noteId+':'+source.markerOffset;sources.set(id,source);
  return {id,title:match?source.text.slice(0,match.index).trim():source.text,done:source.checked,...(extra.dueDate?{dueDate:extra.dueDate}:{}),...(extra.fileId?{fileId:extra.fileId}:{}),...(extra.priority?{priority:extra.priority}:{}),...(extra.image?{image:extra.image}:{})};
 });
 const store=notes.find(n=>!n.deleted&&n.path===fileTasksPath);let groups:TaskBoard['groups']=[];
 const stored=groupMeta.exec(store?.content??'');if(stored)groups=taskBoardSchema.shape.groups.parse(JSON.parse(stored[1]));
 return {board:{revision:notes.filter(n=>!n.deleted&&!n.path.startsWith('Projects/')).reduce((sum,n)=>sum+n.rev,0),tasks,groups},sources};
}
export function writeFileTaskBoard(notes:Note[],next:TaskBoard):Map<string,string>{
 const {board,sources}=readFileTaskBoard(notes);
 if(next.revision!==board.revision)throw Error('Tasks changed on the server. Reopen Tasks before saving.');
 const changes=new Map<string,string>();
 const render=(task:TaskBoard['tasks'][number])=>`${task.title} <!-- spire-task:${JSON.stringify({id:task.id,...(task.dueDate?{dueDate:task.dueDate}:{}),...(task.fileId?{fileId:task.fileId}:{}),...(task.priority?{priority:task.priority}:{}),...(task.image?{image:task.image}:{})})} -->`;
 for(const note of notes){
  const owned=[...sources].filter(([,source])=>source.noteId===note.id).sort((a,b)=>b[1].markerOffset-a[1].markerOffset);let content=note.content;
  for(const [id,source] of owned){const start=content.lastIndexOf('\n',source.markerOffset)+1;const endAt=content.indexOf('\n',source.markerOffset),end=endAt<0?content.length:endAt+1;const task=next.tasks.find(t=>t.id===id);const original=content.slice(start,end);const prefix=/^(\s*[-*+]\s+)/.exec(original)![1];content=content.slice(0,start)+(task?`${prefix}[${task.done?'x':' '}] ${render(task)}${original.endsWith('\n')?'\n':''}`:'')+content.slice(end);}
  if(content!==note.content)changes.set(note.path,content);
 }
 const existing=notes.find(n=>!n.deleted&&n.path===fileTasksPath);let store=changes.get(fileTasksPath)??existing?.content??'# Tasks\n';
 for(const task of next.tasks.filter(t=>!sources.has(t.id)))store=store.replace(/\s*$/,'')+`\n\n- [${task.done?'x':' '}] ${render(task)}\n`;
 const groupComment=`<!-- spire-task-groups:${JSON.stringify(next.groups)} -->`;
 store=groupMeta.test(store)?store.replace(groupMeta,()=>groupComment):store.replace(/\s*$/,'')+'\n\n'+groupComment+'\n';
 if(store!==existing?.content)changes.set(fileTasksPath,store);
 return changes;
}
