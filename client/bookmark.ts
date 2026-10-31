import {metadata} from '../shared/model';
import {parseDocument,isMap} from 'yaml';
export type FileBookmark={version:1;mode:'source'|'editor';region:'body'|'header'|'footer';offset:number;before:string;after:string};
export const bookmarkKey='spire_bookmark';
export function readBookmark(content:string):FileBookmark|null{
 const b=metadata(content).properties[bookmarkKey] as Partial<FileBookmark>|undefined;
 if(!b||b.version!==1||!['source','editor'].includes(b.mode??'')||!['body','header','footer'].includes(b.region??'')||!Number.isSafeInteger(b.offset)||Number(b.offset)<0||typeof b.before!=='string'||typeof b.after!=='string'||b.before.length>48||b.after.length>48)return null;
 return b as FileBookmark;
}
export function captureBookmark(text:string,offset:number,mode:FileBookmark['mode'],region:FileBookmark['region']='body'):FileBookmark{
 offset=Math.max(0,Math.min(text.length,offset));return {version:1,mode,region,offset,before:text.slice(Math.max(0,offset-48),offset),after:text.slice(offset,offset+48)};
}
export function bookmarkOffset(text:string,b:FileBookmark):number{
 const candidates:number[]=[];const add=(needle:string,delta:number)=>{if(!needle)return;let start=0;for(let i=0;i<1000;i++){const at=text.indexOf(needle,start);if(at<0)break;candidates.push(at+delta);start=at+1;}};
 const both=b.before+b.after;add(both,b.before.length);
 if(!candidates.length){add(b.before,b.before.length);add(b.after,0);}
 return candidates.length?candidates.sort((a,c)=>Math.abs(a-b.offset)-Math.abs(c-b.offset))[0]:Math.min(text.length,b.offset);
}
export function writeBookmark(content:string,bookmark:FileBookmark|null):string{const m=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);if(/^---\r?\n/.test(content)&&!m)throw new Error('Fix YAML frontmatter before changing the bookmark.');const doc=parseDocument(m?.[1]??'');if(doc.errors.length||(doc.contents&&!isMap(doc.contents)))throw new Error('Fix YAML frontmatter before changing the bookmark.');if(bookmark)doc.set(bookmarkKey,bookmark);else doc.delete(bookmarkKey);return `---\n${doc.toString()}---\n${m?content.slice(m[0].length):content}`;}
