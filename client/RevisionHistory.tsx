import React,{useEffect,useState} from 'react';
import DOMPurify from 'dompurify';
import {History} from 'lucide-react';
import type {Note,Revision} from '../shared/model';
import {renderMarkdown} from './markdown';
import {revisionChanges} from './revision-diff';

export function RevisionHistory({note,restore,loadHistory,loadParents}:{note:Note;restore:(rev:number)=>void;loadHistory?:()=>Promise<Revision[]>;loadParents?:()=>Promise<NonNullable<Note['mergeParents']>>}){
 const [loaded,setLoaded]=useState<{id:string;rev:number;history:Revision[]}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');if(loadHistory)void loadHistory().then(history=>{if(active)setLoaded({id:note.id,rev:note.rev,history});},e=>{if(active)setError(e instanceof Error?e.message:'History unavailable');});return()=>{active=false;};},[note.id,note.rev,retry]);
 const [parents,setParents]=useState(note.mergeParents??[]);useEffect(()=>{let active=true;if(loadParents)void loadParents().then(value=>{if(active)setParents(value);},()=>{});return()=>{active=false;};},[note.id,note.rev]);
 const ready=!loadHistory||loaded?.id===note.id&&loaded.rev===note.rev;
 const revisions=[...(loadHistory?(ready?loaded!.history:[]):note.history),note].sort((a,b)=>a.rev-b.rev);
 const [selected,setSelected]=useState(note.rev),[view,setView]=useState<'changes'|'preview'|'source'>('changes');
 useEffect(()=>setSelected(note.rev),[note.id,note.rev]);
 const index=revisions.findIndex(r=>r.rev===selected),current=revisions[index]??note,previous=revisions[index-1];
 const d=revisionChanges(previous,current);
 const preview=view==='preview'?DOMPurify.sanitize(renderMarkdown({...current,id:note.id,history:[]},[],[]),{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['style']}):'';
 if(error)return <div role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>Retry history</button></div>;
 if(!ready)return <p role="status">Loading this file’s revision history…</p>;
 return <div className="history-shell history-inline">
  {parents.length>0&&<details className="history-branches"><summary>Retained merge versions ({parents.length})</summary><p>Original branch versions are identified separately; equal revision numbers do not mean equal content.</p>{parents.map(parent=><details key={parent.hash}><summary>{parent.revision.path} · original revision {parent.revision.rev} · {parent.hash.slice(0,12)}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{parent.revision.content}</pre></details>)}</details>}
  <div className="history-workspace">
   <nav className="history-timeline" aria-label="Revisions">{[...revisions].reverse().map(r=><button key={r.rev} aria-pressed={r.rev===current.rev} onClick={()=>setSelected(r.rev)}><strong>Revision {r.rev}{r.rev===note.rev&&<span className="history-current">Current</span>}</strong><time>{new Date(r.time).toLocaleString()}</time></button>)}</nav>
   <main className="history-detail">
    <div className="history-detail-head"><div><h3>Revision {current.rev}</h3><p>{previous?`Compared with revision ${previous.rev}`:'Initial version'}</p></div><div className="history-change-count"><span>+{d.added} added</span><span>−{d.removed} removed</span></div></div>
    <div className="history-tabs" role="tablist" aria-label="Revision view">{(['changes','preview','source'] as const).map(v=><button key={v} role="tab" aria-selected={view===v} onClick={()=>setView(v)}>{v==='changes'?'Changes':v==='preview'?'Preview':'Source'}</button>)}</div>
    <div className="history-content" role="tabpanel">{view==='changes'?<><div className="history-metadata">{d.status&&<p>{d.status}</p>}{d.renamed&&<p>Renamed: {previous!.path} → {current.path}</p>}{d.newlineChanged&&<p>Final newline {current.content.endsWith('\n')?'added':'removed'}.</p>}</div>{!d.added&&!d.removed?<div className="history-empty"><History/><h4>No text changes</h4><p>This revision kept the document text unchanged.</p></div>:<RevisionDiff previous={previous} current={current}/>}</>:view==='preview'?<div className="preview history-preview" dangerouslySetInnerHTML={{__html:preview}}/>:<pre className="history-source">{current.content||'This revision is empty.'}</pre>}</div>
    {current.rev!==note.rev&&<div className="history-restore"><p>Restoring creates a new revision. Current history stays intact.</p><button onClick={()=>restore(current.rev)}>Restore revision {current.rev}</button></div>}
   </main>
  </div>
 </div>;
}

function RevisionDiff({previous,current}:{previous:Revision|undefined;current:Revision}){
 const d=revisionChanges(previous,current);
 const visible=d.rows.map((row,i)=>row.kind!=='same'||d.rows.slice(Math.max(0,i-3),i+4).some(r=>r.kind!=='same'));
 return <div className="revision-diff" role="region" aria-label="Line changes">{d.rows.map((row,i)=>!visible[i]?(i===0||visible[i-1]?<div key={i} className="diff-gap">Unchanged lines omitted</div>:null):<div className={`diff-line diff-${row.kind}`} key={i}><span className="diff-number">{row.oldLine??''}</span><span className="diff-number">{row.newLine??''}</span><span aria-label={row.kind}>{row.kind==='added'?'+':row.kind==='removed'?'−':' '}</span><code>{row.text||' '}</code></div>)}</div>;
}
