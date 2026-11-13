export type TrashedFileSummary={path:string;kind:'attachment'|'style';size:number;time:string};
export type TrashGroupEntry<TNote,TFile>={key:string;path:string;folder:string;name:string;note?:TNote;file?:TFile};

export function groupTrashEntries<TNote extends {id:string;path:string},TFile extends {id:string;path:string}>(notes:TNote[],files:TFile[]){
 const entry=(path:string,key:string,note?:TNote,file?:TFile):TrashGroupEntry<TNote,TFile>=>{const parts=path.split('/'),name=parts.pop()??path;return {key,path,name,folder:parts.join('/')||'Workspace root',note,file};};
 const entries=[...notes.map(note=>entry(note.path,'note:'+note.id,note)),...files.map(file=>entry(file.path,'file:'+file.id,undefined,file))];
 const grouped=new Map<string,TrashGroupEntry<TNote,TFile>[]>();
 for(const item of entries){const group=grouped.get(item.folder)??[];group.push(item);grouped.set(item.folder,group);}
 return Array.from(grouped.entries()).map(([folder,items])=>({folder,items:items.sort((a,b)=>a.name.localeCompare(b.name))})).sort((a,b)=>a.folder.localeCompare(b.folder));
}

const generatedSuffix=/-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const labels:Record<string,string>={
 css:'CSS stylesheet',jpg:'JPG image',jpeg:'JPEG image',png:'PNG image',gif:'GIF image',webp:'WebP image',svg:'SVG image',pdf:'PDF document',webm:'WebM media',mp3:'MP3 audio',ogg:'OGG audio',wav:'WAV audio',m4a:'M4A audio',mp4:'MP4 video',json:'JSON data',html:'HTML document',htm:'HTML document',txt:'Text file',docx:'Word document'
};
function fileSize(bytes:number){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;return `${(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)} MB`;}
export function trashFilePresentation(file:TrashedFileSummary){
 const parts=file.path.split('/').filter(Boolean),name=parts.pop()||file.path;
 const location=parts.length?parts.map(part=>part.replace(generatedSuffix,'')).join(' / '):'Workspace root';
 const extension=name.includes('.')?name.split('.').pop()!.toLowerCase():'';
 return {name,location,type:file.kind==='style'?'CSS stylesheet':labels[extension]??(extension?`${extension.toUpperCase()} file`:'File'),size:fileSize(file.size),deleted:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(file.time))};
}
