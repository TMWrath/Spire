// Spire-owned extraction adapters. Parse data, never evaluate fetched JavaScript.
export type Candidate={url:string;type:string;height:number};
export type Extraction={title:string;author:string;candidates:Candidate[];pages:string[];reason:string;extractor:string};
export type Probe={url:string;type:string;text?:string};
const blank=(extractor='page'):Extraction=>({title:'',author:'',candidates:[],pages:[],reason:'',extractor});
const text=(v:unknown)=>typeof v==='string'?v.slice(0,300):'';
function decode(s:string){return s.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([\da-f]+));/gi,(m,n,h)=>n||h?String.fromCodePoint(Math.min(parseInt(n||h,h?16:10),0x10ffff)):({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[m.toLowerCase()]??m));}
function attrs(tag:string){const a=new Map<string,string>();for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))a.set(m[1].toLowerCase(),decode(m[2]??m[3]??m[4]));return a;}
function absolute(value:unknown,base:string){if(typeof value!=='string'||value.length>8000)return '';try{const u=new URL(value,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';u.hash='';return u.href;}catch{return '';}}
function add(p:Extraction,url:unknown,base:string,type='',height=0){const u=absolute(url,base);if(!u||p.candidates.length>=24||p.candidates.some(c=>c.url===u))return;const mime=type.split(';')[0].toLowerCase();if(!['video/mp4','video/webm','video/ogg'].includes(mime)&&! /\.(mp4|webm|ogv)$/i.test(new URL(u).pathname))return;p.candidates.push({url:u,type:mime,height:Number.isFinite(height)?height:0});}
function embedded(value:unknown,base:string){const u=absolute(value,base);if(!u)return '';const v=new URL(u);if(v.hostname==='player.vimeo.com'&&/^\/video\/\d+(?:\/config)?$/.test(v.pathname))return u;if(['www.youtube.com','www.youtube-nocookie.com'].includes(v.hostname)&&/^\/embed\/[\w-]{11}$/.test(v.pathname))return u;return '';}
function objectAfter(html:string,marker:string):any{const at=html.indexOf(marker);if(at<0)return null;const start=html.indexOf('{',at+marker.length);if(start<0||start-at>100)return null;let depth=0,quoted=false,escaped=false;for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{return null;}}}return null;}
function creator(value:any):string {return typeof value==='string'?text(value):Array.isArray(value)?value.slice(0,4).map(creator).filter(Boolean).join(', ').slice(0,300):text(value?.name);}
export function extractPage(html:string,base:string):Extraction{
 const p=blank();const meta=new Map<string,string>();for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){const a=attrs(tag),key=a.get('property')??a.get('name');if(key)meta.set(key.toLowerCase(),a.get('content')??'');}
 p.title=text(meta.get('og:title'))||text(decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]??''));p.author=text(meta.get('author'));
 for(const key of ['og:video:secure_url','og:video:url','og:video']){const value=meta.get(key);add(p,value,base,meta.get('og:video:type'));const page=embedded(value,base);if(page)p.pages.push(page);}
 let inVideo=false;
 for(const match of html.matchAll(/<\/?(?:video|audio|source)\b[^>]*>/gi)){const tag=match[0];if(/^<\/video/i.test(tag)){inVideo=false;continue;}if(/^<video\b/i.test(tag))inVideo=true;else if(!inVideo||!/^<source\b/i.test(tag))continue;const a=attrs(tag);add(p,a.get('src'),base,a.get('type'));}
 let nodes=0;
 const ld=(value:any,depth=0)=>{if(depth>12||++nodes>1000||!value||typeof value!=='object')return;if(Array.isArray(value)){for(const v of value.slice(0,100))ld(v,depth+1);return;}const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(types.includes('VideoObject')){p.title=p.title||text(value.name);p.author=p.author||creator(value.author)||creator(value.creator);add(p,value.contentUrl,base,text(value.encodingFormat)||'video/mp4');const page=embedded(value.embedUrl,base);if(page)p.pages.push(page);}for(const [k,v]of Object.entries(value)){if(k==='@graph'||k==='video'||k==='mainEntity')ld(v,depth+1);}};
 const lower=html.toLowerCase();let scriptAt=0,scriptCount=0;
 while(scriptCount++<100){const start=lower.indexOf('<script',scriptAt);if(start<0)break;const end=lower.indexOf('>',start),close=lower.indexOf('</script',end);if(end<0||close<0)break;scriptAt=close+8;if(attrs(html.slice(start,end)).get('type')?.toLowerCase()==='application/ld+json'){try{ld(JSON.parse(html.slice(end+1,close)));}catch{/* malformed structured data is not executable code */}}}
 for(const tag of html.match(/<iframe\b[^>]*>/gi)??[]){const page=embedded(attrs(tag).get('src'),base);if(page)p.pages.push(page);}
 const host=new URL(base).hostname;
 if(/(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/.test(host)){
  p.extractor='youtube';const yt=objectAfter(html,'ytInitialPlayerResponse');
  if(yt){p.title=text(yt.videoDetails?.title)||p.title;p.author=text(yt.videoDetails?.author)||p.author;
   if(yt.playabilityStatus?.status&&yt.playabilityStatus.status!=='OK'){p.candidates=[];p.pages=[];p.reason='YouTube reports restricted or unavailable playback. No login or restriction bypass is attempted.';return p;}
   const formats=Array.isArray(yt.streamingData?.formats)?yt.streamingData.formats:[];
   for(const f of formats){if(f&&typeof f==='object'&&!f.drmFamilies&&!f.signatureCipher&&!f.cipher)add(p,f.url,base,text(f.mimeType),Number(f.height));}
   if(!p.candidates.length)p.reason='YouTube did not expose a usable combined stream. Signature-transformed URLs and separate audio/video streams are not implemented.';
  }else p.reason='YouTube did not return public player data. It may require browser verification or an authenticated session.';
 }
 if(host==='vimeo.com'||host==='www.vimeo.com'||host==='player.vimeo.com'){
  p.extractor='vimeo';const u=new URL(base),id=/\/(?:video\/)?(\d+)(?:\/config)?$/.exec(u.pathname)?.[1];
  if(id&&!u.pathname.endsWith('/config')){const config=new URL('https://player.vimeo.com/video/'+id+'/config');if(u.searchParams.has('h'))config.searchParams.set('h',u.searchParams.get('h')!);p.pages.push(config.href);}
  const inline=objectAfter(html,'var playerConfig =');if(inline){const v=extractVimeoConfig(inline,base);p.candidates.push(...v.candidates);p.title=v.title||p.title;p.author=v.author||p.author;}
 }
 p.candidates.sort((a,b)=>b.height-a.height);p.pages=[...new Set(p.pages)].slice(0,4);return p;
}
export function extractVimeoConfig(data:any,base:string):Extraction{const p=blank('vimeo');p.title=text(data?.video?.title);p.author=creator(data?.video?.owner);const files=data?.request?.files;if(files?.drm||data?.video?.is_drm){p.reason='Protected Vimeo media is not supported.';return p;}for(const f of Array.isArray(files?.progressive)?files.progressive:[])add(p,f?.url,base,text(f?.mime),Number(f?.height));p.candidates.sort((a,b)=>b.height-a.height);if(!p.candidates.length)p.reason='Vimeo did not expose a progressive file. Segmented-only or protected playback is not supported yet.';return p;}
export function extractArchiveMetadata(data:any,id:string):Extraction{const p=blank('archive');p.title=creator(data?.metadata?.title);p.author=creator(data?.metadata?.creator);if(!/^[\w.-]+$/.test(id)||id==='.'||id==='..'||data?.is_dark||data?.metadata?.access==='restricted'){p.reason='This archive item is unavailable or restricted.';return p;}for(const f of Array.isArray(data?.files)?data.files:[]){if(!f||typeof f.name!=='string'||f.name.split('/').some((s:string)=>s==='..'||s==='.')||f.private===true||f.private==='true')continue;add(p,'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/'),'https://archive.org');}return p;}
// Transport must enforce SSRF protection, redirect validation, byte and deadline limits.
// Production supplies the same pinned-address transport used for playback.
export async function discoverVideo(input:string,probe:(url:string)=>Promise<Probe>){
 const origin=new URL(input);let title='',author='',reason='',extractor='direct',attempts=0,media='',type='';const seen=new Set<string>();const pages=[input];
 const archive=origin.hostname==='archive.org'&&/^\/details\/([\w.-]+)\/?$/.exec(origin.pathname);if(archive)pages.unshift('https://archive.org/metadata/'+archive[1]);
 while(pages.length&&attempts<12){const next=pages.shift()!;if(seen.has(next))continue;seen.add(next);attempts++;let r:Probe;try{r=await probe(next);}catch{reason='The video host refused or failed the request.';continue;}
  if(['video/mp4','video/webm','video/ogg'].includes(r.type)){media=r.url;type=r.type;break;}
  let p:Extraction;try{const u=new URL(r.url);if(u.hostname==='player.vimeo.com'&&/^\/video\/\d+\/config$/.test(u.pathname))p=extractVimeoConfig(JSON.parse(r.text??''),r.url);else if(u.hostname==='archive.org'&&u.pathname.startsWith('/metadata/'))p=extractArchiveMetadata(JSON.parse(r.text??''),u.pathname.slice('/metadata/'.length));else if(r.type.includes('html'))p=extractPage(r.text??'',r.url);else{reason='This source provides an unsupported format or segmented manifest. Use a local MP4/WebM file.';continue;}}catch{reason='The video host returned malformed player data.';continue;}
  title=title||p.title;author=author||p.author;extractor=p.extractor;reason=p.reason||reason;
  for(const c of p.candidates.slice(0,6)){if(attempts>=12)break;if(seen.has(c.url))continue;seen.add(c.url);attempts++;try{const m=await probe(c.url);if(['video/mp4','video/webm','video/ogg'].includes(m.type)){media=m.url;type=m.type;break;}}catch{/* stale/unsupported rendition: try another bounded candidate */}}
  if(media)break;pages.push(...p.pages);if(pages.length>4)pages.length=4;
 }
 if(!media&&/(^|\.)youtube\.com$|^youtu\.be$/.test(origin.hostname)&&attempts<12){
  try{const meta=await probe('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(input));const data=JSON.parse(meta.text??'');title=text(data.title)||title;author=text(data.author_name)||author;}catch{/* Metadata stays unknown; never invent a creator. */}
 }
 if(!title){try{title=decodeURIComponent(origin.pathname.split('/').pop()||'Online video').slice(0,300);}catch{title='Online video';}}
 return {title,author,media,type,extractor,reason:media?'':reason||'No accessible progressive video was found. Use a local video or Record video tab on a supporting desktop browser.'};
}
