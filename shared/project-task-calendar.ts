import type {TaskBoard} from './project-tasks';

export type TaskCalendarDay={iso:string;day:number;inMonth:boolean;tasks:TaskBoard['tasks']};
export type TaskCalendarMonth={key:string;label:string;weeks:TaskCalendarDay[][]};

const dateFromIso=(iso:string)=>new Date(`${iso}T12:00:00Z`);
const isoDate=(date:Date)=>date.toISOString().slice(0,10);

export function taskCalendarMonthKey(date=new Date()):string{
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

export function shiftTaskCalendarMonth(key:string,offset:number):string{
  const [year,month]=key.split('-').map(Number);
  return taskCalendarMonthKey(new Date(Date.UTC(year,month-1+offset,1,12)));
}

export function buildTaskCalendarMonth(board:TaskBoard,key:string):TaskCalendarMonth{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw new Error('Invalid calendar month');
  const first=dateFromIso(`${key}-01`);
  const start=new Date(first);
  start.setUTCDate(1-first.getUTCDay());
  const tasksByDate=new Map<string,TaskBoard['tasks']>();
  for(const task of board.tasks){
    if(!task.dueDate)continue;
    const tasks=tasksByDate.get(task.dueDate)??[];
    tasks.push(task);
    tasksByDate.set(task.dueDate,tasks);
  }
  const days:Array<TaskCalendarDay>=[];
  for(let index=0;index<42;index++){
    const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);
    const iso=isoDate(date);
    const inMonth=iso.startsWith(key);
    days.push({iso,day:date.getUTCDate(),inMonth,tasks:inMonth?(tasksByDate.get(iso)??[]):[]});
  }
  return {key,label:first.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}),weeks:Array.from({length:6},(_,index)=>days.slice(index*7,index*7+7))};
}
