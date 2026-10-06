/** Do not summon a software keyboard as a side effect of a toolbar action. */
export function touchEditing(){return typeof window!=='undefined'&&window.matchMedia('(any-pointer: coarse)').matches;}
export function focusForTyping(field:{focus:()=>unknown}|null|undefined){if(!touchEditing())field?.focus();}
