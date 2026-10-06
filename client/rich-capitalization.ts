import type {Editor} from '@tiptap/react';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {caseMap,wordRange} from './capitalization';
export function capitalizeCell(editor:Editor,style:string){
 let {from,to}=editor.state.selection;const {doc}=editor.state;
 if(from===to){const position=doc.resolve(from);if(!position.parent.isTextblock)return;const text=position.parent.textBetween(0,position.parent.content.size,'\n','\ufffc');const range=wordRange(text,position.parentOffset);from=position.start()+range.start;to=position.start()+range.end;}
 if(from===to)return;
 const text=doc.textBetween(from,to,'\n','\ufffc'),mapped=caseMap(text,style);
 const pieces:{start:number;end:number;text:string;marks:readonly import('@tiptap/pm/model').Mark[]}[]=[];
 doc.nodesBetween(from,to,(node,pos)=>{if(!node.isText)return;const start=Math.max(pos,from),end=Math.min(pos+node.nodeSize,to);const offset=doc.textBetween(from,start,'\n','\ufffc').length;pieces.push({start,end,text:mapped.text.slice(mapped.boundaries[offset],mapped.boundaries[offset+end-start]),marks:node.marks});});
 const tr=closeHistory(editor.state.tr);
 for(const piece of pieces.reverse())if(piece.text!==doc.textBetween(piece.start,piece.end))tr.replaceWith(piece.start,piece.end,editor.schema.text(piece.text,piece.marks));
 if(!tr.docChanged)return;
 tr.setSelection(TextSelection.create(tr.doc,tr.mapping.map(from,-1),tr.mapping.map(to,1)));
 editor.view.dispatch(tr);editor.commands.focus();
}
