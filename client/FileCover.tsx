import React,{useState} from 'react';
import {metadata,type Note} from '../shared/model';
import {attachmentUrl} from './attachment-urls';
import {Image as ImageIcon} from 'lucide-react';
import './file-cover.css';

export function FileCover({note,onUpload,onChange,contextTile}:{note:Note;contextTile?:boolean;onUpload?:(file:File)=>void;onChange?:(key:'hero'|'heroPosition',value:string)=>void}){
 const {properties}=metadata(note.content);
 const hero=typeof properties.hero==='string'&&/^Attachments\/[\w./-]+\.(png|jpe?g|webp|gif)$/i.test(properties.hero)?properties.hero:null;
 const saved=Number(properties.heroPosition??50);
 const [position,setPosition]=useState<number|null>(null);
 if(!hero&&(!contextTile||note.deleted))return null;
 const image=hero&&<img alt="" src={attachmentUrl(hero)} style={{objectPosition:`50% ${position??(Number.isFinite(saved)?Math.max(0,Math.min(100,saved)):50)}%`}}/>;
 return <section className={contextTile?"file-cover file-cover-context":"file-cover"} aria-label={contextTile?"Cover settings":"File cover"} key={note.id}>
  {contextTile?<div className="context-cover">{image||<ImageIcon aria-hidden="true"/>}</div>:image}
  {!note.deleted&&(onUpload||onChange)&&<><div className="file-cover-actions">
   {onUpload&&<label>{hero?'Change cover':'Add cover'}<input aria-label={hero?"Change cover":"Add cover"} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)onUpload(file);}}/></label>}
   {hero&&<><button type="button" aria-expanded={position!==null} onClick={()=>setPosition(position===null?(Number.isFinite(saved)?Math.max(0,Math.min(100,saved)):50):null)}>Reposition</button><button type="button" onClick={()=>{setPosition(null);onChange?.('hero','');}}>Remove cover</button></>}
  </div>
   {hero&&position!==null&&<div className="file-cover-position"><label>Cover position <input type="range" min="0" max="100" value={position} onChange={event=>setPosition(Number(event.currentTarget.value))}/></label><button type="button" onClick={()=>{onChange?.('heroPosition',String(position));setPosition(null);}}>Save position</button><button type="button" onClick={()=>setPosition(null)}>Cancel</button></div>}
  </>}
 </section>;
}
