import type {Note} from '../shared/model';
const key=(owner:string)=>'spire-recent-files:'+owner;
export function readRecent(owner:string):string[]{try{const value=JSON.parse(localStorage.getItem(key(owner))??'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):[];}catch{return [];}}
export function rememberRecent(owner:string,id:string){const ids=[id,...readRecent(owner).filter(previous=>previous!==id)].slice(0,30);try{localStorage.setItem(key(owner),JSON.stringify(ids));}catch{}return ids;}
export function recentFiles(ids:string[],notes:Note[]):Note[]{const active=new Map(notes.filter(note=>!note.deleted).map(note=>[note.id,note]));return [...new Set(ids)].flatMap(id=>{const note=active.get(id);return note?[note]:[];});}
