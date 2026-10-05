import React,{useState} from 'react';
import {X,Plus,Minus} from 'lucide-react';

export function TableEditor({initial,onClose,onSave,editing}:{initial:string[][];onClose:()=>void;onSave:(cells:string[][])=>void;editing:boolean}){
 const[cells,setCells]=useState(()=>initial.map(row=>[...row]));
 const resize=(rows:number,columns:number)=>setCells(current=>Array.from({length:rows},(_,row)=>Array.from({length:columns},(_,column)=>current[row]?.[column]??'')));
 const rows=cells.length,columns=cells[0]?.length??1;
 return <div className="template-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="table-editor" role="dialog" aria-modal="true" aria-label={editing?'Edit Markdown table':'Create Markdown table'}>
  <header className="table-editor-head"><div><small>MARKDOWN / TABLE</small><h2>{editing?'Edit table':'Create a table'}</h2><p>Fill in the grid. The first row becomes the table header.</p></div><button aria-label="Close table editor" onClick={onClose}><X/></button></header>
  <div className="table-size-controls" aria-label="Table size controls"><span>Rows</span><button aria-label="Remove row" disabled={rows<=2} onClick={()=>resize(rows-1,columns)}><Minus/></button><output aria-label="Row count">{rows}</output><button aria-label="Add row" onClick={()=>resize(rows+1,columns)}><Plus/></button><span>Columns</span><button aria-label="Remove column" disabled={columns<=1} onClick={()=>resize(rows,columns-1)}><Minus/></button><output aria-label="Column count">{columns}</output><button aria-label="Add column" onClick={()=>resize(rows,columns+1)}><Plus/></button></div>
  <div className="table-grid" style={{gridTemplateColumns:`repeat(${columns},minmax(130px,1fr))`}}>{cells.flatMap((row,rowIndex)=>row.map((value,columnIndex)=><label key={`${rowIndex}-${columnIndex}`}><span>{rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`}</span><input aria-label={rowIndex===0?`Header ${columnIndex+1}`:`Row ${rowIndex}, column ${columnIndex+1}`} value={value} placeholder={rowIndex===0?'Heading':'Text'} onChange={event=>setCells(current=>current.map((entry,r)=>entry.map((cell,c)=>r===rowIndex&&c===columnIndex?event.target.value:cell)))}/></label>))}</div>
  <footer className="table-editor-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(cells)}>{editing?'Update table':'Insert table'}</button></footer>
 </section></div>;
}
