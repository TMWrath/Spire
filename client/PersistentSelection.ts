import {Extension} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';

const key=new PluginKey<{visible:boolean}>('persistentSelection');

/** Paints the saved ProseMirror selection while another mobile control owns focus. */
export const PersistentSelection=Extension.create({
 name:'persistentSelection',
 addProseMirrorPlugins(){return [new Plugin({
  key,
  state:{
   init:()=>({visible:false}),
   apply:(transaction,value)=>transaction.getMeta(key)??value,
  },
  props:{
   decorations(state){
    if(!key.getState(state)?.visible)return null;
    const {from,to}=state.selection;
    if(from!==to)return DecorationSet.create(state.doc,[Decoration.inline(from,to,{class:'persistent-rich-selection'})]);
    const caret=()=>{const node=document.createElement('span');node.className='persistent-rich-caret';node.setAttribute('aria-hidden','true');return node;};
    return DecorationSet.create(state.doc,[Decoration.widget(from,caret,{side:1,key:'persistent-rich-caret'})]);
   },
   handleDOMEvents:{
    blur(view){view.dispatch(view.state.tr.setMeta(key,{visible:true}));return false;},
    focus(view){view.dispatch(view.state.tr.setMeta(key,{visible:false}));return false;},
   },
  },
 })];},
});
