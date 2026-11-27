import React,{useEffect,useState} from 'react';
import {api} from './sync';

export const scopes=['Files','Projects','Wiki','Lists','Tasks','Audio Notes','Journal','Sources','Tags','Templates'] as const;
export type SearchScope=typeof scopes[number];
export type SearchItem={id:string;scope:SearchScope;title:string;location?:string;text?:string;open:()=>void};
export function workspaceMatches(items:SearchItem[],query:string,scope:string,remote:ReadonlySet<string>=new Set()){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 if(!terms.length)return [];
 return items.filter(item=>{
  if(scope!=='Everywhere'&&item.scope!==scope)return false;
  const fields=`${item.title}\n${item.location??''}\n${item.text??''}`.toLowerCase();
  return remote.has(item.id)||terms.every(term=>fields.includes(term));
 }).sort((a,b)=>Number(b.title.toLowerCase().includes(query.trim().toLowerCase()))-Number(a.title.toLowerCase().includes(query.trim().toLowerCase()))||a.title.localeCompare(b.title));
}
export function WorkspaceSearch({items,query,scope}:{items:()=>SearchItem[];query:string;scope:SearchScope}){
 const [remote,setRemote]=useState<{query:string;ids:Set<string>}>();
 useEffect(()=>{
  if(!query.trim())return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{void api('/search?q='+encodeURIComponent(query.trim()),{signal:controller.signal}).then((matches:{id:string}[])=>{if(!controller.signal.aborted)setRemote({query,ids:new Set(matches.map(match=>'note:'+match.id))});}).catch(()=>{});},180);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[query]);
 const matches=workspaceMatches(items(),query,scope,remote?.query===query?remote.ids:undefined);
 return matches.length?<ul className="inline-search-results" aria-label="Search results">{matches.slice(0,100).map(item=><li key={item.id}><button type="button" onClick={item.open}>{item.title}<small>{item.location}</small></button></li>)}</ul>:<p role="status" className="muted">No matches.</p>;
}
