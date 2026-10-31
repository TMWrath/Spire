export type BlockKind='code'|'quote';
export function blockMarkdown(kind:BlockKind,text:string,language:string=""):string{
 const value=text.replace(/\r\n?/g,'\n');
 if(kind==='quote')return value.split('\n').map(line=>line?'> '+line:'>').join('\n');
 // A pasted fence must remain literal content, never close the surrounding block.
 const runs=value.match(/`+/g)??[];
 const fence='`'.repeat(Math.max(3,...runs.map(run=>run.length+1)));
 return fence+language.replace(/[^a-zA-Z0-9_+#.-]/g,'')+'\n'+value+'\n'+fence;
}
export function insertBlock(source:string,start:number,end:number,kind:BlockKind,text:string,language:string=""){
 const left=source.slice(0,start),right=source.slice(end),block=blockMarkdown(kind,text,language);
 const before=left?left+('\n\n'.slice(Math.min(2,left.match(/\n*$/)![0].length))):'';
 const after=right?('\n\n'.slice(Math.min(2,right.match(/^\n*/)![0].length)))+right:'';
 return {content:before+block+after,caret:before.length+block.length};
}
