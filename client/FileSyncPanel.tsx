import React,{useState} from 'react';
import {linkedMedia} from '../shared/transfer-media';
import type {MediaTransferState} from './publication-media-queue';
export function FileSyncPanel({note,attachments,states,documentStatus,workspaceStatus,retry}:{note:{path:string;content:string};attachments:{path:string;size:number}[];states:ReadonlyMap<string,MediaTransferState>;documentStatus:string;workspaceStatus:string;retry:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const paths=linkedMedia(note,[...new Set([...attachments.map(a=>a.path),...states.keys()])]);
 const attempt=async()=>{setBusy(true);setError('');try{await retry();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <section role="tabpanel" aria-label="File synchronization" className="file-sync-panel">
  <h3>Document sync</h3><p>{documentStatus}</p><p>Workspace: {workspaceStatus}</p>
  <button type="button" disabled={busy} onClick={()=>void attempt()}>{busy?'Checking…':'Retry / check sync'}</button>{error&&<p role="alert">{error}</p>}
  <h3>Linked attachments ({paths.length})</h3>
  {!paths.length&&<p>No linked attachments found in this workspace’s index. This does not confirm that missing media has synced.</p>}
  <ul style={{listStyle:'none',padding:0}}>{paths.map(path=>{const value=states.get(path);const size=attachments.find(a=>a.path===path)?.size;return <li key={path} style={{overflowWrap:'anywhere',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
   <strong>{path}</strong><div>{value?.direction==='upload'?'Client → Server':value?.direction==='download'?'Server → client':'Checking both copies'}</div>
   <div>{!value?'Not started':value.state==='pending'?'Queued':value.state==='failed'?'Failed':value.state==='ready'?'Confirmed':value.phase??'Transferring'}</div>
   {value?.state==='transferring'&&<progress aria-label={'Transfer '+path}/>}
   {size!==undefined&&<div>{size} bytes{value?.loaded!==undefined?` · ${value.loaded} bytes received/read`:''}</div>}
   {value?.error&&<p role="alert">{value.error}</p>}
   {value?.startedAt&&<small>Started {new Date(value.startedAt).toLocaleTimeString()}{value.finishedAt?` · Finished ${new Date(value.finishedAt).toLocaleTimeString()}`:''}</small>}
  </li>;})}</ul>
  <p className="muted">Transfer stages are real; no estimated percentage is shown when the transport cannot report byte progress. Status covers this app session.</p>
 </section>;
}
