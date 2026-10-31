import React from 'react';
import {linkedMedia} from '../shared/transfer-media';
import type {MediaTransferState} from './publication-media-queue';
export function PublicationMediaNotice({note,states,retry}:{note:{path:string;content:string};states:ReadonlyMap<string,MediaTransferState>;retry:()=>void}){
 const pending=linkedMedia(note,[...states.keys()]).flatMap(path=>{const value=states.get(path)!;return value.state==='ready'?[]:[{path,...value}];});
 if(!pending.length)return null;
 return <section className="publication-media-notice" role="status" aria-label="File attachment synchronization">
  <strong>Server copies of this file’s attachments</strong>
  <ul>{pending.map(item=><li key={item.path}><span>{item.path}</span>: {item.state==='transferring'?'Transferring':item.state==='pending'?'Waiting to transfer':`Unavailable — ${item.error??'transfer failed'}`}</li>)}</ul>
  <p>Text synchronization continues independently. Local files are retained.</p>
  {pending.some(item=>item.state==='failed')&&<button type="button" onClick={retry}>Retry attachment sync</button>}
 </section>;
}
