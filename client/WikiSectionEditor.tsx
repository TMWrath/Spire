import React,{useState} from 'react';
import type {Note} from '../shared/model';
import type {Editor} from '@tiptap/react';
import {DocumentEditor,formatDocument} from './DocumentEditor';
import {FormattingToolbar} from './FormattingToolbar';
import {ListView} from './ListView';
import {TableEditor} from './TableEditor';
import {findManagedTableAt,managedTableMarkdown} from '../shared/managed-table';

export const wikiTypes={text:'Text',list:'List',infobox:'Infobox',attributes:'Attribute List',image:'Image',gallery:'Gallery',table:'Table',markdown:'Direct Markdown'} as const;
export type WikiType=keyof typeof wikiTypes;
export function wikiWidget(body:string){
 const marker=/^<!-- spire-wiki:(rich-text|text|list|infobox|attributes|image|gallery|table|markdown) -->\r?\n(?:\r?\n)?/.exec(body);
 const rich=marker?.[1]==='rich-text';
 return {type:(rich?'text':marker?.[1]??'markdown') as WikiType,value:marker?body.slice(marker[0].length).replace(rich||['list','attributes'].includes(marker[1])?/\n*<!-- \/spire-wiki:(?:rich-text|list|attributes) -->\s*$/:/$^/,''):body,typed:!!marker,rich};
}
export const packWidget=(type:WikiType,value:string)=>`<!-- spire-wiki:${type} -->\n\n${value}${['list','attributes'].includes(type)?`\n\n<!-- /spire-wiki:${type} -->\n\n`:''}`;
const escapeText=(value:string)=>value.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g,c=>`&#${c.charCodeAt(0)};`);
const unescapeText=(value:string)=>value.replace(/&#(\d+);/g,(match,n)=>Number(n)<128?String.fromCharCode(Number(n)):match);
const tableBody=(rows:string[][])=>[rows[0],rows[0].map(()=> '---'),...rows.slice(1)].map((row,i)=>`| ${row.map(i===1?cell=>cell:escapeText).join(' | ')} |`).join('\n')+'\n\n';
const infoBody=(rows:string[][])=>tableBody([['Label','Value'],...rows]);
const infoRows=(value:string)=>value.trim().split('\n').slice(2).filter(line=>line.startsWith('|')).map(line=>line.split('|').slice(1,3).map(cell=>unescapeText(cell.trim())));
const fieldName=(label:string)=>label.trim().toLowerCase().replace(/\s+/g,' ');
const isBirthday=(label:string)=>['born','birthday','birth date','date of birth','dob'].includes(fieldName(label));
const ageFrom=(birthday:string,today:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||birthday>today)return null;
 const date=new Date(`${birthday}T00:00:00Z`);
 if(!Number(birthday.slice(0,4))||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==birthday)return null;
 return Number(today.slice(0,4))-Number(birthday.slice(0,4))-Number(today.slice(5)<birthday.slice(5));
};
export function WikiInfobox({value}:{value:string}){
 const today=useLocalDate(),rows=infoRows(value);
 const dates=rows.filter(([label,text])=>isBirthday(label)&&text.trim());
 const age=dates.length===1?ageFrom(dates[0][1].trim(),today):null;
 return <dl className="wiki-infobox">{rows.filter(row=>row.some(Boolean)).map(([label,text],i)=><div key={i}><dt>{label}</dt><dd>{fieldName(label)==='age'&&!text.trim()?(age??'—'):text}</dd></div>)}</dl>;
}
const birthdayData=(value:string)=>/^<!-- spire-birthday:(row|inline) (\d{4}-\d{2}-\d{2}|\d{2}-\d{2}|-) -->\n\n/.exec(value);
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function useLocalDate(){
 const [today,setToday]=useState(()=>localDate(new Date()));
 React.useEffect(()=>{const refresh=()=>setToday(localDate(new Date()));const timer=window.setInterval(refresh,1000);document.addEventListener('visibilitychange',refresh);return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
 return today;
}
function Birthday({value}:{value:string}){
 const today=useLocalDate();
 const data=birthdayData(value),birthday=data?.[2];if(!birthday||birthday==='-')return null;
 const full=birthday.length===10;
 const [y,m,d]=(full?birthday:`2000-${birthday}`).split('-').map(Number);
 const date=new Date(0);date.setUTCFullYear(y,m-1,d);
 if(y<1||date.getUTCDate()!==d||date.getUTCMonth()!==m-1)return null;
 const age=full&&birthday<=today?Number(today.slice(0,4))-y-Number(today.slice(5)<birthday.slice(5)):null;
 const text=new Intl.DateTimeFormat(undefined,{timeZone:'UTC',month:'long',day:'numeric',...(full?{year:'numeric'}:{})}).format(date);
 return <><div><dt>Born</dt><dd>{text}{data?.[1]==='inline'&&age!==null?` (age ${age})`:null}</dd></div>{data?.[1]==='row'&&age!==null&&<div><dt>Age</dt><dd>{age}</dd></div>}</>;
}
type Attribute={label:string;entries:string[]};
const attributeBody=(rows:Attribute[])=>rows.map(row=>`### ${escapeText(row.label)}\n\n${row.entries.map(entry=>'- '+entry.split('\n').join('\n  ')).join('\n')}`).join('\n\n');
const attributesFrom=(value:string):Attribute[]=>value.split(/^### /m).slice(1).map(block=>{const [label,...lines]=block.split('\n');return {label:unescapeText(label),entries:lines.join('\n').replace(/^\n+|\n+$/g,'').split(/^- /m).slice(1).map(entry=>entry.replace(/\n$/,'').replace(/^  /gm,''))};});
export function WikiAttributes({value,render}:{value:string;render:(value:string)=>React.ReactNode}){
 return <dl className="wiki-infobox wiki-attributes"><Birthday value={value}/>{attributesFrom(value).map(({label,entries},i)=>{const filled=entries.filter(e=>e.trim());return <div key={i}><dt>{label}</dt><dd>{filled.length===1?render(filled[0]):filled.length>1?<ul>{filled.map((entry,j)=><li key={j}>{render(entry)}</li>)}</ul>:null}</dd></div>;})}</dl>;
}
export const initialWidget=(type:WikiType)=>type==='table'?tableBody([['Column 1','Column 2'],['','']]):type==='infobox'?infoBody([['','']]):type==='attributes'?attributeBody([{label:'',entries:['']}]):'';

export function WikiSectionEditor({body,name,onChange,attachments,upload,onBusy,depth,note,notes}:{note:Note;notes:Note[];depth:number;body:string;name:string;onChange:(value:string)=>void;attachments:string[];upload:(file:File)=>Promise<string>;onBusy:(busy:boolean)=>void}){
 const {type,value,typed}=wikiWidget(body);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[tableOpen,setTableOpen]=useState(true),[progress,setProgress]=useState('');
 const update=(next:string)=>onChange(typed?packWidget(type,next):next);
 if(type==='gallery'){
  const photos=value.trim().split(/\r?\n\s*\n/).filter(Boolean);
  const relative=(a:string)=>'../'.repeat(depth)+encodePath(a);
  const photo=(path:string,label:string)=>`![${escapeText(label)}](<${relative(path)}>)`;
  const save=(next:string[])=>update(next.length?next.join('\n\n')+'\n\n':'');
  return <div className="wiki-gallery-editor"><ol>{photos.map((entry,i)=><li key={i}>{unescapeText(/^!\[([^\]]*)\]/.exec(entry)?.[1]||'Photo')} <button type="button" disabled={busy} onClick={()=>save(photos.filter((_,j)=>i!==j))}>Remove photo {i+1}</button></li>)}</ol><label>Add existing photo <select value="" disabled={busy} onChange={e=>{const path=e.target.value;if(path)save([...photos,photo(path,path.split('/').pop()??path)]);}}><option value="">Choose a photo</option>{attachments.map(path=><option key={path} value={path}>{path}</option>)}</select></label><label>Upload photos <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={async e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';if(!files.length)return;setError('');setBusy(true);onBusy(true);const next=[...photos],failed:string[]=[];try{for(const [i,file] of files.entries()){setProgress(`Uploading ${i+1} of ${files.length}: ${file.name}`);try{next.push(photo(await upload(file),file.name.replace(/[\r\n]/g,' ')));save([...next]);}catch(err){failed.push(`${file.name}: ${err instanceof Error?err.message:"upload failed"}`);}}setProgress(`${next.length-photos.length} of ${files.length} uploaded`);if(failed.length)setError(`Could not upload: ${failed.join(', ')}`);}finally{setBusy(false);onBusy(false);}}}/></label><output aria-live="polite">{progress}</output>{error&&<p role="alert">{error}</p>}</div>;
 }
 if(type==='text')return <WikiTextEditor note={{...note,content:value}} notes={notes} name={name} attachments={attachments} onChange={next=>onChange(`<!-- spire-wiki:rich-text -->\n\n${next}\n\n<!-- /spire-wiki:rich-text -->\n\n`)}/>;
 if(type==='markdown')return <label className="wiki-widget-body">{name} Markdown<textarea className="wiki-markdown-input" value={value} onChange={e=>update(e.target.value)}/></label>;
 if(type==='list')return <ListView embeddedTitle={name} note={{...note,content:value}} uploadImage={async file=>{onBusy(true);try{return await upload(file);}finally{onBusy(false);}}} onSave={async content=>update(content)}/>;
 if(type==='attributes'){
  const rows=attributesFrom(value);
  const data=birthdayData(value);
  const save=(next:Attribute[],mode=data?.[1]??'',date=data?.[2]??'-')=>update((mode?`<!-- spire-birthday:${mode} ${date} -->\n\n`:'')+attributeBody(next));
  const change=(i:number,row:Attribute)=>save(rows.map((item,k)=>k===i?row:item));
  return <div className="wiki-attribute-editor"><label>Birthday display<select value={data?.[1]??''} onChange={e=>save(rows,e.target.value)}><option value="">Off</option><option value="row">Separate Age row</option><option value="inline">Age beside Born</option></select></label>{data&&<><label>Birthday date<input type="date" max={localDate(new Date())} value={data[2].length===10?data[2]:''} onChange={e=>save(rows,data[1],e.target.value||'-')}/></label><label>Month and day only (MM-DD)<input key={data[2]} defaultValue={data[2].length===5?data[2]:''} placeholder="MM-DD" pattern="[0-9]{2}-[0-9]{2}" onBlur={e=>{if(/^\d{2}-\d{2}$/.test(e.target.value))save(rows,data[1],e.target.value);else if(data[2].length===5&&!e.target.value)save(rows,data[1],'-');}}/></label></>}{rows.map((row,i)=><fieldset key={i}><legend>Attribute {i+1}</legend><label>Attribute label<input value={row.label} onChange={e=>change(i,{...row,label:e.target.value})}/></label>{row.entries.map((entry,j)=><div key={j}><WikiTextEditor note={{...note,id:`${note.id}-${i}-${j}`,content:entry}} notes={notes} attachments={attachments} name={`Entry ${j+1}`} onChange={next=>change(i,{...row,entries:row.entries.map((item,k)=>k===j?next:item)})}/><button type="button" onClick={()=>change(i,{...row,entries:row.entries.filter((_,k)=>k!==j)})}>Remove entry {j+1}</button></div>)}<button type="button" onClick={()=>change(i,{...row,entries:[...row.entries,'']})}>Add entry</button> <button type="button" onClick={()=>save(rows.filter((_,k)=>k!==i))}>Remove attribute</button></fieldset>)}<button type="button" onClick={()=>save([...rows,{label:'',entries:['']}])}>Add attribute</button></div>;
 }
 if(type==='infobox'){
  const rows=infoRows(value);
  return <div className="wiki-infobox-editor">{rows.map((row,i)=><div key={i}>{['Label','Value'].map((label,j)=><input key={label} aria-label={`${label} ${i+1}`} placeholder={j===1&&fieldName(row[0])==='age'?'Auto from birthday':j===1&&isBirthday(row[0])?'YYYY-MM-DD':label} title={j===1&&fieldName(row[0])==='age'?'Leave blank to calculate from a full birthday in this Infobox.':undefined} value={row[j]??''} onChange={e=>update(infoBody(rows.map((entry,k)=>k===i?entry.map((cell,l)=>l===j?e.target.value:cell):entry)))}/>)}<button type="button" aria-label={`Remove row ${i+1}`} onClick={()=>update(infoBody(rows.filter((_,k)=>k!==i)))}>Remove</button></div>)}<button type="button" onClick={()=>update(infoBody([...rows,['','']]))}>Add row</button></div>;
 }
 if(type==='table'){
  const managed=findManagedTableAt(value,0);
  const rows=managed?.cells??value.trim().split('\n').filter((_,i)=>i!==1).filter(line=>line.startsWith('|')).map(line=>line.trim().slice(1,-1).split('|').map(cell=>cell.trim()));
  if(!tableOpen)return <button type="button" onClick={()=>setTableOpen(true)}>Edit table</button>;
  return <TableEditor inline initial={rows.length?rows:[['Column 1','Column 2'],['','']]} initialAlignments={managed?.alignments} editing={!!managed} onClose={()=>setTableOpen(false)} onSave={(cells,alignments)=>{update(managedTableMarkdown(managed?.id??crypto.randomUUID(),cells,alignments)+'\n\n');setTableOpen(false);}}/>;
 }
 const parsed=/^!\[([^\]]*)\]\(<([^>]+)>\)(?:\n\n([^\n]*))?/.exec(value);
 const path=parsed?.[2]??'',caption=unescapeText(parsed?.[3]??'');
 const writeImage=(image:string,text:string)=>update((image?`![${escapeText(text)}](<${image}>)\n\n`:'')+(text?escapeText(text)+'\n\n':''));
 const relative=(a:string)=>'../'.repeat(depth)+encodePath(a);
 const selected=attachments.find(a=>relative(a)===path);
 return <><label>Existing image <select disabled={busy} value={selected??(path?'current':'')} onChange={e=>writeImage(e.target.value?relative(e.target.value):'',caption)}><option value="">Choose an image</option>{path&&!selected&&<option value="current" disabled>Current image</option>}{attachments.map(a=><option key={a} value={a}>{a}</option>)}</select></label><label>Upload image <input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setError('');setBusy(true);onBusy(true);try{writeImage(relative(await upload(file)),caption);}catch(e){setError(e instanceof Error?e.message:'Could not upload image.');}finally{setBusy(false);onBusy(false);}}}/></label>{path&&<label>Caption <input disabled={busy} value={caption} onChange={e=>writeImage(path,e.target.value)}/></label>}{error&&<p role="alert">{error}</p>}</>;
}
function WikiTextEditor({note,notes,name,attachments,onChange}:{note:Note;notes:Note[];name:string;attachments:string[];onChange:(value:string)=>void}){
 const rich=React.useRef<Editor|null>(null),field=React.useRef<HTMLInputElement>(null);
 const insertBlock=(source:string)=>{const e=rich.current;if(e&&!e.isDestroyed)e.commands.insertContent({type:'preservedBlock',attrs:{source}});};
 return <div className="wiki-mini-editor">
 <FormattingToolbar editor={field} markdownAlignment inlineHelp formatMarkdown={(kind,option)=>{const e=rich.current;if(!e||e.isDestroyed)return;if(kind==='list'&&typeof option==='string'&&option.startsWith('builder:'))insertBlock(option.slice(8));else formatDocument(e,kind,option);}} formatHtml={alignment=>{const e=rich.current;if(!e||e.isDestroyed)return;const {from,to}=e.state.selection;const body=e.markdown?.serialize({type:'doc',content:e.state.doc.slice(from,to).content.toJSON()??[]})||'Text';insertBlock(`<div align="${alignment}">\n\n${body}\n\n</div>`);}} onMedia={insertBlock} onSpacer={()=>insertBlock('&nbsp;')} prepareHighlight={()=>{const e=rich.current;if(!e||e.isDestroyed)return null;const {from,to}=e.state.selection;return {text:e.state.doc.textBetween(from,to,'\n'),apply:choice=>{if(e.isDestroyed||from===to)return;const chain=e.chain().setTextSelection({from,to});if(choice==='remove')chain.unsetMark('portableHighlight').run();else chain.setMark('portableHighlight',{color:choice==='default'?null:choice}).run();}};}}/>
 <DocumentEditor note={note} notes={notes} attachments={attachments} label={`${name} Text`} onReady={editor=>{rich.current=editor;}} onChange={onChange} onSource={()=>{}}/>
 </div>;
}
const encodePath=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
