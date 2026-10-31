import DOMPurify from 'dompurify';
import {metadata,type Note} from '../shared/model';
import {renderMarkdown,attachmentTarget} from './markdown';
import {attachmentUrl} from './attachment-urls';

export type MediaKind='image'|'video'|'audio';
export type FileMedia={kind:MediaKind;url:string;name:string;key:string;missing:boolean};
export function resolveMediaSource(from:string,raw:string,attachments:string[]):{url:string;name:string;missing:boolean}|null{
 let src=raw.trim();if(!src)return null;
 if(/^\/api\/attachment\?/.test(src)){try{src=new URL(src,'https://spire.invalid').searchParams.get('path')??'';}catch{return null;}}
 if(/^(?:https?:\/\/|blob:)/i.test(src)){try{const u=new URL(src);return {url:src,name:decodeURIComponent(u.pathname.split('/').at(-1)||'Media'),missing:false};}catch{return null;}}
 if(/^data:(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|audio\/[\w.+-]+|video\/[\w.+-]+)[;,]/i.test(src))return {url:src,name:'Embedded media',missing:false};
 if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(src))return null;
 try{src=decodeURIComponent(src);}catch{return null;}
 src=src.split('#')[0];
 const found=attachmentTarget(from,src,attachments);
 if(found)return {url:attachmentUrl(found),name:found.split('/').at(-1)!,missing:false};
 const parts=from.split('/').slice(0,-1);for(const part of src.split('/')){if(part==='..'){if(!parts.length)return null;parts.pop();}else if(part!=='.'&&part)parts.push(part);}
 const path=src.startsWith('Attachments/')?src:parts.join('/');
 if(!path||/[\x00-\x1f\\]/.test(path))return null;
 return {url:attachmentUrl(path),name:path.split('/').at(-1)!,missing:true};
}
export function collectFileMedia(note:Note,notes:Note[],attachments:string[]):FileMedia[]{
 // Reuse the reader renderer: fenced code is excluded, wiki embeds and nested
 // note excerpts resolve exactly as in the document, with its cycle/depth guard.
 const html=DOMPurify.sanitize(renderMarkdown(note,notes,attachments),{FORBID_TAGS:['style','script','iframe','form']});
 const doc=new DOMParser().parseFromString(html,'text/html');const items:FileMedia[]=[];const seen=new Set<string>();
 const add=(kind:MediaKind,src:string,label?:string,from=note.path)=>{const item=resolveMediaSource(from,src,attachments);if(!item)return;const key=kind+':'+item.url.split('#')[0];if(seen.has(key))return;seen.add(key);items.push({...item,key,kind,name:label?.trim()||item.name});};
 for(const el of doc.querySelectorAll('img,audio,video,a[href]')){
  if(el.closest('pre,code'))continue;
  const tag=el.tagName.toLowerCase();
  if(tag==='a'){const href=el.getAttribute('href')??'';const ext=href.split(/[?#]/)[0].split('.').at(-1)?.toLowerCase();const kind=ext&&(/^(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(ext)?'image':/^(mp4|webm|mov|m4v|ogv)$/.test(ext)?'video':/^(mp3|ogg|wav|m4a|flac|aac|opus)$/.test(ext)?'audio':null);if(kind)add(kind,href,el.textContent??undefined);continue;}
  const kind=tag==='img'?'image':tag as MediaKind;const src=el.getAttribute('src')||el.querySelector('source[src]')?.getAttribute('src');
  if(src){const embeddedPath=el.closest('.note-embed')?.querySelector(':scope > a')?.getAttribute('href');let from=note.path;try{if(embeddedPath)from=decodeURI(embeddedPath);}catch{}add(kind,src,el.getAttribute('alt')||el.getAttribute('title')||undefined,from);}
  if(tag==='video'&&el.getAttribute('poster'))add('image',el.getAttribute('poster')!);
 }
 const hero=metadata(note.content).properties.hero;if(typeof hero==='string')add('image',hero);
 return items;
}
