import {Extension} from '@tiptap/core';
import {Plugin,PluginKey,type EditorState} from '@tiptap/pm/state';
import type {EditorView} from '@tiptap/pm/view';
export const quickFormats:Record<string,{mark:string;label:string}>={
 bld:{mark:'bold',label:'Bold'},itl:{mark:'italic',label:'Italics'},
 stk:{mark:'strike',label:'Strikethrough'},und:{mark:'underline',label:'Underline'},
};
/** Exact, whitespace-delimited shortcuts; escaped text stays literal. */
export function quickFormatMatch(before:string){
 const m=/(?:^|\s)@(bld|itl|stk|und)$/.exec(before);
 return m?{...quickFormats[m[1]],length:m[1].length+1}:null;
}
const key=new PluginKey<string[]>('quickFormat');
export const QuickFormat=Extension.create({
 name:'quickFormat',priority:1100,
 addProseMirrorPlugins(){
  let pending:string[]=[];
  const stop=(view:EditorView)=>{
   const active=key.getState(view.state)??[];
   if(!active.length)return;
   pending=active;
   let tr=view.state.tr;
   for(const name of active){const mark=view.state.schema.marks[name];if(mark)tr=tr.removeStoredMark(mark);}
   view.dispatch(tr.setMeta(key,[]));
  };
  return [new Plugin<string[]>({
   key,
   appendTransaction(transactions,_old,state){
    if(!pending.length||!transactions.some(tr=>tr.docChanged))return null;
    let tr=state.tr;
    for(const name of pending){const mark=state.schema.marks[name];if(mark)tr=tr.removeStoredMark(mark);}
    pending=[];return tr;
   },
   state:{init:()=>[],apply(tr,active){return tr.getMeta(key)??active;}},
   props:{
    handleTextInput(view,from,to,text){
     if(text!==' '||from!==to||view.composing||!view.editable)return false;
     const {$from}=view.state.selection;
     if($from.parent.type.spec.code||$from.marks().some(m=>m.type.name==='code'))return false;
     const match=quickFormatMatch($from.parent.textBetween(0,$from.parentOffset));
     if(!match)return false;
     const mark=view.state.schema.marks[match.mark];if(!mark)return false;
     const active=key.getState(view.state)??[];
     view.dispatch(view.state.tr.delete(from-match.length,from).addStoredMark(mark.create()).setMeta(key,Array.from(new Set([...active,match.mark]))));
     return true;
    },
    handleKeyDown(view,event){if(event.key==='Enter'&&!event.isComposing&&!view.composing)stop(view);return false;},
    handleDOMEvents:{beforeinput(view,event){
     const input=event as InputEvent;
     if(!input.isComposing&&!view.composing&&['insertParagraph','insertLineBreak'].includes(input.inputType))stop(view);
     return false;
    }},
   },
  })];
 },
});
export function resetQuickFormat(editor:{view:EditorView}){editor.view.dispatch(editor.view.state.tr.setStoredMarks([]).setMeta(key,[]));}
export function quickFormatLabel(editor:{state:EditorState}){
 return (key.getState(editor.state)??[]).map(name=>Object.values(quickFormats).find(f=>f.mark===name)?.label).filter(Boolean).join(' + ');
}
