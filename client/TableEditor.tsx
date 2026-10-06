import React,{useRef,useState} from 'react';
import {FormattingToolbar,type FormatKind} from './FormattingToolbar';
import {formatText} from './formatting';
import {X,Plus,Minus} from 'lucide-react';

export function TableEditor({initial,onClose,onSave,editing}:{initial:string[][];onClose:()=>void;onSave:(cells:string[][])=>void;editing:boolean}){
 const[cells,setCells]=useState(()=>initial.map(row=>[...row]));
 const resize=(rows:number,columns:number)=>setCells(current=>Array.from({length:rows},(_,row)=>Array.from({length:columns},(_,column)=>current[row]?.[column]??'')));
 const rows=cells.length,columns=cells[0]?.length??1;
 const field=useRef<HTMLInputElement|null>(null),active=useRef<[number,number]>([0,0]);
 const update=(content:string,start:number,end:number)=>{const [row,column]=active.current;setCells(current=>current.map((entry,r)=>entry.map((cell,c)=>r===row&&c===column?content:cell)));requestAnimationFrame(()=>{field.current?.focus();field.current?.setSelectionRange(start,end);});};
 const formatMarkdown=(kind:FormatKind,option:number|string=2)=>{const input=field.current;if(!input)return;const result=formatText(input.value,input.selectionStart??0,input.selectionEnd??0,kind,option);update(result.content,result.start,result.end);};
 const formatHtml=(option:'left'|'center'|'right')=>{const input=field.current;if(!input)return;const start=input.selectionStart??0,end=input.selectionEnd??0,text=input.value.slice(start,end)||'Text';const prefix=`<div align="${option}">`,suffix='</div>';update(input.value.slice(0,start)+prefix+text+suffix+input.value.slice(end),start+prefix.length,start+prefix.length+text.length);};
 return <div className="template-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="table-editor" role="dialog" aria-modal="true" aria-label={editing?'Edit Markdown table':'Create Markdown table'}>
  <header className="table-editor-head"><div><small>MARKDOWN / TABLE</small><h2>{editing?'Edit table':'Create a table'}</h2><p>Fill in the grid. The first row becomes the table header.</p></div><button aria-label="Close table editor" onClick={onClose}><X/></button></header>
  <div className="table-size-controls" aria-label="Table size controls"><span>Rows</span><button aria-label="Remove row" disabled={rows<=2} onClick={()=>resize(rows-1,columns)}><Minus/></button><output aria-label="Row count">{rows}</output><button aria-label="Add row" onClick={()=>resize(rows+1,columns)}><Plus/></button><span>Columns</span><button aria-label="Remove column" disabled={columns<=1} onClick={()=>resize(rows,columns-1)}><Minus/></button><output aria-label="Column count">{columns}</output><button aria-label="Add column" onClick={()=>resize(rows,columns+1)}><Plus/></button></div>
  <FormattingToolbar editor={field} formatMarkdown={formatMarkdown} formatHtml={formatHtml}/>
  <div className="table-grid" style={{gridTemplateColumns:`repeat(${columns},minmax(130px,1fr))`}}>{cells.flatMap((row,rowIndex)=>row.map((value,columnIndex)=><label key={`${rowIndex}-${columnIndex}`}><span>{rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`}</span><input autoFocus={rowIndex===0&&columnIndex===0} onFocus={event=>{field.current=event.currentTarget;active.current=[rowIndex,columnIndex];}} aria-label={rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`} value={value} placeholder={rowIndex===0?'Heading':'Text'} onChange={event=>setCells(current=>current.map((entry,r)=>entry.map((cell,c)=>r===rowIndex&&c===columnIndex?event.target.value:cell)))}/></label>))}</div>
  <footer className="table-editor-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(cells)}>{editing?'Update table':'Insert table'}</button></footer>
 </section></div>;
}
