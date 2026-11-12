import React,{useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,ListTodo} from 'lucide-react';
import type {TaskBoard} from '../shared/project-tasks';
import {buildTaskCalendarMonth,shiftTaskCalendarMonth,taskCalendarMonthKey} from '../shared/project-task-calendar';

export function ProjectTaskCalendar({project,board,onBack}:{project:string;board:TaskBoard;onBack:()=>void}){
  const firstDue=board.tasks.find(task=>task.dueDate)?.dueDate?.slice(0,7);
  const [month,setMonth]=useState(firstDue??taskCalendarMonthKey());
  const calendar=useMemo(()=>buildTaskCalendarMonth(board,month),[board,month]);
  const dated=board.tasks.filter(task=>task.dueDate).length;
  return <section className="project-task-calendar" aria-label={`Task calendar for ${project}`}>
    <div className="task-calendar-toolbar">
      <button onClick={onBack}><ListTodo aria-hidden="true"/>Tasks</button>
      <button aria-label="Previous month" onClick={()=>setMonth(shiftTaskCalendarMonth(month,-1))}><ArrowLeft aria-hidden="true"/></button>
      <h2 aria-live="polite">{calendar.label}</h2>
      <button aria-label="Next month" onClick={()=>setMonth(shiftTaskCalendarMonth(month,1))}><ArrowRight aria-hidden="true"/></button>
    </div>
    {!dated&&<p className="muted task-calendar-empty"><CalendarDays aria-hidden="true"/>Add a deadline to a task and it will appear here.</p>}
    <div className="task-calendar-weekdays" aria-hidden="true">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="task-calendar-grid">{calendar.weeks.flat().map(day=><section key={day.iso} className={`task-calendar-day${day.inMonth?'':' outside-month'}`} aria-label={`${day.iso}, ${day.tasks.length} tasks`}>
      <time dateTime={day.iso}>{day.day}</time>
      <div>{day.tasks.map(task=><article key={task.id} className={`task-calendar-entry priority-${task.priority??'none'}${task.done?' task-done':''}`} title={task.title}><span>{task.title}</span>{task.done&&<span className="sr-only">Completed</span>}</article>)}</div>
    </section>)}</div>
  </section>;
}
