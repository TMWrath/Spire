import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'dompurify';
import {X,History} from 'lucide-react';
import type {Note,Revision} from '../shared/model';
import {renderMarkdown} from './markdown';
import {revisionChanges} from './revision-diff';
export function RevisionHistory({note,restore}:{note:Note;restore:(rev:number)=>void}){
 const [opened,setOpened]=useState(false);
 return <><button className="history-launch" onClick={()=>setOpened(true)}><History size={18}/><span>Revision history</span><span className="history-count">{note.history.length+1}</span></button>{opened&&createPortal(<HistoryDialog note={note} restore={restore} close={()=>setOpened(false)}/>,document.body)}</>;
}
function HistoryDialog({note,restore,close}:{note:Note;restore:(rev:number)=>void;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const revisions=[...note.history,note].sort((a,b)=>a.rev-b.rev);
 const [selected,setSelected]=useState(note.rev),[view,setView]=useState<'changes'|'preview'|'source'>('changes');
 const index=revisions.findIndex(r=>r.rev===selected),current=revisions[index]??note,previous=revisions[index-1];
 const d=revisionChanges(previous,current);
 useEffect(()=>setSelected(note.rev),[note.id,note.rev]);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{el?.close();};},[]);
 const preview=view==='preview'?DOMPurify.sanitize(renderMarkdown({...current,id:note.id,history:[]},[],[]),{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['style']}):'';
 return <dialog ref={dialog} className="history-dialog" aria-label="Revision history" onCancel={e=>{e.preventDefault();close();}}><div className="history-shell"><div className="history-header"><div><span className="history-eyebrow">DOCUMENT HISTORY</span><h2>{note.path.split('/').at(-1)}</h2><p>{note.path}</p></div><button aria-label="Close revision history" onClick={close}><X/></button></div><div className="history-workspace"><nav className="history-timeline" aria-label="Revisions">{[...revisions].reverse().map(r=><button key={r.rev} aria-pressed={r.rev===current.rev} onClick={()=>setSelected(r.rev)}><strong>Revision {r.rev}{r.rev===note.rev&&<span className="history-current">Current</span>}</strong><time>{new Date(r.time).toLocaleString()}</time></button>)}</nav><main className="history-detail"><div className="history-detail-head"><div><h3>Revision {current.rev}</h3><p>{previous?`Compared with revision ${previous.rev}`:'Initial version'}</p></div><div className="history-change-count"><span>+{d.added} added</span><span>−{d.removed} removed</span></div></div><div className="history-tabs" role="tablist" aria-label="Revision view">{(['changes','preview','source'] as const).map(v=><button key={v} role="tab" aria-selected={view===v} onClick={()=>setView(v)}>{v==='changes'?'Changes':v==='preview'?'Preview':'Source'}</button>)}</div><div className="history-content" role="tabpanel">{view==='changes'?<><div className="history-metadata">{d.status&&<p>{d.status}</p>}{d.renamed&&<p>Renamed: {previous!.path} → {current.path}</p>}{d.newlineChanged&&<p>Final newline {current.content.endsWith('\n')?'added':'removed'}.</p>}</div>{!d.added&&!d.removed?<div className="history-empty"><History/><h4>No text changes</h4><p>This revision kept the document text unchanged.</p></div>:<RevisionDiff previous={previous} current={current}/>}</>:view==='preview'?<div className="preview history-preview" dangerouslySetInnerHTML={{__html:preview}}/>:<pre className="history-source">{current.content||'Empty document'}</pre>}</div><footer className="history-footer"><span>Restoring keeps your current version in history.</span><button disabled={current.rev===note.rev} onClick={()=>{if(confirm(`Restore revision ${current.rev}? Your current version remains in history.`)){restore(current.rev);close();}}}>{current.rev===note.rev?'Current version':`Restore revision ${current.rev}`}</button></footer></main></div></div></dialog>;
}
function RevisionDiff({previous,current}:{previous:Revision|undefined;current:Revision}){
 const d=revisionChanges(previous,current);
 const visible=d.rows.map((row,i)=>row.kind!=='same'||d.rows.slice(Math.max(0,i-3),i+4).some(r=>r.kind!=='same'));
 return <div className="revision-diff" role="region" aria-label="Line changes">{d.rows.map((row,i)=>!visible[i]?(i===0||visible[i-1]?<div key={i} className="diff-gap">Unchanged lines omitted</div>:null):<div className={`diff-line diff-${row.kind}`} key={i}><span className="diff-number">{row.oldLine??''}</span><span className="diff-number">{row.newLine??''}</span><span aria-label={row.kind}>{row.kind==='added'?'+':row.kind==='removed'?'−':' '}</span><code>{row.text||' '}</code></div>)}</div>;
}
