export type HighlightChoice='default'|'remove'|string;
export const highlightSwatches=[['Yellow','#ffe082'],['Orange','#ffb074'],['Pink','#f5a6cb'],['Red','#ef8b8b'],['Green','#a5d6a7'],['Cyan','#80deea'],['Blue','#90caf9'],['Purple','#c5a3e8']] as const;
export function normalizeColor(value:string):string|null{const v=value.trim().replace(/^#/,'');if(/^[\da-f]{3}$/i.test(v))return '#'+[...v].map(c=>c+c).join('').toLowerCase();return /^[\da-f]{6}$/i.test(v)?'#'+v.toLowerCase():null;}
export function highlightInk(color:string){const c=normalizeColor(color);if(!c)throw new Error('Invalid highlight color');const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return (l+.05)/.05>=1.05/(l+.05)?'#111111':'#ffffff';}
export function highlightMarkup(text:string,choice:HighlightChoice){if(choice==='remove')return text;if(choice==='default')return '=='+text+'==';const color=normalizeColor(choice);if(!color)throw new Error('Invalid highlight color');return `<mark style="background-color: ${color}; color: ${highlightInk(color)};">${text}</mark>`;}
// Whole existing wrappers are replaced, never nested. Partial spans remain independent.
export function applyHighlight(source:string,start:number,end:number,choice:HighlightChoice){
 if(start===end)return {content:source,start,end};
 let text=source.slice(start,end);const inside=/^(?:==([\s\S]*?)==|<mark(?:\s+style="[^"]*")?>([\s\S]*?)<\/mark>)$/i.exec(text);
 if(inside)text=inside[1]??inside[2];
 else if(source.slice(Math.max(0,start-2),start)==='=='&&source.slice(end,end+2)==='=='){start-=2;end+=2;}
 else{const opening=/<mark(?:\s+style="[^"]*")?>$/i.exec(source.slice(0,start));if(opening&&source.slice(end,end+7).toLowerCase()==='</mark>'){start-=opening[0].length;end+=7;}}
 const chunks=text.split(/(\r?\n)/);const result=chunks.map(piece=>!piece||/^\r?\n$/.test(piece)?piece:highlightMarkup(piece,choice)).join('');
 const prefix=choice==='default'?2:choice==='remove'?0:highlightMarkup('',choice).indexOf('>')+1;
 return {content:source.slice(0,start)+result+source.slice(end),start:start+prefix,end:start+prefix+(chunks[0]?.length??0)};
}
export function hsvColor(h:number,s:number,v:number){const f=(n:number)=>{const k=(n+h/60)%6;return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1))));};return '#'+[f(5),f(3),f(1)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function colorHsv(color:string){const c=normalizeColor(color)!;const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;const h=d===0?0:max===r?60*(((g-b)/d+6)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);return {h,s:max===0?0:d/max,v:max};}
// Only literal opaque colors on mark elements are admitted by the preview style filter.
export function safeHighlightStyle(rule:string){return /^\s*(?:background-color|color)\s*:\s*#[\da-f]{6}\s*$/i.test(rule);}
