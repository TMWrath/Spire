import {marked} from 'marked';

type Block={kind:'block';source:string;token:ReturnType<typeof marked.lexer>[number]}|{kind:'gap';newlines:number};
/** Represent surplus separators as editable empty paragraphs, not discarded lexer space. */
export function blankLineTokens(source:string):Block[]{
 const result:Block[]=[];let pending='',hasBlock=false;
 const gap=(n:number)=>{while(n>0){const count=Math.min(n,2);result.push({kind:'gap',newlines:count});n-=count;}};
 for(const token of marked.lexer(source)){
  if(token.type==='space'){pending+=token.raw;continue;}
  const newlines=(pending.match(/\n/g)??[]).length;
  gap(Math.max(0,newlines-(hasBlock?2:0)));pending='';
  const trailing=/\n+$/.exec(token.raw)?.[0]??'';
  result.push({kind:'block',source:token.raw.slice(0,token.raw.length-trailing.length),token});
  pending=trailing;hasBlock=true;
 }
 gap((pending.match(/\n/g)??[]).length);
 return result;
}
export function joinEditorBlocks(blocks:({text:string}|{blankNewlines:number})[]):string{
 let source='',hasBlock=false;
 for(const block of blocks){
  if('blankNewlines' in block){source+='\n'.repeat(block.blankNewlines);continue;}
  if(hasBlock)source+='\n\n';source+=block.text;hasBlock=true;
 }
 return source;
}
