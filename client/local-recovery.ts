import {localEngine,mounted,type Snapshot} from './sync';
export type RecoveryItem={id:string;path:string;retained:string;external:string|null;history:Array<{rev:number;content:string}>;token:string;canRestore:boolean;canAdopt:boolean};
let editorBusy=()=>true,lastInput=0;
export function setWorkspaceBusyCheck(check:()=>boolean){editorBusy=check;}
export function workspaceRefreshBlocked(){return editorBusy()||mounted.busy||Date.now()-lastInput<2000;}
export function markWorkspaceInput(){lastInput=Date.now();}
export function androidLocalRecoveryAvailable(){return true;} // Shared directory recovery API: Android, desktop and hosted Spire.
function announce(warnings:unknown){(globalThis as any).spireWorkspaceWarnings=warnings;dispatchEvent(new Event('spire-workspace-warnings'));}
export async function localRecoveryAction(action:'refresh'|'reconcile'|'preview',body?:{token:string;action:'adopt'|'restore'}):Promise<RecoveryItem[]>{
 if(!androidLocalRecoveryAvailable())throw Error('Directory recovery is unavailable for this workspace.');
 if(workspaceRefreshBlocked())throw Error('Finish saving and close editor dialogs before refreshing or recovering Local files.');
 return localEngine.exclusive(async()=>{
  if(workspaceRefreshBlocked()||localEngine.cache.outbox.length||localEngine.cache.snapshot.conflicts.length)throw Error('Pending edits or conflicts are retained. Save, sync, and resolve them before Local recovery.');
  let result:any;
  if(action==='preview')result=await localEngine.request('/local/recovery');
  else {
   const path=action==='refresh'?'/local/refresh':'/local/reconcile';
   result=await localEngine.request(path,{method:'POST',body:JSON.stringify(body??{})},localEngine.cache.identity?.csrf);
   if(workspaceRefreshBlocked())throw Error('Refresh completed without replacing your active editor draft. Finish saving before continuing.');
   const snapshot:Snapshot=await localEngine.request('/snapshot');localEngine.cache.snapshot=snapshot;
   localEngine.status=snapshot.conflicts.length?'Conflicts need attention':'Synchronized';await localEngine.persist();
   const latest=result;
   announce(latest.warnings??[]);
   result=await localEngine.request('/local/recovery');
  }
  return result.items??[];
 });
}
// Only an actual return to foreground requests a rescan; polling does not scan SAF.
// Busy/dirty editors defer that single request until idle, rather than losing it.
export function installLocalForegroundRefresh(){
 let pending=false,running=false,lastScan=0,disposed=false;
 const attempt=async()=>{
  if(disposed||!pending||running||document.visibilityState!=='visible'||!androidLocalRecoveryAvailable()||workspaceRefreshBlocked()||Date.now()-lastScan<30000)return;
  running=true;
  try{await localRecoveryAction('refresh');pending=false;lastScan=Date.now();}catch{/* Retain the request for a later idle opportunity; never auto-choose a version. */}finally{running=false;}
 };
 const visibility=()=>{if(document.visibilityState==='visible'){pending=true;void attempt();}};
 document.addEventListener('visibilitychange',visibility);document.addEventListener('beforeinput',markWorkspaceInput,true);
 const timer=window.setInterval(()=>{void attempt();},5000);
 return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('beforeinput',markWorkspaceInput,true);};
}
