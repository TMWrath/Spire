import {findManagedTableAt,type ManagedTable} from '../shared/managed-table';
import type {ListBuilderStyle} from './ListDialog';

export type DocumentRange={start:number;end:number};
export type DocumentListItem={text:string;depth:number};
export type DocumentList=DocumentRange&{title:string;style:ListBuilderStyle;items:DocumentListItem[]};
export type DocumentTable=ManagedTable&{label:string};

const listLine=/^(\s*)(?:(-\s+\[[ xX]\])|([*+-])|(\d+)[.)]|([A-Za-z]+)[.)])\s+(.+)$/;

type ParsedLine={depth:number;text:string;style:ListBuilderStyle};
function parseListLine(line:string):ParsedLine|null{
 const match=listLine.exec(line);if(!match)return null;
 const depth=Math.floor(match[1].replace(/\t/g,'  ').length/2);
 const style:ListBuilderStyle=match[2]?'checkboxes':match[3]==='-'?'dash':match[3]?'bullets':match[4]?'numbered':'lettered';
 return{depth,text:match[6],style};
}

export function documentLists(content:string):DocumentList[]{
 const lines:Array<{text:string;start:number;end:number}>=[];
 let at=0;for(const text of content.split('\n')){lines.push({text,start:at,end:at+text.length});at+=text.length+1;}
 const result:DocumentList[]=[];let fenced=false;
 for(let i=0;i<lines.length;){
  const line=lines[i];if(/^\s*(```|~~~)/.test(line.text)){fenced=!fenced;i++;continue;}
  const first=fenced?null:parseListLine(line.text);if(!first){i++;continue;}
  const items:DocumentListItem[]=[];let end=line.end,j=i;
  while(j<lines.length){const parsed=parseListLine(lines[j].text);if(!parsed)break;items.push({text:parsed.text,depth:parsed.depth});end=lines[j].end;j++;}
  let start=line.start,title='';
  const before=content.slice(0,start);const heading=/(?:^|\n)(#{1,6})[ \t]+([^\n]+)\n\n$/.exec(before);
  if(heading){title=heading[2].trim();start=before.length-heading[0].length+(heading[0].startsWith('\n')?1:0);}
  result.push({start,end,title,style:first.style,items});i=j;
 }
 return result;
}

export function documentTables(content:string):DocumentTable[]{
 const tables:DocumentTable[]=[];let from=0;
 while(true){const start=content.indexOf('<!-- spire:table id=',from);if(start<0)break;const table=findManagedTableAt(content,start);if(!table){from=start+1;continue;}const header=table.cells[0]?.map(cell=>cell.trim()).filter(Boolean)??[];tables.push({...table,label:header.length?header.join(' · '):`Table ${tables.length+1}`});from=table.end;}
 return tables;
}

export function replaceDocumentStructure(content:string,range:DocumentRange,replacement:string){
 if(range.start<0||range.end<range.start||range.end>content.length)throw new Error('Document structure range is no longer valid.');
 return content.slice(0,range.start)+replacement+content.slice(range.end);
}
