import {ButtonCarousel} from './ButtonCarousel';
import React,{useState} from 'react';
import {ListView} from './ListView';
import {createPortal} from 'react-dom';
import {initialWidget,packWidget,wikiTypes,wikiWidget,WikiAttributes,WikiInfobox,WikiSectionEditor,type WikiType} from './WikiSectionEditor';
import {BookOpen,FilePlus,ChevronRight,Home,List,Pencil} from 'lucide-react';
import {metadata,setProperty,type Note} from '../shared/model';

import {CollectionFileRow} from './TreeItemParts';

export const isWikiPage=(path:string)=>/^(?:Projects\/[^/]+\/)?Wiki\/.+\.md$/.test(path);

export function WikiPanel({collectionRows,project,notes,onOpen,onBack,onRename,onDelete}:{collectionRows:(directory:string,itemsLabel:string,notes:Note[],row:(note:Note)=>React.ReactNode)=>React.ReactNode;project?:string;notes:Note[];onOpen:(note:Note)=>void;onBack?:()=>void;onRename:(note:Note)=>void;onDelete:(note:Note)=>void}){
 const prefix=project?`Projects/${project}/Wiki/`:'Wiki/';
 const pages=notes.filter(n=>!n.deleted&&n.path.startsWith(prefix)&&n.path.endsWith('.md'));
 const title=(n:Note)=>n.path.slice(prefix.length,-3);
 const visible=pages.sort((a,b)=>Number(title(b)==='Home')-Number(title(a)==='Home')||title(a).localeCompare(title(b)));
 return <section id={project?undefined:'sidebar-wiki'} role={project?'region':'tabpanel'} aria-label={project?`${project} Wiki`:'Wiki'} className="sidebar-library journal-list">
 {onBack&&<button type="button" onClick={onBack}>Back to {project}</button>}
 
 <nav className="collection-file-tree" aria-label="Wiki pages">{collectionRows(prefix.slice(0,-1),"wiki pages",visible,n=><CollectionFileRow key={n.id} path={n.path} name={title(n)} icon={<BookOpen/>} onDelete={()=>onDelete(n)} onRename={()=>onRename(n)} onOpen={()=>onOpen(n)}/>)}</nav>
 {!visible.length&&<p className="muted">No wiki pages yet.</p>}
 </section>;
}

