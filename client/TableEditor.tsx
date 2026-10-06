import React,{useRef,useState} from 'react';
import {FormattingToolbar,type FormatKind} from './FormattingToolbar';
import {RichTableCell} from './RichTableCell';
import type {Editor} from '@tiptap/react';
import type {TableAlignment} from '../shared/managed-table';
import {X,Plus,Minus} from 'lucide-react';

export function TableEditor({initial,initialAlignments=[],onClose,onSave,editing}:{initial:string[][];initialAlignments?:TableAlignment[];onClose:()=>void;onSave:(cells:string[][],alignments:TableAlignment[])=>void;editing:boolean}){
 const[alignments,setAlignments]=useState<TableAlignment[]>(()=>Array.from({length:initial[0]?.length??1},(_,i)=>initialAlignments[i]??null));
 const[cells,setCells]=useState(()=>initial.map(row=>[...row]));
 const resize=(rows:number,columns:number)=>{setCells(current=>Array.from({length:rows},(_,row)=>Array.from({length:columns},(_,column)=>current[row]?.[column]??'')));setAlignments(current=>Array.from({length:columns},(_,i)=>current[i]??null));};
 const rows=cells.length,columns=cells[0]?.length??1;
 const field=useRef<HTMLInputElement|null>(null),active=useRef<[number,number]>([0,0]),richEditor=useRef<Editor|null>(null);
 const formatMarkdown=(kind:FormatKind,option:number|string=2)=>{
  const editor=richEditor.current;if(!editor||editor.isDestroyed)return;
  const chain=editor.chain().focus();
  if(kind==='bold')chain.toggleBold().run();
  else if(kind==='italic')chain.toggleItalic().run();
  else if(kind==='strike')chain.toggleStrike().run();
  else if(kind==='code')chain.toggleCode().run();
  else if(kind==='heading'){const level=Number(option);if(!level)chain.setParagraph().run();else chain.setHeading({level:level as 1|2|3|4|5|6}).run();}
  else if(kind==='quote')chain.toggleBlockquote().run();
  else if(kind==='list'){
   const style=String(option);
   if(style==='task')chain.toggleTaskList().run();
   else if(['number-dot','number-paren','lower-alpha','upper-alpha'].includes(style)){
    if(!editor.isActive('orderedList'))chain.toggleOrderedList();
    chain.updateAttributes('orderedList',{type:style==='lower-alpha'?'a':style==='upper-alpha'?'A':null}).run();
   }else{if(!editor.isActive('bulletList'))chain.toggleBulletList();chain.run();}
  }
 };
 const formatHtml=(option:'left'|'center'|'right')=>{const column=active.current[1];if(column>=columns)return;setAlignments(current=>Array.from({length:columns},(_,i)=>i===column?option:current[i]??null));richEditor.current?.commands.focus();};
 return <div className="template-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="table-editor" role="dialog" aria-modal="true" aria-label={editing?'Edit Markdown table':'Create Markdown table'}>
  <header className="table-editor-head"><div><small>MARKDOWN / TABLE</small><h2>{editing?'Edit table':'Create a table'}</h2><p>Fill in the grid. The first row becomes the table header.</p></div><button aria-label="Close table editor" onClick={onClose}><X/></button></header>
  <div className="table-size-controls" aria-label="Table size controls"><span>Rows</span><button aria-label="Remove row" disabled={rows<=2} onClick={()=>resize(rows-1,columns)}><Minus/></button><output aria-label="Row count">{rows}</output><button aria-label="Add row" onClick={()=>resize(rows+1,columns)}><Plus/></button><span>Columns</span><button aria-label="Remove column" disabled={columns<=1} onClick={()=>resize(rows,columns-1)}><Minus/></button><output aria-label="Column count">{columns}</output><button aria-label="Add column" onClick={()=>resize(rows,columns+1)}><Plus/></button></div>
  <FormattingToolbar markdownAlignment editor={field} formatMarkdown={formatMarkdown} formatHtml={formatHtml}/>
  <div className="table-grid" style={{gridTemplateColumns:`repeat(${columns},minmax(130px,1fr))`}}>{cells.flatMap((row,rowIndex)=>row.map((value,columnIndex)=><label key={`${rowIndex}-${columnIndex}`}><span>{rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`}</span><RichTableCell source={value} autoFocus={rowIndex===0&&columnIndex===0} label={rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`} alignment={alignments[columnIndex]??null} onActive={editor=>{richEditor.current=editor;active.current=[rowIndex,columnIndex];}} onChange={content=>setCells(current=>current.map((entry,r)=>entry.map((cell,c)=>r===rowIndex&&c===columnIndex?content:cell)))}/></label>))}</div>
  <footer className="table-editor-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(cells,alignments)}>{editing?'Update table':'Insert table'}</button></footer>
 </section></div>;
}
