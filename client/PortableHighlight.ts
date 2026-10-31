import {Mark,mergeAttributes} from '@tiptap/core';
import {highlightInk,normalizeColor,highlightMarkup} from './highlight';
export const PortableHighlight=Mark.create({
 name:'portableHighlight',
 addAttributes:()=>({color:{default:null,parseHTML:element=>{const color=element.style.backgroundColor;const rgb=/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);return rgb?'#'+rgb.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):normalizeColor(color);},renderHTML:attributes=>{const color=normalizeColor(attributes.color??'');return color?{style:`background-color: ${color}; color: ${highlightInk(color)};`}:{};}}}),
 parseHTML:()=>[{tag:'mark'}],renderHTML:({HTMLAttributes})=>['mark',mergeAttributes(HTMLAttributes),0],
 parseMarkdown:(token,h)=>h.applyMark('portableHighlight',h.parseInline(token.tokens??[]),{color:token.color??null}),
 renderMarkdown:(node,h)=>highlightMarkup(h.renderChildren(node),node.attrs?.color??'default'),
 markdownTokenizer:{name:'portableHighlight',level:'inline',start:src=>src.search(/==|<mark\b/i),tokenize:(src,_tokens,lexer)=>{
 const plain=/^==([^\n]+?)==/.exec(src);if(plain)return {type:'portableHighlight',raw:plain[0],tokens:lexer.inlineTokens(plain[1]),color:null};
 const html=/^<mark(?:\s+style="background-color:\s*(#[\da-f]{6});\s*color:\s*#[\da-f]{6};?")?>([^\n]*?)<\/mark>/i.exec(src);if(html)return {type:'portableHighlight',raw:html[0],tokens:lexer.inlineTokens(html[2]),color:html[1]?normalizeColor(html[1]):null};
 }},
});
