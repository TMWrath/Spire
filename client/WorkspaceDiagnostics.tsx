import {useEffect,useState} from 'react';
import './workspace-diagnostics.css';
import {installLocalForegroundRefresh} from './local-recovery';
type Entry={path:string;kind:string;message:string;time:string;workspace:string};
const key='spire-availability-log-v1';
function read():Entry[]{try{return JSON.parse(localStorage.getItem(key)??'[]');}catch{return [];}}
export function WorkspaceDiagnostics({log=false}:{log?:boolean}){
 const [entries,setEntries]=useState<Entry[]>(read),[notice,setNotice]=useState(false);
 useEffect(()=>log?undefined:installLocalForegroundRefresh(),[log]);
 useEffect(()=>{
  const receive=()=>{
   const input=(globalThis as any).spireWorkspaceWarnings??[];
   if(!input.length){setNotice(false);return;}
   const saved=read();let changed=false;
   for(const item of input){if(saved.some(e=>e.workspace===location.host&&e.path===item.path&&e.message===item.message))continue;saved.unshift({...item,time:new Date().toISOString(),workspace:location.host});changed=true;}
   if(changed){const next=saved.slice(0,200);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Keep session-visible evidence when storage is unavailable. */}setEntries(next);setNotice(true);}else setEntries(saved);
  };
  receive();addEventListener('spire-workspace-warnings',receive);return()=>removeEventListener('spire-workspace-warnings',receive);
 },[]);
 if(log)return <section role="tabpanel" id="settings-log" aria-label="Activity log"><h2>Activity log</h2><p>Unavailable folders and files are skipped, not deleted. Restore access and use Refresh Local folder to retry on Android. Historical entries stay here after recovery. This device retains the latest 200 entries; dismissing a notice does not clear this log.</p>{!entries.length?<p>No workspace warnings recorded.</p>:<><button onClick={()=>{localStorage.removeItem(key);setEntries([]);}}>Clear activity log</button><ul>{entries.map((e,i)=><li key={i}><strong>{e.kind}: {e.path}</strong><p>{e.message}</p><small>{e.time} · {e.workspace}</small></li>)}</ul></>}</section>;
 if(!notice)return null;
 return <div role="status" className="workspace-warning"><span>Some folders or files were skipped. You can keep writing. Details are in Settings → Activity log.</span><button onClick={()=>setNotice(false)} aria-label="Dismiss workspace warning">Dismiss</button></div>;
}
