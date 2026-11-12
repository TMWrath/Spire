import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildTaskCalendarMonth} from '../shared/project-task-calendar';
import {emptyTaskBoard} from '../shared/project-tasks';

test('project task calendar builds a complete month grid from deadlines only',()=>{
  const due=randomUUID(),done=randomUUID(),outside=randomUUID(),undated=randomUUID();
  const board={...emptyTaskBoard(),tasks:[
    {id:due,title:'Ship preview',done:false,dueDate:'2026-11-12'},
    {id:done,title:'Finish design',done:true,dueDate:'2026-11-12'},
    {id:outside,title:'December work',done:false,dueDate:'2026-12-01'},
    {id:undated,title:'Research',done:false},
  ]};
  const month=buildTaskCalendarMonth(board,'2026-11');
  assert.equal(month.label,'November 2026');
  assert.equal(month.weeks.length,6);
  assert.deepEqual(month.weeks.flat().map(day=>day.iso).slice(0,7),[
    '2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07',
  ]);
  assert.deepEqual(month.weeks.flat().find(day=>day.iso==='2026-11-12')?.tasks.map(task=>task.id),[due,done]);
  assert.equal(month.weeks.flat().some(day=>day.tasks.some(task=>task.id===outside||task.id===undated)),false);
});

test('project task calendar includes leading and trailing days needed for a stable six-week grid',()=>{
  const month=buildTaskCalendarMonth(emptyTaskBoard(),'2026-08');
  assert.equal(month.weeks.flat()[0].iso,'2026-07-26');
  assert.equal(month.weeks.flat().at(-1)?.iso,'2026-09-05');
  assert.equal(month.weeks.flat().filter(day=>day.inMonth).length,31);
});
