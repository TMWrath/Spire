import {useEffect,useState} from 'react';
type AppBridge={postMessage:(action:string)=>void;onmessage:((event:{data:string})=>void)|null};
declare global{interface Window{SpireApp?:AppBridge}}
export const androidAppAvailable=()=>typeof window.SpireApp?.postMessage==='function';
export function AndroidSettings(){
 const[info,setInfo]=useState<{version:string;server:string}|null>(null);
 const[error,setError]=useState('');
 useEffect(()=>{const bridge=window.SpireApp;if(!bridge)return;const receive=(event:{data:string})=>{try{const value=JSON.parse(event.data);if(typeof value.version==='string'&&typeof value.server==='string'){setInfo(value);setError('');}}catch{setError('Android app details could not be read.');}};bridge.onmessage=receive;try{bridge.postMessage('info');}catch{setError('Android integration is unavailable.');}return()=>{if(bridge.onmessage===receive)bridge.onmessage=null;};},[]);
 const request=(action:string)=>{try{window.SpireApp?.postMessage(action);}catch{setError('Android integration is unavailable.');}};
 return <section role="tabpanel" id="settings-app" aria-label="Android app"><h2>Android app</h2>{info?<><p>Spire for Android · {info.version}</p><p>{info.server}</p></>:<p>Connecting to Android app…</p>}{error&&<p role="alert">{error}</p>}<p>These controls use Android’s native app features. Reloading or changing servers asks for confirmation; wait for saving to finish first.</p><div className="android-app-actions">{[['Reload','reload'],['Print / Save PDF','print'],['Server connection','connection'],['About','about']].map(([label,action])=><button key={action} disabled={!info} onClick={()=>request(action)}>{label}</button>)}</div></section>;
}
