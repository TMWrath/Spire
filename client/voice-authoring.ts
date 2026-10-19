export type TranscriptMode='verbatim'|'clean'|'structured';
export const voiceCommands=['new paragraph','new line','heading one','heading two','heading three','heading four','heading five','heading six','normal text','start bullet list','start numbered list','next item','checklist item','end list','start quote','end quote','start bold','end bold','start italic','end italic','undo that','delete last sentence','literal text','end literal text'] as const;
/** Deterministic, bounded grammar. Never dispatch speech to operating-system actions. */
export function dictatedMarkdown(text:string,enabled:boolean):{markdown:string;commands:string[]} {
 if(!enabled)return {markdown:text,commands:[]};
 let output='',literal=false,list='',number=1,quote=false,bold=false,italic=false;
 const commands:string[]=[],history:string[]=[];
 const append=(s:string)=>{const value=s.trim();if(value)output+=(output&&!/[\n *]$/.test(output)?' ':'')+value;};
 const boundary=(s:string)=>{output=output.trimEnd()+s;};
 const pattern=/\bspire\s*,?\s+(end literal text|literal text|new paragraph|new line|heading (?:one|two|three|four|five|six)|normal text|start bullet list|start numbered list|next item|checklist item|end list|start quote|end quote|start bold|end bold|start italic|end italic|undo that|delete last sentence)\b[.,:;!?]?\s*/gi;
 let offset=0;
 for(const match of text.matchAll(pattern)){
  append(text.slice(offset,match.index));offset=match.index!+match[0].length;
  const command=match[1].toLowerCase();
  if(literal&&command!=='end literal text'){append(match[0]);continue;}
  commands.push(command);
  if(command==='literal text'){literal=true;continue;}
  if(command==='end literal text'){literal=false;continue;}
  if(command==='undo that'){output=history.pop()??output;continue;}
  history.push(output);
  if(command==='new paragraph'||command==='normal text'){boundary('\n\n');continue;}
  if(command==='new line'){boundary('\n'+(quote?'> ':''));continue;}
  if(command.startsWith('heading ')){const n=['one','two','three','four','five','six'].indexOf(command.slice(8))+1;boundary((output?'\n\n':'')+'#'.repeat(n)+' ');continue;}
  if(command==='start bullet list'||command==='start numbered list'){list=command==='start bullet list'?'-':'number';number=1;boundary((output?'\n\n':'')+(list==='number'?`${number++}. `:'- '));continue;}
  if(command==='next item'){if(list)boundary('\n'+(list==='number'?`${number++}. `:'- '));else append(match[0]);continue;}
  if(command==='checklist item'){list='-';boundary((output?'\n':'')+'- [ ] ');continue;}
  if(command==='end list'){list='';boundary('\n\n');continue;}
  if(command==='start quote'){quote=true;boundary((output?'\n\n':'')+'> ');continue;}
  if(command==='end quote'){quote=false;boundary('\n\n');continue;}
  if(command==='start bold'){if(!bold){if(output&&!/\s$/.test(output))output+=' ';output+='**';bold=true;}continue;}
  if(command==='end bold'){if(bold){output=output.trimEnd()+'** ';bold=false;}continue;}
  if(command==='start italic'){if(!italic){if(output&&!/\s$/.test(output))output+=' ';output+='*';italic=true;}continue;}
  if(command==='end italic'){if(italic){output=output.trimEnd()+'* ';italic=false;}continue;}
  if(command==='delete last sentence')output=output.trimEnd().replace(/[^.!?\n]+[.!?]?$/,'').trimEnd();
 }
 append(text.slice(offset));
 if(italic)output=output.trimEnd()+'*';if(bold)output=output.trimEnd()+'**';
 return {markdown:output.trim(),commands};
}
export function transcriptFile(title:string,raw:string,mode:TranscriptMode):string {
 const heading=title.replace(/[\r\n]/g,' ').trim()||'Transcript';
 const clean=raw.replace(/\b(?:um|uh)\b[, ]*/gi,'').replace(/[ \t]+/g,' ').trim();
 if(mode==='verbatim')return `# ${heading}\n\n## Full transcript\n\n${raw}\n`;
 if(mode==='clean')return `# ${heading}\n\n## Clean transcript\n\n${clean}\n\n## Original transcript\n\n${raw}\n`;
 // Extractive formatting only: no invented summaries, identities or action items.
 const paragraphs=clean.split(/(?<=[.!?])\s+/).reduce<string[]>((all,s,i)=>{const n=Math.floor(i/4);all[n]=(all[n]?all[n]+' ':'')+s;return all;},[]);
 return `# ${heading}\n\n## Reading copy\n\n${paragraphs.join('\n\n')}\n\n## Full transcript\n\n${raw}\n`;
}
export function validateVoiceTarget(captured:{id:string;content:string},current:{id:string;content:string;deleted?:boolean}|null|undefined):void {
 if(!current||current.deleted||current.id!==captured.id||current.content!==captured.content)throw new Error('The file changed while voice authoring was open. Copy or download your transcript, then reopen voice authoring at the intended position.');
}
