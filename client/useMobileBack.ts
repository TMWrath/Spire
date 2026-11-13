import {useEffect,useId,useRef} from 'react';

type Layer={id:string;open:boolean;close:()=>void};
const active=new Map<string,{close:()=>void;order:number}>();
let sequence=0;
const mobileBackTarget=()=>matchMedia('(max-width:760px),(pointer:coarse)').matches;
/** Shared by app panels and child toolbars so the most recently opened layer wins. */
export function useMobileBack(layers:Layer[],root=false,home=false){
 const owner=useId();const atHome=useRef(home);atHome.current=home;
 useEffect(()=>{
  if(!mobileBackTarget())return;
  const ids=new Set(layers.filter(l=>l.open).map(l=>owner+l.id));
  for(const key of active.keys())if(key.startsWith(owner)&&!ids.has(key))active.delete(key);
  for(const layer of layers)if(layer.open){const key=owner+layer.id;active.set(key,{close:layer.close,order:active.get(key)?.order??++sequence});}
 });
 useEffect(()=>()=>{for(const key of active.keys())if(key.startsWith(owner))active.delete(key);},[owner]);
 useEffect(()=>{
  if(!root||!mobileBackTarget())return;
  const arm=()=>history.pushState({...history.state,spireBackGuard:true},'');
  if(!history.state?.spireBackGuard)arm();
  const onPop=()=>{
   const top=[...active.entries()].sort((a,b)=>b[1].order-a[1].order)[0];
   // At Home, skip our same-document base entry and allow normal departure.
   if(!top&&atHome.current){
    history.back();
    return;
   }
   arm();
   if(top){active.delete(top[0]);top[1].close();return;}
   document.querySelector<HTMLButtonElement>('button[aria-label="Home"]')?.click();
  };
  window.addEventListener('popstate',onPop);
  return()=>window.removeEventListener('popstate',onPop);
 },[root]);
}
