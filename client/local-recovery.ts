let editorBusy=()=>false;
let lastInput=0;

export type RecoveryItem=never;
export function setWorkspaceBusyCheck(check:()=>boolean){editorBusy=check;}
export function workspaceRefreshBlocked(){return editorBusy()||Date.now()-lastInput<2000;}
export function markWorkspaceInput(){lastInput=Date.now();}
export function androidLocalRecoveryAvailable(){return false;}
export async function localRecoveryAction(){throw Error('Local workspace recovery was removed from server-only Spire.');}
export function installLocalForegroundRefresh(){return()=>{};}
