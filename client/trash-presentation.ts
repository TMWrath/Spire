export type TrashedFileSummary={path:string;kind:'attachment'|'style';size:number;time:string};

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
