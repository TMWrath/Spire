import type {TaskBoard} from '../shared/project-tasks';
import {projectDeadlines} from '../shared/project-deadlines';

const displayDate=(iso:string)=>new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});

export function DeadlineWidget({boards}:{boards:Record<string,TaskBoard>}){
  const deadlines=projectDeadlines(boards);
  return <section className="deadline-widget" aria-label="Project deadlines">
    <header><h2>Deadlines</h2><p>Upcoming tasks across every project.</p></header>
    {deadlines.length?<div className="deadline-list" role="list" aria-label="Project task deadlines">
      {deadlines.map(deadline=><div className="deadline-row" role="listitem" key={`${deadline.project}:${deadline.taskId}`}>
        <time dateTime={deadline.dueDate}>{displayDate(deadline.dueDate)}</time>
        <strong title={deadline.title}>{deadline.title}</strong>
        <span title={deadline.project}>{deadline.project}</span>
      </div>)}
    </div>:<p className="deadline-empty">No unfinished project tasks have deadlines.</p>}
  </section>;
}
