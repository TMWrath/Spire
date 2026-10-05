export type ManagedTable={id:string;start:number;end:number;cells:string[][]};

const startPattern='<!-- spire:table id=';
const endMarker='<!-- /spire:table -->';

const splitRow=(line:string)=>{
 const inner=line.trim().replace(/^\|/,'').replace(/\|$/,'');
 const cells:string[]=[];let cell='';let escaped=false;
 for(const char of inner){
  if(escaped){cell+=char;escaped=false;continue;}
  if(char==='\\'){escaped=true;cell+=char;continue;}
  if(char==='|'){cells.push(cell.trim().replace(/\\\|/g,'|').replace(/\\\\/g,'\\'));cell='';continue;}
  cell+=char;
 }
 cells.push(cell.trim().replace(/\\\|/g,'|').replace(/\\\\/g,'\\'));
 return cells;
};

export function findManagedTableAt(content:string,offset:number):ManagedTable|null{
 let from=0;
 while(true){
  const start=content.indexOf(startPattern,from);if(start<0)return null;
  const markerEnd=content.indexOf('-->',start);if(markerEnd<0)return null;
  const endAt=content.indexOf(endMarker,markerEnd+3);if(endAt<0)return null;
  const end=endAt+endMarker.length;
  if(offset>=start&&offset<=end){
   const id=content.slice(start+startPattern.length,markerEnd).trim();
   const lines=content.slice(markerEnd+3,endAt).trim().split('\n').filter(Boolean);
   const rows=lines.filter((_,index)=>index!==1).map(splitRow);
   if(!rows.length)return null;
   const columns=Math.max(...rows.map(row=>row.length));
   return{id,start,end,cells:rows.map(row=>Array.from({length:columns},(_,index)=>row[index]??''))};
  }
  from=end;
 }
}

const escapeCell=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
export function managedTableMarkdown(id:string,cells:string[][]){
 const columns=Math.max(1,...cells.map(row=>row.length));
 const rows=(cells.length?cells:[[]]).map(row=>Array.from({length:columns},(_,index)=>escapeCell(row[index]??'')));
 const line=(row:string[])=>`| ${row.join(' | ')} |`;
 return `${startPattern}${id} -->\n${line(rows[0])}\n${line(Array(columns).fill('---'))}\n${rows.slice(1).map(line).join('\n')}\n${endMarker}`;
}

export function placeManagedTable(content:string,offset:number,cells:string[][],existing?:ManagedTable|null,id=crypto.randomUUID()){
 const markdown=managedTableMarkdown(existing?.id??id,cells);
 if(existing)return{content:content.slice(0,existing.start)+markdown+content.slice(existing.end),start:existing.start,end:existing.start+markdown.length,id:existing.id};
 const before=content.slice(0,offset),after=content.slice(offset);const prefix=before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';const suffix=after&&!after.startsWith('\n\n')?(after.startsWith('\n')?'\n':'\n\n'):'';const start=offset+prefix.length;
 return{content:before+prefix+markdown+suffix+after,start,end:start+markdown.length,id};
}
