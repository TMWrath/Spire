import React,{useEffect,useRef,useState} from 'react';
import {GripVertical,List as ListIcon,Plus,Trash2,X} from 'lucide-react';

export type ListBuilderStyle='bullets'|'numbered'|'checkboxes'|'dash'|'lettered';
type DraftItem={id:number;text:string;depth:number;checked?:boolean;metadata?:string};
export type ListDialogInitial={title:string;style:ListBuilderStyle;items:Array<Omit<DraftItem,'id'>>};
const styles:{id:ListBuilderStyle;label:string;markers:string[]}[]=[
 {id:'bullets',label:'Bullets',markers:['•','•','•']},
 {id:'numbered',label:'Numbered',markers:['1','2','3']},
 {id:'checkboxes',label:'Checkboxes',markers:['□','□','□']},
 {id:'dash',label:'Dash',markers:['–','–','–']},
 {id:'lettered',label:'Lettered',markers:['A','B','C']},
];
function roman(value:number){const pairs:[number,string][]=[[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];let result='';for(const[number,glyph]of pairs)while(value>=number){result+=glyph;value-=number;}return result;}
export function marker(style:ListBuilderStyle,index:number,depth=0){
 if(style==='numbered')return `${index+1}.`;
 if(style==='checkboxes')return '- [ ]';
 if(style==='dash')return '-';
 if(style==='bullets')return '*';
 const mode=depth%4;if(mode===0)return `${String.fromCharCode(65+(index%26))}.`;if(mode===1)return `${String.fromCharCode(97+(index%26))}.`;if(mode===2)return `${roman(index+1)}.`;return `${index+1}.`;
}
function siblingIndex(items:DraftItem[],index:number){const depth=items[index].depth;let count=0;for(let i=index-1;i>=0;i--){if(items[i].depth<depth)break;if(items[i].depth===depth)count++;}return count;}
export function serializeList(title:string,style:ListBuilderStyle,items:string[]){return serializeDraft(title,style,items.map((text,id)=>({id,text,depth:0})));}
function serializeDraft(title:string,style:ListBuilderStyle,items:DraftItem[]){
 const siblingCounts:number[]=[];
 const rows=items.filter(item=>item.text.trim()).map(item=>{siblingCounts.length=item.depth+1;siblingCounts[item.depth]=(siblingCounts[item.depth]??0)+1;return `${'  '.repeat(item.depth)}${marker(style,siblingCounts[item.depth]-1,item.depth)} ${item.text.trim()}`;});
 return `${title.trim()?`## ${title.trim()}\n\n`:''}${rows.join('\n')}`;
}
function subtreeEnd(items:DraftItem[],index:number){const depth=items[index].depth;let end=index+1;while(end<items.length&&items[end].depth>depth)end++;return end;}
export function ListDialog({initialItems,initial,onCancel,onInsert,inline,onDraft,extra,busy,error}:{initialItems:string[];initial?:ListDialogInitial;onCancel:()=>void;onInsert?:(markdown:string)=>void;inline?:boolean;onDraft?:(title:string,style:ListBuilderStyle,items:DraftItem[])=>void;extra?:React.ReactNode;busy?:boolean;error?:string}){
 const nextId=useRef(1);
 const[title,setTitle]=useState(initial?.title??''),[style,setStyle]=useState<ListBuilderStyle>(initial?.style??'bullets');
 const[items,setItems]=useState<DraftItem[]>(()=>initial?.items.length?initial.items.map(item=>({id:nextId.current++,...item})):initialItems.length?initialItems.map(text=>({id:nextId.current++,text,depth:0})):[{id:nextId.current++,text:'Item 1',depth:0}]);
 const[dragging,setDragging]=useState<number|null>(null),draggingRef=useRef<number|null>(null);
 const dialog=useRef<HTMLElement>(null);useEffect(()=>{dialog.current?.focus();},[]);
 const setDrag=(index:number|null)=>{draggingRef.current=index;setDragging(index);};
 const update=(id:number,text:string)=>setItems(current=>current.map(item=>item.id===id?{...item,text}:item));
 const moveGroup=(from:number,to:number)=>{
  const current=items;if(from<0||from>=current.length||to<0||to>current.length)return;
  const end=subtreeEnd(current,from);if(to>=from&&to<=end)return;
  const block=current.slice(from,end),rest=[...current.slice(0,from),...current.slice(end)];
  const insertion=Math.max(0,Math.min(rest.length,to>end?to-block.length:to));rest.splice(insertion,0,...block);setItems(rest);setDrag(insertion);
 };
 const dragOverPoint=(event:React.PointerEvent<HTMLButtonElement>)=>{const from=draggingRef.current;if(from===null)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-list-index]');if(!target)return;const to=Number(target.dataset.listIndex);if(Number.isInteger(to)&&to!==from)moveGroup(from,to);};
 const addSubItem=(index:number)=>setItems(current=>{const end=subtreeEnd(current,index),next=[...current];next.splice(end,0,{id:nextId.current++,text:`Item ${current.length+1}`,depth:current[index].depth+1});return next;});
 const removeGroup=(index:number)=>setItems(current=>{const end=subtreeEnd(current,index);return current.length-(end-index)>0?[...current.slice(0,index),...current.slice(end)]:current;});
 const form=<section ref={dialog} tabIndex={-1} className={inline?"list-editor-inline":"list-dialog"} role={inline?undefined:"dialog"} aria-modal={inline?undefined:true} aria-labelledby={inline?"customize-list-title":"insert-list-title"} onKeyDown={event=>{if(event.key==='Escape')onCancel();}}>
  <header className="list-dialog-header"><div><ListIcon aria-hidden="true"/><h2 id={inline?"customize-list-title":"insert-list-title"}>{initial?'Edit List':'Insert List'}</h2></div><button type="button" aria-label={initial?'Close edit list':'Close insert list'} onClick={onCancel}><X/></button></header>
  <div className="list-dialog-body"><label className="list-title-field">Title<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Enter list title (optional)"/></label>
   <fieldset className="list-style-field"><legend>List style</legend><div className="list-style-grid">{styles.map(option=><button type="button" key={option.id} className={style===option.id?'selected':''} aria-pressed={style===option.id} onClick={()=>setStyle(option.id)}><span className="list-style-preview" aria-hidden="true">{option.markers.map((value,index)=><span key={index}><b>{value}</b><i/></span>)}</span><span>{option.label}</span></button>)}</div></fieldset>
   {extra}
   <div className="list-items-heading"><span>Items</span><span>{items.length} {items.length===1?'item':'items'}</span></div>
   <div className="list-item-stack">{items.map((item,index)=><div className={dragging===index?'list-item-row dragging':'list-item-row'} data-list-index={index} key={item.id} style={{marginLeft:`${Math.min(item.depth*24,72)}px`}}><button type="button" className="list-drag-handle" aria-label={`Move item ${index+1} and its sub-items`} disabled={items.length<2} onPointerDown={event=>{if(items.length<2)return;event.currentTarget.setPointerCapture(event.pointerId);setDrag(index);}} onPointerMove={dragOverPoint} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setDrag(null);}} onPointerCancel={()=>setDrag(null)} onKeyDown={event=>{if(event.key==='ArrowUp'){event.preventDefault();moveGroup(index,index-1);}else if(event.key==='ArrowDown'){event.preventDefault();moveGroup(index,subtreeEnd(items,index)+1);}}}><GripVertical aria-hidden="true"/></button><span className="list-row-marker" aria-hidden="true">{marker(style,siblingIndex(items,index),item.depth)}</span><input aria-label={`List item ${index+1}`} value={item.text} onChange={event=>update(item.id,event.target.value)}/><button type="button" className="list-add-subitem" aria-label={`Add sub-item beneath item ${index+1}`} title="Add sub-item" onClick={()=>addSubItem(index)}><Plus aria-hidden="true"/></button><button type="button" aria-label={`Delete item ${index+1} and its sub-items`} disabled={items.length===1} onClick={()=>removeGroup(index)}><Trash2/></button></div>)}</div>
   <button type="button" className="list-add-item" onClick={()=>setItems(current=>[...current,{id:nextId.current++,text:`Item ${current.length+1}`,depth:0}])}><Plus/>Add item</button>
  </div>
  {error&&<p role="alert">{error}</p>}<footer className="list-dialog-footer"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary" disabled={busy||!items.some(item=>item.text.trim())} onClick={()=>onDraft?onDraft(title,style,items):onInsert?.(serializeDraft(title,style,items))}>{initial?'Update list':'Insert'}</button></footer>
 </section>;
 return inline?form:<div className="list-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel();}}>{form}</div>;
}
