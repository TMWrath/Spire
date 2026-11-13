import type {TaskBoard} from './project-tasks';

export type ProjectDeadline={project:string;taskId:string;title:string;dueDate:string};

export function projectDeadlines(boards:Record<string,TaskBoard>):ProjectDeadline[]{
  return Object.entries(boards).flatMap(([project,board])=>board.tasks
    .filter(task=>!task.done&&task.dueDate)
    .map(task=>({project,taskId:task.id,title:task.title,dueDate:task.dueDate!})))
    .sort((left,right)=>left.dueDate.localeCompare(right.dueDate)||left.title.localeCompare(right.title)||left.project.localeCompare(right.project)||left.taskId.localeCompare(right.taskId));
}
