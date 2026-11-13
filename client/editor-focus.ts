/** Do not summon a software keyboard as a side effect of a toolbar action. */
export function touchEditing(){return typeof window!=='undefined'&&window.matchMedia('(any-pointer: coarse)').matches;}
/** Touch keyboards may hide without blurring; release focus before action taps. */
export function releaseTouchActionFocus(event:{pointerType:string;target:EventTarget|null}){
 if(event.pointerType!=='touch'||!(event.target instanceof Element)||!event.target.closest('button,[role="button"]'))return;
 const active=document.activeElement;
 if(active instanceof HTMLElement&&(active.matches('input,textarea')||active.isContentEditable))active.blur();
}
export function focusForTyping(field:{focus:()=>unknown}|null|undefined){if(!touchEditing())field?.focus();}
