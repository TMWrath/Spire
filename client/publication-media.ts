type AttachmentSnapshot={attachments:{path:string;size:number}[]};
type RawEngine={raw(url:string,options?:RequestInit):Promise<Response>};

const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');

export async function syncPublicationAttachments(snapshot:AttachmentSnapshot,local:RawEngine,remote:RawEngine,csrf:string,isCurrent:()=>boolean=()=>true,workspace?:string){
 const guard=()=>{if(!isCurrent())throw Error("Workspace changed; media transfer cancelled");};
 for(const attachment of snapshot.attachments){
  guard();
  const source=await local.raw('/attachment?path='+encodeURIComponent(attachment.path));
  guard();
  if(!source.ok)throw Error(`Local attachment unavailable: ${attachment.path}`);
  const bytes=await source.arrayBuffer();
  guard();
  if(bytes.byteLength!==attachment.size)throw Error(`Local attachment size differs: ${attachment.path}`);
  const hash=hex(await crypto.subtle.digest('SHA-256',bytes));
  guard();
  const route='/device-workspaces/self/attachment?path='+encodeURIComponent(attachment.path)+'&hash='+hash+(workspace===undefined?'':'&workspace='+encodeURIComponent(workspace));
  const probe=await remote.raw(route,{method:'HEAD'});
  guard();
  if(probe.status===204)continue;
  if(probe.status!==404)throw Error(`Server attachment check failed (${probe.status}): ${attachment.path}`);
  const upload=await remote.raw(route,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:new Blob([bytes])});
  if(!upload.ok)throw Error(`Server attachment upload failed (${upload.status}): ${attachment.path}`);
 }
}
