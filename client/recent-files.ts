import type {Note} from '../shared/model';
export function rememberRecent(current:string[],id:string){return [id,...current.filter(previous=>previous!==id)].slice(0,30);}
export function recentFiles(ids:string[],notes:Note[]):Note[]{const active=new Map(notes.filter(note=>!note.deleted).map(note=>[note.id,note]));return [...new Set(ids)].flatMap(id=>{const note=active.get(id);return note?[note]:[];});}
