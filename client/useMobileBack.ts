import {useEffect,useRef} from 'react';

/** Keeps mobile Back inside Spire until the user confirms leaving from Home. */
export function useMobileBack(root:boolean,home:boolean){
 const atHome=useRef(home);atHome.current=home;
 useEffect(()=>{
  if(!root||!matchMedia('(max-width:760px)').matches)return;
  const arm=()=>history.pushState({...history.state,spireBackGuard:true},'');
  if(!history.state?.spireBackGuard)arm();
  const onPop=()=>{
   if(atHome.current){
    if(window.confirm('Exit Spire?'))history.back();
    else arm();
    return;
   }
   arm();
   document.querySelector<HTMLButtonElement>('button[aria-label="Home"]')?.click();
  };
  window.addEventListener('popstate',onPop);
  return()=>window.removeEventListener('popstate',onPop);
 },[root]);
}
