import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,Pencil,Plus} from 'lucide-react';
import './visual-groups.css';

export type VisualEntry={id:string;label:string;node:React.ReactNode};
type Group={id:string;name:string;color:string;members:string[]};
export const visualGroupColors=['#cf8799','#cba36e','#79b2ab','#8c9dd1','#b092cc'];
const validColor=(color?:string)=>Boolean(color&&/^#[0-9a-f]{6}$/i.test(color));

export function VisualSection({name,index,children,project=false,color,onEdit,progress,onTasks,onAdd}:{name:string;index:number;children:React.ReactNode;project?:boolean;color?:string;onEdit?:()=>void;progress?:number;onTasks?:()=>void;onAdd?:()=>void}){
 const [collapsed,setCollapsed]=useState(false);
 return <section className="visual-section" aria-label={(project?'Project ':'Group ')+name} style={{'--group-color':validColor(color)?color:visualGroupColors[index%visualGroupColors.length]} as React.CSSProperties}>
  <div className="visual-section-title"><span>{name}</span><div className="visual-section-actions">{(!project||!collapsed)&&onTasks&&<button type="button" className="visual-section-edit" aria-label={`Tasks for ${name}`} onClick={onTasks}>{progress??0}%</button>}{(!project||!collapsed)&&onAdd&&<button type="button" className="visual-section-edit" aria-label={`Add items to ${name}`} onClick={onAdd}><Plus aria-hidden="true"/></button>}{(!project||!collapsed)&&onEdit&&<button type="button" className="visual-section-edit" aria-label={`Edit ${project?'project':'group'} ${name}`} onClick={onEdit}><Pencil aria-hidden="true"/></button>}{project&&<button type="button" className="visual-section-edit project-collapse" aria-label={`${collapsed?'Expand':'Collapse'} project ${name}`} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<ChevronRight aria-hidden="true"/>:<ChevronDown aria-hidden="true"/>}</button>}</div></div>
  <div className="visual-section-items" hidden={project&&collapsed}>{children}</div>
 </section>;
}

export function VisualGroups({directory,entries,groups,enabled=true,openRequested=false,onRequestHandled,onSave,itemsLabel='files and folders',showEmptyGroups=false}:{showEmptyGroups?:boolean;itemsLabel?:string;scope:string;directory:string;entries:VisualEntry[];groups:Group[];enabled?:boolean;openRequested?:boolean;onRequestHandled?:()=>void;onSave:(groups:Group[])=>Promise<void>}){
 const [draft,setDraft]=useState<Group[]|null>(null);const [error,setError]=useState('');const [editing,setEditing]=useState<string|null>(null);
 useEffect(()=>{if(enabled&&openRequested){setDraft(structuredClone(groups));setEditing(null);setError('');onRequestHandled?.();}},[enabled,openRequested,groups,onRequestHandled]);
 if(!enabled)return <>{entries.map(e=><React.Fragment key={e.id}>{e.node}</React.Fragment>)}</>;
 const assigned=new Set<string>();const sections=new Map<string,Group>();
 for(const g of groups)for(const id of g.members)if(!assigned.has(id)){assigned.add(id);sections.set(id,g);}
 const shown=new Set<string>();
 const open=(id:string|null=null)=>{setDraft(structuredClone(groups));setEditing(id);setError('');};
 return <>
  {entries.map(entry=>{const g=sections.get(entry.id);if(!g)return <React.Fragment key={entry.id}>{entry.node}</React.Fragment>;if(shown.has(g.id))return null;shown.add(g.id);return <VisualSection key={g.id} name={g.name} color={g.color} index={groups.indexOf(g)} onEdit={()=>open(g.id)}>{entries.filter(e=>sections.get(e.id)?.id===g.id).map(e=><React.Fragment key={e.id}>{e.node}</React.Fragment>)}</VisualSection>;})}
  {showEmptyGroups&&groups.filter(g=>!shown.has(g.id)).map(g=><VisualSection key={g.id} name={g.name} color={g.color} index={groups.indexOf(g)} onEdit={()=>open(g.id)}><p className="muted">No {itemsLabel} assigned. Use the pencil to choose {itemsLabel} for this group.</p></VisualSection>)}
  {draft&&createPortal(<div className="template-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDraft(null);}}><form className="file-dialog visual-groups-dialog" role="dialog" aria-modal="true" aria-label={editing?'Edit visual group':'Visual groups'} onKeyDown={e=>{if(e.key==='Escape')setDraft(null);}} onSubmit={async e=>{e.preventDefault();try{const next=draft.filter(g=>g.name.trim()).map(g=>({...g,name:g.name.trim()}));await onSave(next);setDraft(null);}catch{setError('Unable to save groups. Your existing groups are unchanged.');}}}>
   <h2>{editing?'Edit group':'Visual groups'}</h2><p>Grouping changes presentation only; {itemsLabel} stay in place.</p><p className="muted">Saved with this workspace and available in your other browsers.</p>
   {draft.map((g,index)=>editing&&g.id!==editing?null:<fieldset key={g.id}><legend>Group {index+1} · {g.members.length} selected</legend><label>Group name<input autoFocus required maxLength={80} aria-label={'Group name '+(index+1)} value={g.name} onChange={e=>setDraft(draft.map(x=>x.id===g.id?{...x,name:e.target.value}:x))}/></label><label className="visual-group-color">Group color<input type="color" aria-label={'Group color '+(index+1)} value={validColor(g.color)?g.color:visualGroupColors[index%visualGroupColors.length]} onChange={e=>setDraft(draft.map(x=>x.id===g.id?{...x,color:e.target.value}:x))}/></label><p className="muted">Select the {itemsLabel} to display under this group:</p>{entries.map(entry=><label className="visual-group-choice" key={entry.id}><input type="checkbox" checked={g.members.includes(entry.id)} onChange={e=>setDraft(draft.map(x=>x.id===g.id?{...x,members:e.target.checked?[...x.members,entry.id]:x.members.filter(id=>id!==entry.id)}:e.target.checked?{...x,members:x.members.filter(id=>id!==entry.id)}:x))}/><span>{entry.label}</span></label>)}<button type="button" className="danger" onClick={()=>setDraft(draft.filter(x=>x.id!==g.id))}>Remove group</button></fieldset>)}
   {!editing&&<button type="button" onClick={()=>setDraft([...draft,{id:crypto.randomUUID(),name:'',color:visualGroupColors[draft.length%visualGroupColors.length],members:[]}])}>Add group</button>}{error&&<p role="alert">{error}</p>}<div className="file-dialog-actions"><button className="primary" type="submit">{editing?'Save group':'Save groups'}</button><button type="button" onClick={()=>setDraft(null)}>Cancel</button></div>
  </form></div>,document.body)}
 </>;
}
