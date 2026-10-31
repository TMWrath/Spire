export const caseStyles=[{id:'upper',name:'UPPERCASE'},{id:'lower',name:'lowercase'},{id:'title',name:'Title Case'},{id:'sentence',name:'Sentence case'},{id:'toggle',name:'tOGGLE cASE'}] as const;
export type CaseStyle=typeof caseStyles[number]['id'];
/** Output boundaries retain UTF-16 positions even when casing expands a letter (ß → SS). */
export function caseMap(text:string,style:string){
 let output='',wordStart=true,sentenceStart=true;const boundaries:number[]=[0];
 for(const letter of text){
  let changed=letter;
  if(style==='upper')changed=letter.toUpperCase();
  else if(style==='lower')changed=letter.toLowerCase();
  else if(style==='toggle')changed=letter===letter.toUpperCase()?letter.toLowerCase():letter.toUpperCase();
  else if(style==='title')changed=wordStart?letter.toUpperCase():letter.toLowerCase();
  else if(style==='sentence')changed=sentenceStart?letter.toUpperCase():letter.toLowerCase();
  const previous=output.length;output+=changed;
  for(let i=1;i<=letter.length;i++)boundaries.push(i===letter.length?output.length:previous);
  if(/\p{L}/u.test(letter))sentenceStart=false;
  if(/[.!?\n]/u.test(letter))sentenceStart=true;
  if(/[\p{L}\p{M}\p{N}]/u.test(letter))wordStart=false;
  else if(!/['’]/u.test(letter))wordStart=true;
 }
 return {text:output,boundaries};
}
export function changeCase(text:string,style:string){return caseMap(text,style).text;}
export function wordRange(text:string,cursor:number){
 for(const match of text.matchAll(/[\p{L}\p{M}\p{N}_]+(?:['’][\p{L}\p{M}\p{N}_]+)*/gu)){
  const start=match.index,end=start+match[0].length;if(start<=cursor&&cursor<=end)return {start,end};
 }
 return {start:cursor,end:cursor};
}
export function caseSelection(content:string,start:number,end:number,style:string){
 if(start===end)({start,end}=wordRange(content,start));
 const replacement=changeCase(content.slice(start,end),style);
 return {content:content.slice(0,start)+replacement+content.slice(end),start,end:start+replacement.length};
}
