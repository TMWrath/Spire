import React,{useRef,useState} from 'react';
import type {Editor} from '@tiptap/react';
import {DocumentEditor,formatDocument} from './DocumentEditor';
import {FormattingToolbar,type FormatKind} from './FormattingToolbar';
import {formatText} from './formatting';
import {focusForTyping,releaseTouchActionFocus} from './editor-focus';
import {applyHighlight} from './highlight';
import type {HighlightTarget} from './HighlightChooser';
import {BlockDialog} from './BlocksChooser';
import {insertBlock,type BlockKind} from './blocks';
import {TableEditor} from './TableEditor';
import {findManagedTableAt,placeManagedTable,type ManagedTable,type TableAlignment} from '../shared/managed-table';
import {formatTemporal,type TemporalFormat} from './temporal';
import {VideoCapture,saveVideoCapture,type Capture} from './VideoCapture';
import {AudioRecorder} from './AudioRecorder';
import {engine,api} from './sync';
import {pageBreak,readPage} from './page-layout';
import {FileText,LayoutTemplate,Link2,Tag,Paperclip} from 'lucide-react';
import type {Note} from '../shared/model';
export type EditableTemplate={id:string;title:string;category:'section'|'full';content:string;sourcePath?:string};
type Range={start:number;end:number;content:string};
type Props={template:EditableTemplate;notes:Note[];onSave:(content:string,title:string,id:string,expectedContent:string)=>Promise<string>;onClose:()=>void;onInsert:(content:string,id:string)=>void;canInsert:boolean;renderTemplates?:(note:Note,onClose:()=>void,onPick:(content:string)=>void)=>React.ReactNode};
export function TemplateEditor({template,notes,onSave,onClose,onInsert,canInsert,renderTemplates}:Props){
 const [content,setContent]=useState(template.content),[title,setTitle]=useState(template.title),[mode,setMode]=useState('editor'),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const rich=useRef<Editor|null>(null),source=useRef<HTMLTextAreaElement|null>(null),current=useRef(content);current.current=content;
 const savedId=useRef(template.id),baseline=useRef(template.content),baselineTitle=useRef(template.title);
 const [block,setBlock]=useState<{kind:BlockKind;range:Range}|null>(null),[table,setTable]=useState<{range:Range;table:ManagedTable|null;cells:string[][]}|null>(null);
 const [temporal,setTemporal]=useState<{kind:'date'|'time';format:TemporalFormat;range:Range;manual:boolean;value:string}|null>(null);
 const [videoCapture,setVideoCapture]=useState<{range:Range;editor:Editor|null}|null>(null);
 const beginVideoCapture=()=>{const e=mode==='editor'?rich.current:null;setVideoCapture({range:e?{start:e.state.selection.from,end:e.state.selection.to,content:current.current}:capture(),editor:e});};
 const completeVideoCapture=async(c:Capture)=>{const captured=videoCapture;if(!captured||current.current!==captured.range.content||captured.editor?.isDestroyed)throw new Error('The template changed. Cancel and try again.');const markup=await saveVideoCapture(c,note.path);if(current.current!==captured.range.content||captured.editor?.isDestroyed)throw new Error('The template changed during upload. Capture saved in Attachments.');if(captured.editor)captured.editor.commands.insertContentAt({from:captured.range.start,to:captured.range.end},{type:'preservedBlock',attrs:{source:markup.trim()}});else if(!replace(captured.range,markup))throw new Error('The template changed.');setVideoCapture(null);};
 const [recording,setRecording]=useState<Range|null>(null),[picker,setPicker]=useState<Range|null>(null),[pageMenu,setPageMenu]=useState(false);
 const [insertTool,setInsertTool]=useState<{kind:'tag'|'link';range:Range}|null>(null),[target,setTarget]=useState(''),[label,setLabel]=useState('');
 const dirty=content!==baseline.current||title!==baselineTitle.current;
 const edit=(value:string)=>{current.current=value;setContent(value);setSaved(false);};
 const close=()=>{if(!dirty||confirm('Discard unsaved template changes?'))onClose();};
 const note:Note={id:template.id,path:template.sourcePath??'Templates/Template.md',content,rev:1,deleted:false,time:new Date(0).toISOString(),history:[]};
 // Match the active page region before translating a rich selection into portable source.
 // Ambiguous/unsupported source remains intact; source-only insertions use the region end.
 const capture=():Range=>{
  const value=current.current,field=source.current,e=rich.current;
  if(mode==='source'&&field)return {start:field.selectionStart,end:field.selectionEnd,content:value};
  const section=e?.view.dom.closest('[data-page-section]')?.getAttribute('data-page-section')??'body';
  const layout=readPage(value);let start=value.length-layout.body.length,end=value.length;
  const front=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(value);start=front?.[0].length??0;
  if(section!=='body'){
   const opener=`<!-- spire:${section} -->\n`,closer=`\n<!-- /spire:${section} -->`,at=value.indexOf(opener,start);
   if(at>=0){start=at+opener.length;const stop=value.indexOf(closer,start);if(stop>=0)end=stop;}
  }else{
   const h=value.indexOf('<!-- /spire:header -->',start);if(h>=0)start=h+'<!-- /spire:header -->'.length+2;
   const f=value.indexOf('<!-- spire:footer -->',start);if(f>=0)end=Math.max(start,f-2);
   const foot=value.indexOf('<!-- spire:footnotes -->',start);if(foot>=0)end=Math.min(end,foot);
  }
  const text=e&&!e.isDestroyed?e.state.doc.textBetween(e.state.selection.from,e.state.selection.to,'\n'):'';
  const body=value.slice(start,end),at=text?body.indexOf(text):-1;
  if(at>=0&&body.indexOf(text,at+1)<0)return {start:start+at,end:start+at+text.length,content:value};
  return {start:end,end,content:value};
 };
 const replace=(range:Range,value:string)=>{
  if(current.current!==range.content){setError('The template changed while this tool was open. Cancel and try again.');return false;}
  edit(range.content.slice(0,range.start)+value+range.content.slice(range.end));setMode('source');
  requestAnimationFrame(()=>{source.current?.setSelectionRange(range.start+value.length,range.start+value.length);focusForTyping(source.current);});return true;
 };
 const formatMarkdown=(kind:FormatKind,option:number|string=2)=>{
  if(mode==='editor'&&rich.current&&!rich.current.isDestroyed){formatDocument(rich.current,kind,option);return;}
  const r=capture(),result=formatText(r.content,r.start,r.end,kind,option);edit(result.content);
  requestAnimationFrame(()=>{source.current?.setSelectionRange(result.start,result.end);focusForTyping(source.current);});
 };
 const prepareHighlight=():HighlightTarget|null=>{
  const e=mode==='editor'?rich.current:null;
  if(e&&!e.isDestroyed){const {from,to}=e.state.selection;return {text:e.state.doc.textBetween(from,to,'\n'),apply:choice=>{if(e.isDestroyed||from===to)return;const chain=e.chain().setTextSelection({from,to});if(choice==='remove')chain.unsetMark('portableHighlight').run();else chain.setMark('portableHighlight',{color:choice==='default'?null:choice}).run();}};}
  const r=capture();return {text:r.content.slice(r.start,r.end),apply:choice=>{if(current.current!==r.content)return;const result=applyHighlight(r.content,r.start,r.end,choice);edit(result.content);requestAnimationFrame(()=>source.current?.setSelectionRange(result.start,result.end));}};
 };
 const openTable=()=>{const range=capture(),existing=findManagedTableAt(range.content,range.start);setTable({range,table:existing,cells:existing?.cells??[['','',''],['','',''],['','','']]});};
 const saveTable=(cells:string[][],alignments:TableAlignment[])=>{
  if(!table||current.current!==table.range.content){setError('The template changed while the table was open.');return;}
  const result=placeManagedTable(table.range.content,table.range.start,cells,table.table??undefined,undefined,alignments);edit(result.content);setMode('source');setTable(null);requestAnimationFrame(()=>source.current?.setSelectionRange(result.start,result.end));
 };
 const temporalValue=(kind:'date'|'time')=>{const now=new Date();return kind==='date'?`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;};
 const insertTemporal=(value:string)=>{if(temporal){const text=formatTemporal(value,temporal.format);if(text&&replace(temporal.range,text))setTemporal(null);}};
 const upload=async(file:Blob,name:string,range:Range)=>{
  if(current.current!==range.content)throw new Error('The template changed before upload. Try again.');
  const path='Attachments/'+name;await api('/attachments?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file},engine.cache.identity!.csrf);
  await engine.sync();return '../'.repeat(note.path.split('/').length-1)+path;
 };
 const insertAttachment=async(file:File,range:Range)=>{try{setError('');const relative=await upload(file,file.name,range);replace(range,`\n${file.type.startsWith('image/')?'!':''}[${file.name.replace(/[\[\]\n\r]/g,'')}](${encodeURI(relative)})\n`);}catch(e){setError((e as Error).message);}};
 const insertLinkOrTag=()=>{
  if(!insertTool)return;const value=target.trim();
  if(insertTool.kind==='tag'){
   const tag=value.replace(/^#/,'');if(!/^[\p{L}\p{N}_/-]+$/u.test(tag)){setError('Use letters, numbers, underscores, hyphens or / in tags.');return;}
   const r=insertTool.range;if(replace(r,`${r.start>0&&!/\s/.test(r.content[r.start-1])?' ':''}#${tag}${r.end<r.content.length&&!/\s/.test(r.content[r.end])?' ':''}`))setInsertTool(null);
  }else{
   if(!value||/[\[\]|\n\r]/.test(value)||/^[a-z][a-z\d+.-]*:/i.test(value)&&!/^https?:\/\/|^mailto:/i.test(value)){setError('Enter a file path or an http(s)/mailto URL.');return;}
   const caption=(label.trim()||value).replace(/[\[\]\n\r]/g,'');if(replace(insertTool.range,/^https?:\/\/|^mailto:/i.test(value)?`[${caption}](${encodeURI(value).replace(/\(/g,'%28').replace(/\)/g,'%29')})`:`[[${value}${caption===value?'':'|'+caption}]]`))setInsertTool(null);
  }
 };
 const beginInsert=(kind:'tag'|'link')=>{const range=capture();setTarget('');setLabel(range.content.slice(range.start,range.end));setInsertTool({kind,range});};
 const uploadRange=useRef<Range|null>(null);
 return <section className="template-main-editor" aria-label="Template editor" onPointerDownCapture={releaseTouchActionFocus}>
  <div className="note-toolbar"><input aria-label="Template title" value={title} onChange={e=>{setTitle(e.target.value);setSaved(false);}}/><button disabled={saving||!title.trim()} onClick={async()=>{setSaving(true);setError('');try{savedId.current=await onSave(content,title.trim(),savedId.current,baseline.current);baseline.current=content;baselineTitle.current=title;setSaved(true);}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>{saving?'Saving…':'Save template'}</button><button onClick={close}>Close template</button></div>
  <p className="muted">Editing {template.category==='full'?'full':'section'} template · {savedId.current.startsWith('saved-')?'Save updates this template.':'Save creates an editable copy of this built-in template.'}</p>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Template saved</p>}
  <div className="editor-tabs"><button aria-pressed={mode==='editor'} onClick={()=>setMode('editor')}>Editor</button><button aria-pressed={mode==='source'} onClick={()=>setMode('source')}>Source</button><button disabled={!canInsert} onClick={()=>onInsert(content,savedId.current)}>Insert template</button></div>
  <FormattingToolbar editor={source} disabled={saving} formatMarkdown={formatMarkdown} prepareHighlight={prepareHighlight}
   formatHtml={alignment=>{const r=capture();replace(r,`<div align="${alignment}">\n\n${r.content.slice(r.start,r.end)||'Text'}\n\n</div>`);}}
   onTable={openTable} onSpacer={()=>{const r=capture();replace(r,'\n\n&nbsp;\n\n');}}
   onTemporal={(kind,format)=>setTemporal({kind,format,range:capture(),manual:false,value:temporalValue(kind)})}
   onBlock={kind=>setBlock({kind,range:capture()})} onMedia={markup=>replace(capture(),markup)} onVideoCapture={beginVideoCapture} onRecordAudio={()=>setRecording(capture())}
   getCaseText={()=>{const e=rich.current;return e&&!e.isDestroyed?e.state.doc.textBetween(e.state.selection.from,e.state.selection.to,'\n'):'';}}
   mediaUpload={<label className="upload" onMouseDown={()=>{uploadRange.current=capture();}}><Paperclip/><span>Upload file</span><input aria-label="Upload attachment" type="file" onClick={()=>{uploadRange.current=capture();}} onChange={e=>{const file=e.target.files?.[0];if(file)void insertAttachment(file,uploadRange.current??capture());e.target.value='';}}/></label>}>
   <div className="toolbar-section toolbar-section-inserts" role="group" aria-label="Insert tools"><div className="toolbar-section-controls">
    <button type="button" aria-label="Page" aria-expanded={pageMenu} onMouseDown={e=>e.preventDefault()} onClick={()=>setPageMenu(!pageMenu)}><FileText aria-hidden="true"/>Page ▾</button>
    {renderTemplates&&<button type="button" aria-label="Templates" onMouseDown={e=>e.preventDefault()} onClick={()=>setPicker(capture())}><LayoutTemplate aria-hidden="true"/>Templates</button>}
    <button type="button" aria-label="Add link" onMouseDown={e=>e.preventDefault()} onClick={()=>beginInsert('link')}><Link2 aria-hidden="true"/>Links</button>
    <button type="button" aria-label="Add tag" onMouseDown={e=>e.preventDefault()} onClick={()=>beginInsert('tag')}><Tag aria-hidden="true"/>Tags</button>
   </div></div>
  </FormattingToolbar>
  {pageMenu&&<section className="page-menu" role="group" aria-label="Page options"><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{replace(capture(),'\n\n'+pageBreak+'\n\n');setPageMenu(false);}}>Page break</button><button type="button" onClick={()=>setPageMenu(false)}>Cancel</button></section>}
  <div className={'canvas '+mode}>{mode==='editor'?<DocumentEditor note={note} notes={notes} attachments={engine.cache.snapshot.attachments.map(a=>a.path)} keyboardEnabled onBlur={()=>{}} onReady={e=>{rich.current=e;}} onChange={edit} onSource={()=>setMode('source')}/>:<textarea ref={source} aria-label="Template source" value={content} onChange={e=>edit(e.target.value)}/>}</div>
  {table&&<TableEditor initial={table.cells} initialAlignments={table.table?.alignments} editing={Boolean(table.table)} onClose={()=>setTable(null)} onSave={saveTable}/>}
  {block&&<BlockDialog kind={block.kind} onCancel={()=>setBlock(null)} onInsert={(text,language)=>{if(current.current!==block.range.content){setError('The template changed while the block dialog was open.');return;}const result=insertBlock(block.range.content,block.range.start,block.range.end,block.kind,text,language);edit(result.content);setMode('source');setBlock(null);requestAnimationFrame(()=>source.current?.setSelectionRange(result.caret,result.caret));}}/>}
  {picker&&renderTemplates?.(note,()=>setPicker(null),value=>{if(replace(picker,'\n\n'+value+'\n\n'))setPicker(null);})}
  {videoCapture&&<VideoCapture onComplete={completeVideoCapture} onCancel={()=>setVideoCapture(null)}/>}
  {recording&&<AudioRecorder onCancel={()=>setRecording(null)} onComplete={async(blob,extension)=>{const relative=await upload(blob,`recording-${crypto.randomUUID()}.${extension}`,recording);if(!replace(recording,`\n\n<audio controls src="${relative}"></audio>\n\n`))throw new Error('The template changed during recording.');setRecording(null);}}/>}
  {temporal&&<div className="template-backdrop"><section className="file-dialog temporal-dialog" role="dialog" aria-modal="true" aria-label={`Insert ${temporal.kind}`}><h2>Insert {temporal.kind}</h2>{!temporal.manual?<><p>Format: {temporal.format}. Use the current {temporal.kind}, or choose one manually.</p><div className="file-dialog-actions"><button type="button" onClick={()=>insertTemporal(temporalValue(temporal.kind))}>Current</button><button type="button" onClick={()=>setTemporal({...temporal,manual:true})}>Manual</button></div></>:<form onSubmit={e=>{e.preventDefault();insertTemporal(temporal.value);}}><label>{temporal.kind==='date'?'Date':'Time'}<input aria-label={temporal.kind==='date'?'Date':'Time'} type={temporal.kind} step={temporal.kind==='time'?1:undefined} value={temporal.value} onChange={e=>setTemporal({...temporal,value:e.target.value})} required/></label><button type="submit">Insert selected {temporal.kind}</button><button type="button" onClick={()=>setTemporal({...temporal,manual:false})}>Back</button></form>}<button type="button" onClick={()=>setTemporal(null)}>Cancel</button></section></div>}
  {insertTool&&<div className="template-backdrop"><form className="file-dialog" role="dialog" aria-modal="true" aria-label={insertTool.kind==='tag'?'Add tag':'Add link'} onSubmit={e=>{e.preventDefault();insertLinkOrTag();}}><h2>{insertTool.kind==='tag'?'Add tag':'Add link'}</h2><label>{insertTool.kind==='tag'?'Tag':'Link target'}<input aria-label={insertTool.kind==='tag'?'Tag':'Link target'} value={target} onChange={e=>setTarget(e.target.value)} required/></label>{insertTool.kind==='link'&&<label>Link label<input aria-label="Link label" value={label} onChange={e=>setLabel(e.target.value)}/></label>}<div className="file-dialog-actions"><button type="submit">Insert</button><button type="button" onClick={()=>setInsertTool(null)}>Cancel</button></div></form></div>}
 </section>;
}
