import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectDeadlines} from '../shared/project-deadlines';
import type {TaskBoard} from '../shared/project-tasks';

const board=(tasks:TaskBoard['tasks']):TaskBoard=>({revision:0,groups:[],tasks});

test('project deadlines lists unfinished dated tasks across projects in deterministic deadline order',()=>{
  const deadlines=projectDeadlines({
    Spire:board([
      {id:'00000000-0000-4000-8000-000000000001',title:'Later task',done:false,dueDate:'2026-12-20'},
      {id:'00000000-0000-4000-8000-000000000002',title:'Completed task',done:true,dueDate:'2026-11-01'},
      {id:'00000000-0000-4000-8000-000000000003',title:'No deadline',done:false},
    ]),
    Elysium:board([
      {id:'00000000-0000-4000-8000-000000000004',title:'Earlier task',done:false,dueDate:'2026-11-14'},
      {id:'00000000-0000-4000-8000-000000000005',title:'Alpha task',done:false,dueDate:'2026-12-20'},
    ]),
  });
  assert.deepEqual(deadlines.map(({dueDate,title,project})=>[dueDate,title,project]),[
    ['2026-11-14','Earlier task','Elysium'],
    ['2026-12-20','Alpha task','Elysium'],
    ['2026-12-20','Later task','Spire'],
  ]);
});
