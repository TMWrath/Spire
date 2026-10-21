import {QuickFormat,quickFormatLabel,resetQuickFormat} from './QuickFormat';
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
import {api,engine} from './sync';
const PortableUnderline=Underline.extend({renderMarkdown:(node,h)=>`<u>${h.renderChildren(node)}</u>`,markdownTokenizer:{name:'underline',level:'inline',start:src=>src.indexOf('<u>'),tokenize:(src,_tokens,lexer)=>{const m=/^<u>([\s\S]+?)<\/u>/.exec(src);if(m)return {type:'underline',raw:m[0],tokens:lexer.inlineTokens(m[1])};}}});

/** Unsupported dialect blocks are rendered, but their exact portable source is retained. */
const trimBlockNewlines=(source:string)=>source.replace(/\n+$/,'');
function BodyEditor({note,notes,attachments,fileCss,keyboardEnabled=true,onBlur,onChange,onReady,onSource,onDefinitionCommand,label='Document editor',onActivate}:{label?:string;onActivate?:(editor:Editor)=>void;onDefinitionCommand?:(term:string)=>void;keyboardEnabled?:boolean;onBlur?:()=>void;note:Note;notes:Note[];attachments:string[];fileCss?:string;onChange:(content:string)=>void;onReady:(editor:Editor|null)=>void;onSource:()=>void}){
 const callbacks=useRef({note,notes,attachments,onBlur,onChange,onReady,onSource,onActivate,onDefinitionCommand});callbacks.current={note,notes,attachments,onBlur,onChange,onReady,onSource,onActivate,onDefinitionCommand};
 const [quickLabel,setQuickLabel]=React.useState('');
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
  const next={type:'doc',content:content.length?content:[{type:'paragraph'}]};if(!editor.state.doc.eq(editor.schema.nodeFromJSON(next))){editor.commands.setContent(next,{emitUpdate:false});resetQuickFormat(editor);}last.current=source;loaded.current=editor;
 };
 const Preserved=Node.create({name:'preservedBlock',group:'block',atom:true,selectable:true,draggable:false,addAttributes:()=>({source:{default:'',rendered:false}}),parseHTML:()=>[],renderHTML:()=>['div',{'data-preserved-block':'true'}],renderMarkdown:node=>trimBlockNewlines(String(node.attrs?.source??'')),addNodeView:()=>({node})=>{
  const dom=document.createElement('div');dom.className='preserved-document-block';dom.contentEditable='false';
  const view=document.createElement('div');let rendered='';const refresh=()=>{const c=callbacks.current,html=DOMPurify.sanitize(renderMarkdown({...c.note,content:String(node.attrs.source)},c.notes,c.attachments));if(html!==rendered){view.innerHTML=html;rendered=html;}};refresh();mediaViews.current.add(refresh);
  dom.append(view);
  return {dom,stopEvent:()=>true,destroy:()=>{mediaViews.current.delete(refresh);}};
 }});
 const editor=useEditor({onFocus:({editor})=>callbacks.current.onActivate?.(editor),onBlur:()=>callbacks.current.onBlur?.(),onTransaction:({editor})=>setQuickLabel(quickFormatLabel(editor)),extensions:[QuickFormat,PortableHighlight,Preserved,PortableUnderline,StarterKit.configure({underline:false,link:{openOnClick:false}}),TaskList,TaskItem.configure({nested:true}),Markdown],content:'',editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'document-writing-surface'},handleKeyDown:(view,event)=>{if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return false;const {$from}=view.state.selection;if(!view.state.selection.empty||$from.parent.type.name!=='paragraph'||$from.parentOffset!==$from.parent.content.size)return false;const match=/^@def\s+(.+?)\s*$/i.exec($from.parent.textContent);if(!match)return false;event.preventDefault();const from=$from.before(),to=$from.after();view.dispatch(view.state.tr.delete(from,to));callbacks.current.onDefinitionCommand?.(match[1].trim());return true;},handlePaste:(view,event)=>{const text=event.clipboardData?.getData('text/plain');if(text===undefined)return false;event.preventDefault();view.dispatch(view.state.tr.insertText(text));return true;}},onCreate:({editor})=>{if(loaded.current!==editor)load(editor,callbacks.current.note.content);callbacks.current.onReady(editor);},onUpdate:({editor})=>{
  const used=new Map<string,number>();const blocks=(editor.getJSON().content??[]).map(node=>{if(node.type==='preservedBlock')return trimBlockNewlines(String(node.attrs?.source??''));const key=JSON.stringify(node),i=used.get(key)??0;used.set(key,i+1);return trimBlockNewlines(originals.current.get(key)?.[i]??editor.markdown!.serialize({type:'doc',content:[node]}));});
  const source=prefix.current+blocks.join('\n\n');last.current=source;callbacks.current.onChange(source);
 }});
 const [imageError,setImageError]=React.useState('');
 useEffect(()=>{
  if(!editor)return;
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.setAttribute('aria-label','Choose image');editor.view.dom.parentElement!.append(input);
  let pending:{start:number;end:number;doc:typeof editor.state.doc;id:string;content:string;path:string;alignment?:'left'|'center'|'right'}|null=null;
  const valid=(target:NonNullable<typeof pending>)=>!editor.isDestroyed&&editor.isEditable&&editor.view.dom.isConnected&&!callbacks.current.note.deleted&&callbacks.current.note.id===target.id&&callbacks.current.note.path===target.path&&callbacks.current.note.content===target.content&&editor.state.doc.eq(target.doc);
  const cancel=()=>{pending=null;input.value='';};
  const open=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!editor.isEditable||callbacks.current.note.deleted||!detail||!editor.state.doc.eq(detail.doc))return;const current=callbacks.current.note;pending={...detail,id:current.id,content:current.content,path:current.path};setImageError('');input.value='';input.click();};
  const choose=async()=>{const target=pending,file=input.files?.[0];cancel();if(!target||!file||!valid(target))return;
   try{if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');const path=`Attachments/${crypto.randomUUID()}-${file.name.replace(/[\\/]/g,'_')}`;
    await api('/attachments?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file},engine.cache.identity!.csrf);await engine.sync();
    if(!valid(target))throw new Error('The file changed during upload. The image is saved in Attachments but was not inserted.');
    const src=('../'.repeat(target.path.split('/').length-1)+path).split('/').map(part=>encodeURIComponent(part).replace(/\(/g,'%28').replace(/\)/g,'%29')).join('/');
    const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const alt=file.name.replace(/[\[\]\\\r\n]/g,'');const markup=target.alignment?`<div align="${target.alignment}"><img src="${escape(src)}" alt="${escape(alt)}"></div>`:`![${alt}](${src})`;
    editor.commands.insertContentAt({from:target.start,to:target.end},{type:'preservedBlock',attrs:{source:markup}});
   }catch(error){if(!editor.isDestroyed)setImageError((error as Error).message);}
  };
  input.addEventListener('cancel',cancel);input.addEventListener('change',choose);editor.view.dom.addEventListener('spire:quick-image',open);
  return()=>{cancel();input.removeEventListener('cancel',cancel);input.removeEventListener('change',choose);editor.view.dom.removeEventListener('spire:quick-image',open);input.remove();};
 },[editor]);
 useEffect(()=>{if(editor&&(loaded.current!==editor||note.content!==last.current))load(editor,note.content);},[editor,note.content]);
 useEffect(()=>{mediaViews.current.forEach(refresh=>refresh());},[attachments,note.path]);
 useEffect(()=>{editor?.setEditable(!note.deleted,false);},[editor,note.deleted]);
 useEffect(()=>{if(editor)editor.view.dom.setAttribute("inputmode",keyboardEnabled?"text":"none");},[editor,keyboardEnabled]);
 useEffect(()=>()=>callbacks.current.onReady(null),[]);
 let scoped='';try{if(fileCss)scoped=scopeFileCss(fileCss,note.id);}catch{}
 return <>{imageError&&<p role="alert">{imageError}</p>}{scoped&&<style>{scoped}</style>}{quickLabel&&<small role="status" className="quick-format-status">{quickLabel} active · Enter to stop</small>}<EditorContent editor={editor} className="preview document-editor" data-style-scope={note.id}/></>;
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
