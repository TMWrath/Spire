import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalEntry,journalEntries,isOrdinaryPath} from '../shared/journal';
import type {Note} from '../shared/model';

test('local date and creation time, editable restrained template, collision-safe same-instant entries',()=>{
 const now=new Date(2026,10,9,23,25,7);
 const entries=Array.from({length:1000},()=>journalEntry(now));
 assert.equal(new Set(entries.map(n=>n.id)).size,1000);
 assert.equal(new Set(entries.map(n=>n.path)).size,1000);
 assert.match(entries[0].path,/^Journal\/2026-11-09 23-25-07-/);
 assert.equal(entries[0].content,'# 2026-11-09\n\nCreated at 23:25:07\n\n## Today\n\n\n## On my mind\n\n\n## Looking ahead\n\n');
});
test('listing excludes deleted entries and other roots; newest first and names-only search',()=>{
 const note=(path:string,deleted=false)=>({...journalEntry(),path,deleted,rev:1,history:[]}) as Note;
 const older=note('Journal/2026-11-08.md'),newer=note('Journal/2026-11-09.md');
 assert.deepEqual(journalEntries([older,newer,note('Projects/A/Note.md'),note('Writing/A.md'),note('Journal/2026-11-10.md',true)]),[newer,older]);
 assert.deepEqual(journalEntries([older,newer],'11-08'),[older]);
 for(const path of ['Journal','Journal/entry.md','Projects','Projects/A/entry.md'])assert.equal(isOrdinaryPath(path),false);
 assert.equal(isOrdinaryPath('Writing/Journal.md'),true);
});
