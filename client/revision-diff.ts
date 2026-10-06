import {diffLines} from 'diff';
import type {Revision} from '../shared/model';
export function revisionChanges(previous:Revision|undefined,current:Revision){
 let oldLine=1,newLine=1,added=0,removed=0;
 const rows=diffLines(previous?.content??'',current.content).flatMap(part=>{
 const kind=part.added?'added':part.removed?'removed':'same';
 const lines=part.value.split('\n');if(lines.at(-1)==='')lines.pop();
 return lines.map(text=>{if(part.added)added++;if(part.removed)removed++;return {kind,text,oldLine:part.added?null:oldLine++,newLine:part.removed?null:newLine++};});
 });
 return {rows,added,removed,renamed:!!previous&&previous.path!==current.path,status:!previous?'Created':previous.deleted!==current.deleted?(current.deleted?'Moved to trash':'Restored from trash'):null,newlineChanged:!!previous&&previous.content.endsWith('\n')!==current.content.endsWith('\n')};
}
