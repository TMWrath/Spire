export const listTagLine = /^<!-- spire:list-labels ([^<>]+) -->(?:\r?\n|$)/m;
export function normalizeListTags(values:string[]) {
 const seen=new Set<string>();
 return values.map(value=>value.trim().normalize('NFC')).filter(value=>{
  const key=value.toLowerCase();
  if(!value||value.length>60||seen.has(key))return false;
  seen.add(key);return true;
 }).slice(0,30);
}
export function decodeListTags(value?:string){
 try{return normalizeListTags(JSON.parse(decodeURIComponent(value??'')).filter((x:unknown)=>typeof x==='string'));}catch{return [];}
}
export const encodeListTags=(tags:string[])=>encodeURIComponent(JSON.stringify(tags)).replace(/-/g,'%2D');
export function setListLabels(content:string,tags:string[]){
 const existing=listTagLine.exec(content),newline=existing?.[0].endsWith('\r\n')||(!existing&&content.includes('\r\n'))?'\r\n':'\n';
 const marker=tags.length?`<!-- spire:list-labels ${encodeListTags(tags)} -->`:'';
 if(existing)return content.slice(0,existing.index)+(marker?marker+(existing[0].endsWith('\n')?newline:''):'')+content.slice(existing.index+existing[0].length);
 return marker?content+(content.endsWith('\n')||!content?'':newline)+marker+newline:content;
}
