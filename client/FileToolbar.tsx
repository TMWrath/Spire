import React from 'react';
import './file-toolbar.css';
import {Save,Undo2,Redo2,Trash2} from 'lucide-react';
export function FileToolbar({path,onPathChange,onSave,onUndo,onRedo,onDelete,canUndo=true,canRedo=true,disabled=false,deleteLabel='Delete file',children}:{path:string;onPathChange?:(path:string)=>void;onSave:()=>void;onUndo:()=>void;onRedo:()=>void;onDelete:()=>void;canUndo?:boolean;canRedo?:boolean;disabled?:boolean;deleteLabel?:string;children?:React.ReactNode}){
 return <div className="note-toolbar" role="toolbar" aria-label="File actions"><input aria-label="File path" value={path} readOnly={!onPathChange} onChange={e=>onPathChange?.(e.target.value)}/><button aria-label="Save file" title="Save" disabled={disabled} onClick={onSave}><Save/></button><button aria-label="Undo" title="Undo" disabled={disabled||!canUndo} onMouseDown={e=>e.preventDefault()} onClick={onUndo}><Undo2/></button><button aria-label="Redo" title="Redo" disabled={disabled||!canRedo} onMouseDown={e=>e.preventDefault()} onClick={onRedo}><Redo2/></button>{children}<button aria-label={deleteLabel} title={deleteLabel} disabled={disabled} onClick={onDelete}><Trash2/></button></div>;
}
