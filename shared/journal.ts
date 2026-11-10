import type {Note} from './model';

// Storage identity does not change when the display preference changes.
export const journalRoot='Journal';
export const isJournalPath=(path:string)=>path.toLowerCase()==='journal'||path.toLowerCase().startsWith('journal/');
export const isOrdinaryPath=(path:string)=>!isJournalPath(path)&&path!=='Projects'&&!path.startsWith('Projects/');
export function journalEntry(now=new Date(),id=crypto.randomUUID()){
 const part=(n:number)=>String(n).padStart(2,'0');
 const date=`${now.getFullYear()}-${part(now.getMonth()+1)}-${part(now.getDate())}`;
 const time=`${part(now.getHours())}:${part(now.getMinutes())}:${part(now.getSeconds())}`;
 return {id,path:`${journalRoot}/${date} ${time.replaceAll(':','-')}-${id}.md`,content:`# ${date}\n\nCreated at ${time}\n\n## Today\n\n\n## On my mind\n\n\n## Looking ahead\n\n`,time:now.toISOString()};
}
export function journalEntries(notes:Note[],query=''){
 const q=query.trim().toLowerCase();
 return notes.filter(n=>!n.deleted&&isJournalPath(n.path)&&(!q||n.path.toLowerCase().includes(q))).sort((a,b)=>b.path.localeCompare(a.path));
}
