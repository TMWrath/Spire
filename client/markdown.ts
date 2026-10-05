import {Marked,Renderer,type TokenizerExtension,type Tokens} from 'marked';
import katex from 'katex';
import hljs from 'highlight.js';
import {metadata,resolveLink,type Note} from '../shared/model';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function attachmentTarget(from:string,target:string,attachments:string[]){
 const parts=from.split('/').slice(0,-1);for(const part of target.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}const relative=parts.join('/');
 return attachments.find(p=>p===relative)??attachments.find(p=>p===target)??attachments.find(p=>p.split('/').at(-1)===target);
}
function excerpt(body:string,heading?:string){
 if(!heading)return body;
 if(heading.startsWith('^')){const id=heading.slice(1);const blocks=body.split(/\n\s*\n/);return blocks.find(b=>new RegExp('\\^'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$').test(b))?.replace(/\s*\^[\w-]+\s*$/,'')??'';}
 const lines=body.split('\n');const start=lines.findIndex(line=>line.replace(/^#{1,6}\s+/,'').trim().toLowerCase()===heading.toLowerCase()&&/^#{1,6}\s/.test(line));if(start<0)return '';const level=lines[start].match(/^#+/)![0].length;let end=start+1;while(end<lines.length){const match=lines[end].match(/^(#{1,6})\s/);if(match&&match[1].length<=level)break;end++;}return lines.slice(start,end).join('\n');
}
export function renderMarkdown(note:Note,notes:Note[],attachments:string[],visited:string[]=[]):string{
 if(visited.includes(note.id)||visited.length>=6)return '<p class="embed-warning">Circular or deeply nested embed.</p>';
 const ancestry=[...visited,note.id];const parser=new Marked({gfm:true});const footnotes=new Map<string,string>();const body=metadata(note.content).body;let taskCursor=0;const blocked:{start:number;end:number}[]=[];let blockOffset=0;for(const token of parser.lexer(body)){if(token.type==='code'||token.type==='html')blocked.push({start:blockOffset,end:blockOffset+token.raw.length});blockOffset+=token.raw.length;}
 const extensions:TokenizerExtension[]=[
 {name:'highlight',level:'inline',start:src=>src.indexOf('=='),tokenizer(src){const m=/^==([^\n]+?)==/.exec(src);if(m)return {type:'highlight',raw:m[0],tokens:this.lexer.inlineTokens(m[1])};}},
 {name:'mathInline',level:'inline',start:src=>src.indexOf('$'),tokenizer(src){const m=/^\$(?!\$)([^\n$]+?)\$(?!\$)/.exec(src);if(m)return {type:'mathInline',raw:m[0],text:m[1]};}},
 {name:'mathBlock',level:'block',start:src=>src.indexOf('$$'),tokenizer(src){const m=/^\$\$\s*\n?([\s\S]*?)\$\$(?:\n|$)/.exec(src);if(m)return {type:'mathBlock',raw:m[0],text:m[1]};}},
 {name:'wiki',level:'inline',start:src=>{const i=src.search(/!?\[\[/);return i<0?undefined:i;},tokenizer(src){const m=/^(!?)\[\[([^\]\n]+)\]\]/.exec(src);if(m)return {type:'wiki',raw:m[0],embed:!!m[1],text:m[2]};}},
 {name:'footnoteDefinition',level:'block',start:src=>src.search(/^\[\^[^\]]+\]:/m),tokenizer(src){const m=/^\[\^([^\]]+)\]:[ \t]*(.*)(?:\n((?:(?: {4}|\t).*\n?)*))?/.exec(src);if(m){footnotes.set(m[1],m[2]+(m[3]?'\n'+m[3].replace(/^(?: {4}|\t)/gm,''):''));return {type:'footnoteDefinition',raw:m[0]};}}},
 {name:'footnoteReference',level:'inline',start:src=>src.indexOf('[^'),tokenizer(src){const m=/^\[\^([^\]]+)\]/.exec(src);if(m)return {type:'footnoteReference',raw:m[0],text:m[1]};}},
 {name:'blockId',level:'inline',start:src=>src.search(/\^[\w-]+(?:\n|$)/),tokenizer(src){const m=/^\^([\w-]+)(?=\n|$)/.exec(src);if(m)return {type:'blockId',raw:m[0],text:m[1]};}}
 ];
 parser.use({extensions:extensions.map(extension=>({...extension,renderer(token:any){
 if(token.type==='highlight')return '<mark>'+this.parser.parseInline(token.tokens)+'</mark>';
 if(token.type==='mathInline'||token.type==='mathBlock')return katex.renderToString(token.text,{displayMode:token.type==='mathBlock',throwOnError:false,trust:false,output:'html',strict:'ignore',maxExpand:1000});
 if(token.type==='footnoteDefinition')return '';
 if(token.type==='footnoteReference')return `<sup><a href="#fn-${escape(token.text)}">${escape(token.text)}</a></sup>`;
 if(token.type==='blockId')return `<span id="${escape(token.text)}" class="block-anchor"></span>`;
 const [destination,label]=token.text.split('|');const [path,heading]=destination.split('#');const target=path?resolveLink({target:path,heading,wiki:true,raw:token.raw,label:label??path,start:0,end:0},note,notes):note;
 if(!token.embed)return `<a href="${escape(encodeURI((target?.path??path)+(heading?'#'+heading:'')))}">${escape(label??destination)}</a>`;
 if(target&&!target.deleted){const body=excerpt(metadata(target.content).body,heading);return `<section class="note-embed" aria-label="Embedded note"><a href="${escape(encodeURI(target.path))}">${escape(label??target.path.split('/').at(-1)!)}</a>${renderMarkdown({...target,content:body},notes,attachments,ancestry)}</section>`;}
 const file=attachmentTarget(note.path,path,attachments);if(!file)return `<span class="embed-warning">Unresolved embed: ${escape(destination)}</span>`;
 const url='/api/attachment?path='+encodeURIComponent(file);const ext=file.split('.').at(-1)?.toLowerCase();if(['png','jpg','jpeg','webp','gif','svg'].includes(ext??''))return `<img src="${escape(url)}" alt="${escape(label??path)}">`;
 if(['mp3','ogg','wav','m4a','flac'].includes(ext??''))return `<audio controls src="${escape(url)}"></audio>`;
 if(['mp4','webm'].includes(ext??''))return `<video controls src="${escape(url)}"></video>`;
 if(ext==='pdf')return `<div class="pdf-embed" data-pdf-path="${escape(file)}"><a href="${escape(url)}">Open ${escape(path)}</a></div>`;
 return `<a href="${escape(url)}">${escape(path)}</a>`;
 }})),renderer:{listitem(token:Tokens.ListItem){let offset=-1;if(token.task&&!visited.length){const first=token.raw.split('\n')[0];let at=body.indexOf(first,taskCursor);while(at>=0&&(blocked.some(b=>at>=b.start&&at<b.end)||(at>0&&body[at-1]!=='\n'&&!/^[ \t]*$/.test(body.slice(body.lastIndexOf('\n',at-1)+1,at))))){at=body.indexOf(first,at+1);}const marker=/^(?:[ \t]*)(?:[-+*]|\d+[.)])[ \t]+\[([ xX])\]/.exec(first);if(at>=0&&marker){offset=note.content.length-body.length+at+marker[0].lastIndexOf('[')+1;taskCursor=at+first.length;}}let html=Renderer.prototype.listitem.call(this,token);if(token.task){html=html.replace('<li','<li class="task-list-item"');if(offset>=0)html=html.replace('<input',`<input data-task-offset="${offset}"`);}return html;},image(token:Tokens.Image){const target=attachmentTarget(note.path,token.href,attachments);const url=target?'/api/attachment?path='+encodeURIComponent(target):token.href;return `<img src="${escape(url)}" alt="${escape(token.text)}">`;},blockquote(token:Tokens.Blockquote){const first=token.text.split('\n')[0];const match=/^\[!([\w-]+)\]([+-])?\s*(.*)$/.exec(first);if(!match)return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>`;const title=match[3]||match[1];const content=parser.parse(token.text.slice(first.length).replace(/^\n/,'')) as string;return match[2]?`<details class="callout callout-${escape(match[1])}" ${match[2]==='+'?'open':''}><summary>${escape(title)}</summary>${content}</details>`:`<aside class="callout callout-${escape(match[1])}"><strong>${escape(title)}</strong>${content}</aside>`;},code(token:Tokens.Code){if(token.lang==='mermaid')return `<pre class="mermaid-source"><code>${escape(token.text)}</code></pre>`;const language=token.lang?.split(/\s+/)[0];const rendered=language&&hljs.getLanguage(language)?hljs.highlight(token.text,{language}).value:escape(token.text);return `<pre><code class="hljs">${rendered}</code></pre>`;}}});
 let result=parser.parse(body) as string;
 if(footnotes.size)result+='<section class="footnotes"><hr><ol>'+[...footnotes].map(([id,text])=>`<li id="fn-${escape(id)}">${parser.parse(text)}</li>`).join('')+'</ol></section>';
 return result;
}
