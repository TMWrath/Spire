import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conflictsForNote} from '../client/conflict-scope';

test('context conflict list is scoped to the open file id',()=>{
 const conflicts=[
  {id:'one-a',mutation:{id:'one',path:'Writing/One.md'}},
  {id:'two-a',mutation:{id:'two',path:'Writing/Two.md'}},
  {id:'one-b',mutation:{id:'one',path:'Writing/One.md'}},
 ];
 assert.deepEqual(conflictsForNote(conflicts,'one').map(conflict=>conflict.id),['one-a','one-b']);
 assert.deepEqual(conflictsForNote(conflicts,'two').map(conflict=>conflict.id),['two-a']);
 assert.deepEqual(conflictsForNote(conflicts,'missing'),[]);
});
