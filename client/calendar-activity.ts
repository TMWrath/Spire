import type {Note} from '../shared/model';

export type CalendarActivity={created:Note[];edited:Note[]};
const dayKey=(value:string)=>{const date=new Date(value);if(!value||Number.isNaN(date.getTime()))return null;return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const uniqueSorted=(notes:Note[])=>[...new Map(notes.map(note=>[note.id,note])).values()].sort((a,b)=>a.path.localeCompare(b.path));

export function calendarActivity(notes:Note[]){
 const activity=new Map<string,CalendarActivity>();
 const add=(day:string,kind:keyof CalendarActivity,note:Note)=>{const entry=activity.get(day)??{created:[],edited:[]};entry[kind].push(note);activity.set(day,entry);};
 for(const note of notes){
  if(note.deleted)continue;
  const createdAt=note.history[0]?.time||note.time,createdDay=dayKey(createdAt);
  if(createdDay)add(createdDay,'created',note);
  const editTimes=new Set(note.history.slice(1).map(revision=>revision.time).filter(Boolean));
  if(note.rev>1&&note.time&&note.time!==createdAt)editTimes.add(note.time);
  for(const time of editTimes){const editedDay=dayKey(time);if(editedDay)add(editedDay,'edited',note);}
 }
 for(const [day,entry] of activity)activity.set(day,{created:uniqueSorted(entry.created),edited:uniqueSorted(entry.edited)});
 return activity;
}
