import React,{useEffect,useRef} from 'react';
import {useEditor,EditorContent,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import Underline from '@tiptap/extension-underline';
// Use ordinary HTML, not Tiptap's nonstandard ++underline++ dialect.
const PortableUnderline=Underline.extend({
 renderMarkdown:(node,helpers)=>`<u>${helpers.renderChildren(node)}</u>`,
 markdownTokenizer:{name:'underline',level:'inline',start:src=>src.indexOf('<u>'),tokenize:(src,_tokens,lexer)=>{const match=/^<u>([\s\S]+?)<\/u>/.exec(src);if(!match)return;return {type:'underline',raw:match[0],tokens:lexer.inlineTokens(match[1])};}},
});
import {TaskList,TaskItem} from '@tiptap/extension-list';
import type {TableAlignment} from '../shared/managed-table';

/** Markdown is the storage boundary; the ProseMirror document is dialog-local only. */
export function RichTableCell({source,label,alignment,onChange,onActive,autoFocus=false}:{source:string;label:string;alignment:TableAlignment;onChange:(source:string)=>void;onActive:(editor:Editor)=>void;autoFocus?:boolean}){
 const callbacks=useRef({onChange,onActive});callbacks.current={onChange,onActive};
 const editor=useEditor({
  extensions:[PortableUnderline,StarterKit.configure({underline:false,link:{openOnClick:false},orderedList:{keepMarks:true},bulletList:{keepMarks:true}}),TaskList,TaskItem.configure({nested:true}),Markdown],
  content:source,contentType:'markdown',
  editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'rich-table-cell'},
   // Paste plain text rather than importing arbitrary external HTML/styles.
   handlePaste:(view,event)=>{const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();view.dispatch(view.state.tr.insertText(text));return true;}},
  onFocus:({editor})=>callbacks.current.onActive(editor),
  onUpdate:({editor})=>callbacks.current.onChange(editor.getMarkdown()),
 });
 useEffect(()=>{if(editor&&autoFocus)editor.commands.focus('start');},[editor,autoFocus]);
 // Never replace a live editor's document on React updates: that would destroy its selection/history.
 return <EditorContent editor={editor} style={{textAlign:alignment??'left'}}/>;
}
