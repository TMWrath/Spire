import './document-editor.css';
import {tableOfContents} from './table-of-contents';
import {hasPage,readPage,writePage} from './page-layout';
import {PortableHighlight} from './PortableHighlight';
import {readBookmark} from './bookmark';
import React,{useEffect,useRef} from 'react';
import {useEditor,EditorContent,type Editor} from '@tiptap/react';
import {Node,type JSONContent} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import Underline from '@tiptap/extension-underline';
import {TaskList,TaskItem} from '@tiptap/extension-list';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {renderMarkdown} from './markdown';
import {touchEditing} from './editor-focus';
import {capitalizeCell} from './rich-capitalization';
import type {FormatKind} from './FormattingToolbar';
import type {Note} from '../shared/model';
import {scopeFileCss} from './style-css';
const PortableUnderline=Underline.extend({renderMarkdown:(node,h)=>`<u>${h.renderChildren(node)}</u>`,markdownTokenizer:{name:'underline',level:'inline',start:src=>src.indexOf('<u>'),tokenize:(src,_tokens,lexer)=>{const m=/^<u>([\s\S]+?)<\/u>/.exec(src);if(m)return {type:'underline',raw:m[0],tokens:lexer.inlineTokens(m[1])};}}});

/** Unsupported dialect blocks are rendered, but their exact portable source is retained. */
function BodyEditor({note,notes,attachments,fileCss,keyboardEnabled=true,onBlur,onChange,onReady,onSource,label='Document editor',onActivate}:{label?:string;onActivate?:(editor:Editor)=>void;keyboardEnabled?:boolean;onBlur?:()=>void;note:Note;notes:Note[];attachments:string[];fileCss?:string;onChange:(content:string)=>void;onReady:(editor:Editor|null)=>void;onSource:()=>void}){
 const callbacks=useRef({note,notes,attachments,onBlur,onChange,onReady,onSource,onActivate});callbacks.current={note,notes,attachments,onBlur,onChange,onReady,onSource,onActivate};
 const mediaViews=useRef(new Set<()=>void>());
 const prefix=useRef(''),last=useRef(note.content),originals=useRef(new Map<string,string[]>()),loaded=useRef<Editor|null>(null);
 const load=(editor:Editor,source:string)=>{
  const match=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source);prefix.current=match?.[0]??'';
  const body=source.slice(prefix.current.length),tokens=marked.lexer(body),content:JSONContent[]=[];originals.current=new Map();
  const definitions=/^\s*\[[^\]]+\]:/m.test(body);
  for(const token of tokens){if(token.type==='space')continue;
   const raw=token.raw;
   const highlightSafe=raw.replace(/==([^\n]+?)==/g,'$1').replace(/<mark(?:\s+style="background-color:\s*#[\da-f]{6};\s*color:\s*#[\da-f]{6};?")?>([^\n]*?)<\/mark>/gi,'$1');
   const protectedBlock=!['heading','paragraph','text','list','blockquote','hr','code'].includes(token.type)||/!?\[\[|\[\^|\[!|==|\$|!\[|\^[\w-]+(?:\n|$)|<(?!\/?u>)[A-Za-z!/]|&(?:\w+|#\d+);/.test(highlightSafe)||(definitions&&raw.includes('['))||token.type==='code'&&'lang' in token&&token.lang==='mermaid';
   if(protectedBlock){content.push({type:'preservedBlock',attrs:{source:raw}});continue;}
   const parsed=editor.markdown!.parse(raw).content??[];
   if(!parsed.length){content.push({type:'preservedBlock',attrs:{source:raw}});continue;}
   if(parsed.length===1){const key=JSON.stringify(parsed[0]);originals.current.set(key,[...(originals.current.get(key)??[]),raw]);}
   content.push(...parsed);
  }
  editor.commands.setContent({type:'doc',content:content.length?content:[{type:'paragraph'}]},{emitUpdate:false});last.current=source;loaded.current=editor;
 };
 const Preserved=Node.create({name:'preservedBlock',group:'block',atom:true,selectable:true,draggable:false,addAttributes:()=>({source:{default:'',rendered:false}}),parseHTML:()=>[],renderHTML:()=>['div',{'data-preserved-block':'true'}],renderMarkdown:node=>String(node.attrs?.source??'').trimEnd(),addNodeView:()=>({node})=>{
  const dom=document.createElement('div');dom.className='preserved-document-block';dom.contentEditable='false';
  const view=document.createElement('div');let rendered='';const refresh=()=>{const c=callbacks.current,html=DOMPurify.sanitize(renderMarkdown({...c.note,content:String(node.attrs.source)},c.notes,c.attachments));if(html!==rendered){view.innerHTML=html;rendered=html;}};refresh();mediaViews.current.add(refresh);
  dom.append(view);
  return {dom,stopEvent:()=>true,destroy:()=>{mediaViews.current.delete(refresh);}};
 }});
 const editor=useEditor({onFocus:({editor})=>callbacks.current.onActivate?.(editor),onBlur:()=>callbacks.current.onBlur?.(),extensions:[PortableHighlight,Preserved,PortableUnderline,StarterKit.configure({underline:false,link:{openOnClick:false}}),TaskList,TaskItem.configure({nested:true}),Markdown],content:'',editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'document-writing-surface'},handlePaste:(view,event)=>{const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();view.dispatch(view.state.tr.insertText(text));return true;}},onCreate:({editor})=>{if(loaded.current!==editor)load(editor,callbacks.current.note.content);callbacks.current.onReady(editor);},onUpdate:({editor})=>{
  const used=new Map<string,number>();const blocks=(editor.getJSON().content??[]).map(node=>{if(node.type==='preservedBlock')return String(node.attrs?.source??'').trimEnd();const key=JSON.stringify(node),i=used.get(key)??0;used.set(key,i+1);return (originals.current.get(key)?.[i]??editor.markdown!.serialize({type:'doc',content:[node]})).trimEnd();});
  const source=prefix.current+blocks.join('\n\n');last.current=source;callbacks.current.onChange(source);
 }});
 useEffect(()=>{if(editor&&(loaded.current!==editor||note.content!==last.current))load(editor,note.content);},[editor,note.content]);
 useEffect(()=>{mediaViews.current.forEach(refresh=>refresh());},[attachments,note.path]);
 useEffect(()=>{editor?.setEditable(!note.deleted,false);},[editor,note.deleted]);
 useEffect(()=>{if(editor)editor.view.dom.setAttribute("inputmode",keyboardEnabled?"text":"none");},[editor,keyboardEnabled]);
 useEffect(()=>()=>callbacks.current.onReady(null),[]);
 let scoped='';try{if(fileCss)scoped=scopeFileCss(fileCss,note.id);}catch{}
 return <>{scoped&&<style>{scoped}</style>}<EditorContent editor={editor} className="preview document-editor" data-style-scope={note.id}/></>;
}
export function DocumentEditor(props:Parameters<typeof BodyEditor>[0]){
 const bodyRef=useRef<Editor|null>(null),active=useRef<'body'|'header'|'footer'>('body');
 const [expanded,setExpanded]=React.useState<Record<string,boolean>>({});
 const [sectionsHidden,setSectionsHidden]=React.useState(false);
 useEffect(()=>{const bookmark=readBookmark(props.note.content);setExpanded(bookmark?.mode==='editor'&&bookmark.region!=='body'?{[bookmark.region]:true}:{});setSectionsHidden(false);},[props.note.id]);
 const bodyReady=(editor:Editor|null)=>{bodyRef.current=editor;active.current='body';props.onReady(editor);};
 if(!hasPage(props.note.content))return <BodyEditor {...props}/>;
 let layout;try{layout=readPage(props.note.content);}catch(e){return <><p role="alert">{String((e as Error).message)}</p><BodyEditor {...props}/></>;}
 const update=(part:'header'|'footer'|'footnotes',text:string)=>props.onChange(writePage(props.note.content,{...layout,[part]:{enabled:layout[part]?.enabled??false,text}}));
 const title=(part:string)=>part==='toc'?'Table of contents':part==='header'?'Header':part==='footer'?'Footer':'Footnotes';
 const section=(part:'header'|'footer')=>layout[part].enabled&&!!expanded[part]&&<section className="page-section" data-page-section={part} aria-label={part==='header'?'Page header':'Page footer'}><div className="page-region-label">{title(part)}</div><BodyEditor {...props} label={part==='header'?'Header editor':'Footer editor'} note={{...props.note,content:layout[part].text}} onReady={editor=>{if(editor&&readBookmark(props.note.content)?.region===part){active.current=part;props.onReady(editor);}if(!editor&&active.current===part){active.current='body';props.onReady(bodyRef.current);}}} onActivate={editor=>{active.current=part;props.onReady(editor);}} onChange={text=>update(part,text)}/></section>;
 return <div className="page-document">{layout.toc?.enabled&&expanded.toc&&<nav className="page-section contents-section" aria-label="Table of contents"><div className="page-region-label">Table of contents</div>{tableOfContents(layout.body).length?tableOfContents(layout.body).map((entry,index)=><button key={entry.id} style={{marginInlineStart:`${(entry.level-1)*1.25}rem`}} onClick={()=>{const heading=bodyRef.current?.view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6')[index];heading?.scrollIntoView({behavior:'smooth',block:'center'});}}>{entry.text}</button>):<p className="muted">Add headings to generate a table of contents.</p>}</nav>}{section('header')}<section className="page-body" data-page-section="body"><BodyEditor {...props} onReady={bodyReady} onActivate={editor=>{active.current='body';props.onReady(editor);}} note={{...props.note,content:layout.body}} onChange={body=>props.onChange(writePage(props.note.content,{...layout,body}))}/></section>{section('footer')}{layout.footnotes?.enabled&&!!expanded.footnotes&&<section className="page-section footnotes-section" data-page-section="footnotes" aria-label="Page footnotes"><div className="page-region-label">Footnotes</div><p className="muted">Use [^1]: Explanation here; reference it in the body with [^1].</p><textarea aria-label="Footnotes editor" disabled={props.note.deleted} value={layout.footnotes.text} onChange={e=>update('footnotes',e.target.value)} placeholder="[^1]: Explanation or source."/></section>}{(['toc','header','footer','footnotes'] as const).some(part=>layout[part]?.enabled)&&<div className="page-section-dock" data-hidden={sectionsHidden}><button type="button" className="page-section-caret" aria-label={sectionsHidden?'Show section bar':'Hide section bar'} aria-expanded={!sectionsHidden} onClick={()=>setSectionsHidden(!sectionsHidden)}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button><div className="page-section-reveal" inert={sectionsHidden?true:undefined}><div className="page-section-clip"><div className="page-section-tabs" aria-label="Document sections">{(['toc','header','footer','footnotes'] as const).filter(part=>layout[part]?.enabled).map(part=><button key={part} aria-expanded={!!expanded[part]} aria-label={`${title(part)} section`} onClick={()=>{active.current='body';props.onReady(bodyRef.current);setExpanded({...expanded,[part]:!expanded[part]});}}>{title(part)} <span aria-hidden="true">{!!expanded[part]?'−':'+'}</span></button>)}</div></div></div></div>}</div>;
}
export function formatDocument(editor:Editor,kind:FormatKind,option:number|string=2){
 if(!editor.isEditable)return;
 if(kind==='case'){capitalizeCell(editor,String(option));return;}
 const chain=touchEditing()?editor.chain():editor.chain().focus();
 if(kind==='bold')chain.toggleBold().run();else if(kind==='italic')chain.toggleItalic().run();else if(kind==='underline')chain.toggleUnderline().run();else if(kind==='strike')chain.toggleStrike().run();else if(kind==='code')chain.toggleCode().run();else if(kind==='quote')chain.toggleBlockquote().run();else if(kind==='heading'){const level=Number(option);if(level)chain.setHeading({level:level as 1|2|3|4|5|6}).run();else chain.setParagraph().run();}else if(kind==='list'){const style=String(option);if(style==='task')chain.toggleTaskList().run();else if(['number-dot','number-paren','lower-alpha','upper-alpha'].includes(style))chain.toggleOrderedList().run();else chain.toggleBulletList().run();}
}
