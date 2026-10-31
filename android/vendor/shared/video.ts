import {citationMarkdown,escapeCitation,type Source} from './sources';
export function videoTime(seconds:number){const ms=Math.max(0,Math.round((Number.isFinite(seconds)?seconds:0)*1000));return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');}
export function videoCaptureMarkdown(source:Source,filePath:string,path:string,start:number,end?:number){
 const relative='../'.repeat(filePath.split('/').length-1)+path;
 const locator=videoTime(start)+(end!==undefined?'–'+videoTime(end):'');
 const label=escapeCitation(source.title+' · '+locator);
 const media=end===undefined?`![${label}](${encodeURI(relative)})`:`<video controls src="${encodeURI(relative)}"></video>`;
 let original='';if(source.url){let u=new URL(source.url);if(/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname))u.searchParams.set('t',String(Math.floor(start)));original=` · [Original video](${u.href.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;}
 return `\n\n${media}\n\n${citationMarkdown(source,filePath,locator)}${original}\n\n`;
}
