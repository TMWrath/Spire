import {marked,type Tokens} from 'marked';
export type ContentsEntry={level:number;text:string;id:string};
export function headingText(tokens:Tokens.Generic[]):string{return tokens.map(t=>t.type==='html'?'':Array.isArray(t.tokens)?headingText(t.tokens):String(t.text??'')).join('');}
export function headingId(text:string){return text.toLowerCase().trim().replace(/[^\p{L}\p{N}_\s-]/gu,'').replace(/\s+/g,'-')||'section';}
export function tableOfContents(body:string):ContentsEntry[]{
 const used=new Map<string,number>();
 return marked.lexer(body).filter((t):t is Tokens.Heading=>t.type==='heading').map(t=>{const text=headingText(t.tokens),base=headingId(text),count=used.get(base)??0;used.set(base,count+1);return {level:t.depth,text,id:base+(count?`-${count}`:'')};});
}
export function contentsMarkdown(body:string){return tableOfContents(body).map(e=>`${'  '.repeat(e.level-1)}- [${e.text.replace(/[\\\[\]]/g,'\\$&')}](${encodeURI('#'+e.id)})`).join('\n');}