type Section={heading:string;body:string};
// Keep the original Markdown bytes outside the edited widget, including frontmatter.
export function wikiSections(body:string):Section[]{
 const result:Section[]=[];let start=0,heading='',fence='',richEnd=-1;
 for(const m of body.matchAll(/[^\n]+/g)){
  const line=m[0],at=m.index!;if(at<=richEnd)continue;
  const widget=/^<!-- spire-wiki:(rich-text|list|attributes) -->$/.exec(line);
  if(!fence&&widget){richEnd=body.indexOf(`\n<!-- /spire-wiki:${widget[1]} -->`,at+line.length)+1;if(richEnd>0)continue;richEnd=-1;}
  const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence='';continue;}
  if(fence||!/^ {0,3}#{1,3}[ \t]+\S/.test(line)||(/^ {0,3}###\s/.test(line)&&!/^ {0,3}#{2,3}\s/.test(heading)))continue;
  if(heading||at>start)result.push({heading,body:body.slice(start,at)});
  const end=at+line.length+Number(body[at+line.length]==='\n');heading=body.slice(at,end);start=end;
 }
 if(heading||start<body.length||!result.length)result.push({heading,body:body.slice(start)});return result;
}
const child=(s:Section)=>/^ {0,3}###\s/.test(s.heading);
const parent=(s:Section)=>/^ {0,3}##\s/.test(s.heading);
const label=(s:Section)=>s.heading.trim().replace(/^#{1,3}\s+/,'').replace(/\s+#+$/,'')||'Overview';
const foldMarker=/^<!-- spire-wiki-fold:(on|off) -->\r?\n/;
const sectionBody=(s:Section)=>s.body.replace(foldMarker,'');
const collapsible=(s:Section)=>{const mode=foldMarker.exec(s.body)?.[1];return mode?mode==='on':/^(history|notable content|related pages)$/i.test(label(s));};
function WikiSectionLabel({name,onRename}:{name:string;onRename:(value:string)=>void}){
 const [editing,setEditing]=useState(false);
 const cancel=React.useRef(false);
 return editing?<input className="wiki-section-label" aria-label="Section title" autoFocus defaultValue={name} onFocus={e=>e.currentTarget.select()} onBlur={e=>{const value=e.currentTarget.value.trim();if(!cancel.current&&value&&value!==name)onRename(value);setEditing(false);}} onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();cancel.current=e.key==='Escape';e.currentTarget.blur();}}}/>:<button type="button" className="wiki-section-label" title={`Rename ${name}`} onClick={()=>{cancel.current=false;setEditing(true);}}>{name}</button>;
}
export function WikiPage({note,notes,title,source,onTab,onChange,onSave,dirty,cover,editorCover,onIndex,render,attachments,upload,indexTarget,onSectionJump}:{indexTarget:HTMLElement|null;onSectionJump:()=>void;attachments:string[];upload:(file:File)=>Promise<string>;note:Note;notes:Note[];title:string;source:boolean;onTab:(source:boolean)=>void;onChange:(content:string)=>void;onSave:()=>Promise<void>;dirty:boolean;cover:React.ReactNode;editorCover:React.ReactNode;onIndex:()=>void;render:(content:string)=>React.ReactNode}){
 const {body,tags}=metadata(note.content),prefix=note.content.slice(0,note.content.length-body.length),sections=wikiSections(body);
 const [active,setActive]=useState(0),[adding,setAdding]=useState<number|null>(null),[uploads,setUploads]=useState(0);
 const [indexOpen,setIndexOpen]=useState<Record<number,boolean>>({});
 const [savePhase,setSavePhase]=useState('');
 const [sectionRevision,bumpSectionRevision]=useState(0);
 const write=(blocks:Section[])=>onChange(prefix+blocks.map(({heading,body},i)=>heading+body+(i<blocks.length-1&&(heading+body)&&!(heading+body).endsWith('\n')?'\n':'')).join(''));
 const editBody=React.useRef((i:number,body:string)=>{});
 editBody.current=(i,body)=>write(sections.map((v,j)=>i===j?{...v,body:(foldMarker.exec(v.body)?.[0]??'')+body}:v));
 const endOf=(i:number)=>{let end=i+1;while(end<sections.length&&child(sections[end]))end++;return end;};
 const choose=(i:number)=><><label>Section type <select autoFocus value="" onChange={event=>{const type=event.target.value as WikiType;if(!type)return;const blocks=sections.slice();blocks.splice(i<0?blocks.length:endOf(i),0,{heading:i<0?'## New section\n':'### New subsection\n',body:packWidget(type,initialWidget(type))});bumpSectionRevision(revision=>revision+1);write(blocks);setAdding(null);}}><option value="">Choose a section type</option>{Object.entries(wikiTypes).filter(([type])=>type!=='attributes').map(([type,name])=><option key={type} value={type}>{name}</option>)}</select></label><button type="button" onClick={()=>setAdding(null)}>Cancel</button></>;
 const indexGroups:{top:number;children:number[]}[]=[];
 sections.forEach((s,i)=>{if(child(s)&&indexGroups.length)indexGroups.at(-1)!.children.push(i);else indexGroups.push({top:i,children:[]});});
 const indexLink=(i:number)=><a href={`#wiki-part-${i}`} aria-current={active===i?'location':undefined} onClick={e=>{e.preventDefault();jump(i);}}>{label(sections[i])}</a>;
 const jump=(i:number)=>{const el=document.getElementById(`wiki-part-${i}`);if(el instanceof HTMLDetailsElement)el.open=true;el?.scrollIntoView({block:'nearest'});setActive(i);onSectionJump();};
 return <section className="wiki-page" aria-label="Wiki page">
  <nav className="wiki-crumb" aria-label="Wiki breadcrumb"><button type="button" onClick={onIndex}><Home size={16}/> Wiki</button><span>/</span><span>{title}</span></nav>
  {indexTarget&&!source&&createPortal(<section className="wiki-context-index"><h2><List size={17}/> Page Index</h2><ul>{indexGroups.map(({top,children})=><li key={top}><div>{indexLink(top)}{!!children.length&&<button type="button" aria-label={`Subsections of ${label(sections[top])}`} aria-expanded={!!indexOpen[top]} onClick={()=>setIndexOpen(open=>({...open,[top]:!open[top]}))}><ChevronRight aria-hidden="true" size={16}/></button>}</div>{!!children.length&&<ul hidden={!indexOpen[top]}>{children.map(i=><li key={i}>{indexLink(i)}</li>)}</ul>}</li>)}</ul></section>,indexTarget)}
  {!source&&cover}
  <header className="wiki-header"><h1><BookOpen aria-hidden="true"/>{title}</h1><div className="presented-list-tabs" role="tablist" aria-label="Wiki page view">{[false,true].map(tab=><button key={String(tab)} id={tab?'wiki-source-tab':'wiki-reading-tab'} role="tab" aria-selected={tab===source} aria-controls="wiki-page-panel" tabIndex={tab===source?0:-1} onClick={()=>onTab(tab)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?false:event.key==='End'?true:!tab;onTab(next);document.getElementById(next?'wiki-source-tab':'wiki-reading-tab')?.focus();}}>{tab?<><Pencil size={14} aria-hidden="true"/> Source</>:'Wiki'}</button>)}</div>{!source&&tags.length>0&&<div className="wiki-tags">{tags.map(t=><span key={t}>#{t}</span>)}</div>}</header>
  <div role="tabpanel" id="wiki-page-panel" aria-labelledby={source?'wiki-source-tab':'wiki-reading-tab'}>{source?<div className="wiki-widgets">
   <fieldset><legend>Cover</legend>{editorCover}</fieldset>
   <fieldset><legend>Tags</legend><label>Page tags <input key={note.id} defaultValue={tags.join(', ')} onBlur={e=>{const next=e.target.value.split(',').map(t=>t.trim().replace(/^#/, '')).filter(Boolean);if(next.join()!==tags.join())onChange(setProperty(note.content,'tags',next));}}/></label></fieldset>
   {sections.map((s,i)=><fieldset className={child(s)?'wiki-subsection':undefined} key={`${sectionRevision}-${i}`}><legend>{s.heading?<WikiSectionLabel name={label(s)} onRename={value=>write(sections.map((v,j)=>i===j?{...v,heading:`${s.heading.trimStart().match(/^#+/)?.[0]??'##'} ${value}\n`}:v))}/>:label(s)}</legend><label className="wiki-fold-setting"><input type="checkbox" checked={collapsible(s)} onChange={e=>{const mode=e.currentTarget.checked?'on':'off';write(sections.map((v,j)=>i===j?{...v,heading:v.heading&& !v.heading.endsWith('\n')?v.heading+'\n':v.heading,body:`<!-- spire-wiki-fold:${mode} -->\n`+sectionBody(v)}:v));}}/> Collapsible in Wiki view</label><WikiSectionEditor note={{...note,id:`${note.id}-section-${i}`}} notes={notes} depth={note.path.split('/').length-1} body={sectionBody(s)} name={label(s)} attachments={attachments} upload={upload} onBusy={busy=>setUploads(n=>n+(busy?1:-1))} onChange={body=>editBody.current(i,body)}/><div className="wiki-section-footer">{parent(s)&&(adding===i?choose(i):<button type="button" disabled={uploads>0} onClick={()=>setAdding(i)}>Add subsection</button>)}<button type="button" disabled={uploads>0||(!s.heading&&!s.body)} aria-label={`Remove section: ${label(s)}`} onClick={()=>{const end=parent(s)?endOf(i):i+1;if(!window.confirm(`Remove “${label(s)}”${end>i+1?' and its subsections':''} from this page?`))return;setAdding(null);bumpSectionRevision(revision=>revision+1);write(sections.filter((_,index)=>index<i||index>=end));}}>Remove section</button></div></fieldset>)}
   <div className="wiki-actions">{adding===-1?choose(-1):<button type="button" disabled={uploads>0} onClick={()=>setAdding(-1)}>Add section</button>}<button type="button" className="primary" disabled={!dirty||uploads>0||savePhase==='Saving…'} onClick={async()=>{setSavePhase('Saving…');try{await onSave();setSavePhase('Saved');}catch{setSavePhase('Save failed');}}}>{savePhase==='Saved'&&dirty?'Save page':savePhase||'Save page'}</button></div>
  </div>:<div className="wiki-grid"><article>{sections.map((s,i)=>{const name=label(s),fold=collapsible(s),widget=wikiWidget(sectionBody(s));const custom=widget.type==='gallery'?<div className="wiki-gallery">{widget.value.trim().split(/\r?\n\s*\n/).filter(Boolean).map((photo,j)=><div key={j}>{render(photo)}</div>)}</div>:widget.type==='attributes'?<WikiAttributes value={widget.value} render={render}/>:widget.type==='infobox'?<WikiInfobox value={widget.value}/>:widget.type==='list'?<ListView embeddedTitle={name} note={{...note,id:`${note.id}-section-${i}`,content:widget.value}} readOnly uploadImage={upload} onSave={async()=>{throw new Error('Edit the list in Wiki Source.');}}/>:null;return fold?<details key={i} id={`wiki-part-${i}`} className={child(s)?'wiki-subsection':undefined}><summary>{name}</summary>{custom??render(widget.value)}</details>:<section key={i} id={`wiki-part-${i}`} className={child(s)?'wiki-section wiki-subsection':'wiki-section'}>{custom?<>{render(s.heading)}{custom}</>:render(s.heading+widget.value)}</section>;})}</article></div>}</div>
 </section>;
}
