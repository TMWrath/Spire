import React from 'react';
import type {Note} from '../shared/model';
import {revisionChanges} from './revision-diff';
export function RevisionHistory({note,restore}:{note:Note;restore:(rev:number)=>void}){
 const revisions=[...note.history,note].sort((a,b)=>a.rev-b.rev);
 return <details className="revision-history"><summary>Revision history ({revisions.length})</summary>{[...revisions].reverse().map(r=>{
 const index=revisions.findIndex(x=>x.rev===r.rev),previous=revisions[index-1];
 return <details key={r.rev}><summary>Revision {r.rev}{r.rev===note.rev?' · Current':''} · {new Date(r.time).toLocaleString()}</summary><RevisionDiff previous={previous} current={r}/><details><summary>Full version</summary><pre>{r.content}</pre></details>{r.rev!==note.rev&&<button onClick={()=>{if(confirm(`Restore revision ${r.rev}? Your current version remains in history.`))restore(r.rev);}}>Restore revision {r.rev}</button>}</details>;
 })}</details>;
}
function RevisionDiff({previous,current}:{previous:Note['history'][number]|undefined;current:Note['history'][number]}){
 const d=revisionChanges(previous,current);
 return <section aria-label={`Changes in revision ${current.rev}`}><p className="muted">{previous?`Compared with revision ${previous.rev}`:'Initial version'} · +{d.added} / −{d.removed} lines</p>{d.status&&<p>{d.status}</p>}{d.renamed&&<p>Renamed: {previous!.path} → {current.path}</p>}{!d.added&&!d.removed&&<p>No text changes.</p>}{d.newlineChanged&&<p>Final newline {current.content.endsWith('\n')?'added':'removed'}.</p>}<div className="revision-diff" role="region" aria-label="Line changes">{d.rows.map((row,i)=><div className={`diff-line diff-${row.kind}`} key={i}><span className="diff-number">{row.oldLine??''}</span><span className="diff-number">{row.newLine??''}</span><span aria-label={row.kind}>{row.kind==='added'?'+':row.kind==='removed'?'−':' '}</span><code>{row.text||' '}</code></div>)}</div></section>;
}
