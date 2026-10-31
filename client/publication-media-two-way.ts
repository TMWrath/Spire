import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
type Transport={raw:(url:string,options?:RequestInit)=>Promise<Response>};
type Options={progress?:(update:import('./publication-media-queue').MediaProgress)=>void;workspace:string;csrf:string;localCsrf:string;current:()=>boolean;readBase:()=>Promise<string|undefined>;writeBase:(hash:string)=>Promise<void>};
const digest=(bytes:Uint8Array)=>bytesToHex(sha256(bytes));
export async function reconcilePublicationAttachment(attachment:{path:string;size:number;remove?:boolean},local:Transport,remote:Transport,options:Options){
 const guard=()=>{if(!options.current())throw Error('Workspace changed; media transfer cancelled');};guard();
 const path=encodeURIComponent(attachment.path),scope='&workspace='+encodeURIComponent(options.workspace);
 options.progress?.({direction:'checking',phase:'Reading Local bytes'});
 const response=await local.raw('/attachment?path='+path);guard();
 if(!response.ok&&response.status!==404)throw Error('Local attachment unavailable: '+attachment.path);
 const bytes=response.ok?new Uint8Array(await response.arrayBuffer()):undefined;guard();
 const localHash=bytes?digest(bytes):'missing',base=await options.readBase();guard();
 options.progress?.({phase:'Checking Server hash'});
 const infoResponse=await remote.raw('/device-workspaces/self/attachment-info?path='+path+scope);guard();
 if(!infoResponse.ok)throw Error('Server attachment probe HTTP '+infoResponse.status+': '+attachment.path);
 const info=await infoResponse.json() as {hash:string;size:number;deleted?:boolean};guard();
 if(attachment.remove){
  if(info.deleted!==true)throw Error('Server attachment was restored; deletion cancelled');
  if(localHash==='missing'){await options.writeBase('missing');return;}
  if(base!==localHash)throw Error('Attachment deletion conflict: newer Local bytes retained');
  const removed=await local.raw('/attachments/sync?path='+path+'&expected='+localHash,{method:'DELETE',headers:{'X-CSRF-Token':options.localCsrf}});guard();
  if(!removed.ok||(await removed.json()).hash!=='missing')throw Error('Local deletion was not confirmed; retry');
  guard();await options.writeBase('missing');return;
 }
 if(info.deleted)throw Error('Server attachment was deleted; stale transfer cancelled');
 if(!/^(missing|[a-f0-9]{64})$/.test(info.hash)||!Number.isSafeInteger(info.size)||info.size<0)throw Error('Invalid Server attachment receipt');
 if(info.hash===localHash){if(localHash==='missing')throw Error('Attachment bytes unavailable: '+attachment.path);await options.writeBase(localHash);return;}
 if(localHash==='missing'||localHash===base){
  if(info.hash==='missing')throw Error('Server attachment bytes unavailable; Local copy retained');
  if(info.size!==attachment.size)throw Error('Server attachment metadata changed; retry synchronization');
  options.progress?.({direction:'download',phase:'Downloading Server bytes',total:info.size});
  const download=await remote.raw('/device-workspaces/self/attachment?path='+path+scope);guard();
  if(!download.ok)throw Error('Server attachment download failed');
  const data=new Uint8Array(await download.arrayBuffer());guard();
  if(data.length!==info.size||digest(data)!==info.hash)throw Error('Server attachment hash or size differs');
  options.progress?.({phase:'Saving verified Local bytes',loaded:data.length});
  const saved=await local.raw('/attachments/sync?path='+path+'&expected='+localHash,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':options.localCsrf},body:new Blob([data])});guard();
  if(!saved.ok||(await saved.json()).hash!==info.hash)throw Error('Local attachment changed or download was not confirmed');
  guard();await options.writeBase(info.hash);return;
 }
 if(info.hash==='missing'||info.hash===base){
  if(!bytes||bytes.length!==attachment.size)throw Error('Local attachment size changed; retry synchronization');
  options.progress?.({direction:'upload',phase:'Uploading Local bytes',total:bytes.length});
  const uploaded=await remote.raw('/device-workspaces/self/attachment?path='+path+scope+'&hash='+localHash+'&base='+info.hash,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':options.csrf},body:new Blob([bytes])});guard();
  if(!uploaded.ok||(await uploaded.json()).hash!==localHash)throw Error('Server attachment changed or upload was not confirmed');
  guard();await options.writeBase(localHash);return;
 }
 throw Error('Attachment conflict: Local and Server bytes differ; both copies retained');
}
