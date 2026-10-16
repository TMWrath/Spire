import {quickActionInputSchema,actionStem} from '../shared/quick-actions.ts';
import {fullTemplates} from '../shared/full-templates.ts';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {sourceInputSchema,sourceArchiveSchema,sourcePath,sourceRecordMarkdown,citations,rebaseCitations,type SourceInput} from '../shared/sources.ts';
import { emptyState, mutationSchema, safePath, refactor, type State, type Mutation, type Note } from '../shared/model.ts';
export class HttpError extends Error { constructor(public status: number, message: string, public details?: unknown) { super(message); } }
export function noSymlinks(p: string) { const full=path.resolve(p); let part=path.parse(full).root; for(const segment of full.slice(part.length).split(path.sep)){ part=path.join(part,segment); if(fs.existsSync(part) || (()=>{try{return fs.lstatSync(part).isSymbolicLink();}catch{return false;}})()) if(fs.lstatSync(part).isSymbolicLink()) throw new Error('Symbolic link boundary refused'); } }
export function atomic(file: string, data: string | Buffer) { noSymlinks(file); fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700}); const tmp=file+'.tmp-'+randomUUID(); const fd=fs.openSync(tmp,'wx',0o600); try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);} fs.renameSync(tmp,file); if(process.platform!=='win32'){const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}} }
export class Store {
 root: string; state: State; retained: State = emptyState(); poisoned=false; reliquary='vault'; contentDirectory?:string;
 constructor(root: string, options: {contentDirectory?:string} = {}) { this.contentDirectory=options.contentDirectory?path.resolve(options.contentDirectory):undefined; if(this.contentDirectory&&!fs.statSync(this.contentDirectory).isDirectory())throw new Error('Workspace directory unavailable');this.root=path.resolve(root); noSymlinks(this.root);fs.mkdirSync(this.root,{recursive:true,mode:0o700});this.recoverReliquaryMove();this.reliquary=this.load('reliquary.json')?.directory??'vault';if(this.reliquary!=='vault'&&(!this.reliquary.startsWith('reliquaries/')||this.reliquary.split('/').length!==2||!safePath.safeParse(this.reliquary).success))throw new Error('Invalid Reliquary configuration');this.reliquaryDirectory();if((this.contentDirectory||this.load('state.json'))&&!fs.existsSync(this.reliquaryDirectory()))throw new Error('Workspace directory unavailable; reconnect before opening');if(this.reliquary!=='vault'&&!fs.existsSync(this.reliquaryDirectory()))throw new Error('Reliquary directory missing; restore storage before starting');fs.mkdirSync(this.reliquaryDirectory(),{recursive:true,mode:0o700});this.state=this.load('state.json')??emptyState();if(this.contentDirectory&&!this.load('state.json'))this.indexLocalDirectory();const pending=this.load('pending.json');if(pending){this.materialize(pending.before,pending.after);atomic(this.file('state.json'),JSON.stringify(pending.metadataAfter??pending.after));fs.unlinkSync(this.file('pending.json'));this.state=pending.metadataAfter??pending.after;} this.refreshDirectory(); this.verify(); }
 reliquaryDirectory(){const p=this.contentDirectory??path.join(this.root,this.reliquary);noSymlinks(p);return p;}
 location(){return this.contentDirectory?{directory:path.basename(this.contentDirectory),base:path.dirname(this.contentDirectory)}:{directory:this.reliquary,base:this.root};}
 recoverReliquaryMove(){const move=this.load('reliquary-move.json') as {from:string;to:string}|null;if(!move)return;const from=this.file(move.from),to=this.file(move.to);if(fs.existsSync(to)&&!fs.existsSync(from)){atomic(this.file('reliquary.json'),JSON.stringify({directory:move.to}));}else if(!fs.existsSync(from)||fs.existsSync(to))throw new Error('Ambiguous Reliquary migration; manual recovery required');fs.unlinkSync(this.file('reliquary-move.json'));}
 moveReliquary(name:string){const clean=safePath.parse(name);if(this.contentDirectory)return this.location();if(clean.includes('/')||clean==='vault'||clean==='reliquaries')throw new HttpError(400,'Choose a single Reliquary directory name');const target='reliquaries/'+clean;if(this.reliquary===target)return this.location();const from=this.reliquaryDirectory(),to=this.file(target);if(fs.existsSync(to))throw new HttpError(409,'Destination already exists; no files were moved');if(fs.existsSync(this.file('pending.json')))throw new HttpError(503,'Finish pending storage recovery first');fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});atomic(this.file('reliquary-move.json'),JSON.stringify({from:this.reliquary,to:target}));try{fs.renameSync(from,to);if(process.platform!=='win32'){const fd=fs.openSync(path.dirname(to),'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}atomic(this.file('reliquary.json'),JSON.stringify({directory:target}));this.reliquary=target;fs.unlinkSync(this.file('reliquary-move.json'));this.verify();return this.location();}catch(e){this.poisoned=true;throw e;}}
 file(p:string){noSymlinks(path.join(this.root,p));return path.join(this.root,p);}
 load(p:string){const f=this.file(p);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;}
 vault(p:string){safePath.parse(p);if(this.contentDirectory){const target=path.join(this.contentDirectory,p);noSymlinks(target);return target;}return this.file(this.reliquary+'/'+p);}
 refreshDirectory(){
  // Build a complete read-only projection before publishing it. Any failed read
  // leaves the previous index intact; missing entries are not deletion commands.
  if(this.poisoned||fs.existsSync(this.file('pending.json')))throw new HttpError(503,'Storage recovery required');
  const next=structuredClone(this.state),retained=structuredClone(this.retained);
  const files=new Map<string,Buffer>(),dirs:string[]=[],seen=new Set<string>();let total=0,count=0;
  const walk=(relative:string)=>{for(const entry of fs.readdirSync(path.join(this.reliquaryDirectory(),relative),{withFileTypes:true})){
   if(entry.name.startsWith('.'))continue;
   const p=relative?relative+'/'+entry.name:entry.name;safePath.parse(p);const full=this.vault(p);
   if(seen.has(p.toLowerCase()))throw new Error('Case-colliding directory paths');seen.add(p.toLowerCase());
   if(++count>10000)throw new Error('Directory exceeds supported entry count');
   if(entry.isDirectory()){dirs.push(p);walk(p);continue;}
   if(!entry.isFile())throw new Error('Only regular files are supported');
   const size=fs.statSync(full).size;if(size>10_000_000||(total+=size)>100_000_000)throw new Error('Directory exceeds supported size');
   files.set(p,fs.readFileSync(full));
  }};walk('');
  const known=new Set<string>();let changed=false;
  for(const [id,n] of Object.entries(next.notes))if(!n.deleted){
   known.add(n.path);const bytes=files.get(n.path);
   if(!bytes){retained.notes[id]=structuredClone(n);delete next.notes[id];changed=true;continue;}
   const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(content!==n.content){const {history,...previous}=n;n.history=[...history,previous];n.content=content;n.rev++;changed=true;}
  }
  for(const p of next.folders??[])if(!dirs.includes(p)){retained.folders=[...new Set([...(retained.folders??[]),p])];changed=true;}
  const activeFolders=this.contentDirectory?dirs:(next.folders??[]).filter(p=>dirs.includes(p));if(JSON.stringify(next.folders??[])!==JSON.stringify(activeFolders)){next.folders=activeFolders;changed=true;}
  for(const [p,css] of Object.entries(next.styles??{})){known.add(p);const bytes=files.get(p);if(!bytes){retained.styles??={};retained.styles[p]=css;delete next.styles![p];changed=true;}else{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text!==css){next.styles![p]=text;changed=true;}}}
  next.attachments=next.attachments.filter(a=>{known.add(a.path);const bytes=files.get(a.path);if(!bytes){retained.attachments=retained.attachments.filter(x=>x.path!==a.path);retained.attachments.push(a);changed=true;return false;}if(!bytes.equals(Buffer.from(a.data,'base64'))){a.data=bytes.toString('base64');changed=true;}return true;});
  for(const [p,bytes] of files)if(!known.has(p)&&p.endsWith('.md')){const prior=Object.values(retained.notes).find(n=>n.path===p&&!n.deleted);if(prior){next.notes[prior.id]=structuredClone(prior);const n=next.notes[prior.id],content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(n.content!==content){const {history,...previous}=n;n.history=[...history,previous];n.content=content;n.rev++;}delete retained.notes[prior.id];}else this.revise(next,randomUUID(),{path:p,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes),deleted:false},'directory');changed=true;}
  if(changed)next.seq=Math.max(next.seq,this.state.seq+1);
  this.state=next;this.retained=retained;
 }
 recoveryPreviews=new Map<string,{id:string;rev:number;seq:number;parent:string|null;expires:number}>();
 recoveryItems(){
  this.recoveryPreviews.clear();
  return Object.values(this.retained.notes).filter(n=>!this.state.notes[n.id]).map(n=>{
   const token=randomUUID();let parent:string|null=null;try{const s=fs.statSync(path.dirname(this.vault(n.path)));if(s.isDirectory())parent=`${s.dev}:${s.ino}`;}catch{}this.recoveryPreviews.set(token,{id:n.id,rev:n.rev,seq:this.state.seq,parent,expires:Date.now()+120000});
   let canRestore=false;try{canRestore=fs.statSync(path.dirname(this.vault(n.path))).isDirectory()&&!fs.existsSync(this.vault(n.path));}catch{}
   return {id:n.id,path:n.path,retained:n.content,external:null,history:n.history,token,canRestore,canAdopt:false};
  });
 }
 reconcileDirectory(token:string,action:string){
  const preview=this.recoveryPreviews.get(token);if(!preview||preview.expires<Date.now()||action!=='restore')throw new HttpError(409,'Recovery preview expired or unsupported choice');
  const n=this.retained.notes[preview.id];if(!n||n.rev!==preview.rev||this.state.seq!==preview.seq||this.state.notes[n.id])throw new HttpError(409,'Recovery source changed');
  const full=this.vault(n.path),parent=fs.statSync(path.dirname(full));if(fs.existsSync(full)||!parent.isDirectory()||preview.parent!==`${parent.dev}:${parent.ino}`)throw new HttpError(409,'Recovery destination or parent changed');
  this.verify();const next=structuredClone(this.state),{history,...previous}=n;
  next.notes[n.id]={...n,rev:n.rev+1,history:[...history,previous]};next.seq++;
  this.commit(next);this.recoveryPreviews.clear();return {ok:true,warnings:[]};
 }
 metadataState(active:State){const saved=structuredClone(active);for(const [id,n] of Object.entries(this.retained.notes))if(!saved.notes[id])saved.notes[id]=structuredClone(n);saved.folders=[...new Set([...(saved.folders??[]),...(this.retained.folders??[])])];for(const [p,css] of Object.entries(this.retained.styles??{}))if(!(p in (saved.styles??{})))(saved.styles??={})[p]=css;for(const a of this.retained.attachments)if(!saved.attachments.some(x=>x.path===a.path))saved.attachments.push(structuredClone(a));return saved;}
 indexLocalDirectory(){
  // Index existing bytes without rewriting user files. Metadata is kept separately.
  const next=emptyState(), seen=new Set<string>();let total=0,count=0;
  const walk=(relative:string)=>{for(const entry of fs.readdirSync(path.join(this.reliquaryDirectory(),relative),{withFileTypes:true})){
   if(entry.name.startsWith('.'))continue;
   const p=relative?relative+'/'+entry.name:entry.name;safePath.parse(p);const full=this.vault(p);noSymlinks(full);
   if(seen.has(p.toLowerCase()))throw new Error('Case-colliding local paths are not portable: '+p);seen.add(p.toLowerCase());
   if(++count>10000)throw new Error('Local directory exceeds 10000 entries');
   if(entry.isDirectory()){next.folders!.push(p);walk(p);continue;}
   if(!entry.isFile())throw new Error('Only regular local files are supported: '+p);
   const size=fs.statSync(full).size;if(size>10_000_000||(total+=size)>100_000_000)throw new Error('Local directory exceeds supported file/storage size');
   const bytes=fs.readFileSync(full);
   if(p.endsWith('.md')){const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(content.length>1_000_000)throw new Error('Markdown file exceeds supported size');this.revise(next,randomUUID(),{path:p,content,deleted:false},'local-directory');}
   else if(p.toLowerCase().endsWith('.css')){if(bytes.length>100_000)throw new Error('Stylesheet exceeds supported size');next.styles![p]=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
   else next.attachments.push({path:p,data:bytes.toString('base64')});
  }};
  walk('');atomic(this.file('state.json'),JSON.stringify(next));this.state=next;
 }
 verify(){for(const f of this.state.folders??[])if(!fs.statSync(this.vault(f)).isDirectory())throw new Error('Canonical folder missing');for(const n of Object.values(this.state.notes)) if(!n.deleted && fs.readFileSync(this.vault(n.path),'utf8')!==n.content) throw new Error('Canonical content differs from metadata. Stop and recover external changes before starting.');for(const [p,css] of Object.entries(this.state.styles??{}))if(fs.readFileSync(this.vault(p),'utf8')!==css)throw new Error('Canonical stylesheet differs from metadata. Stop and recover external changes before starting.');for(const a of this.state.attachments)if(!fs.readFileSync(this.vault(a.path)).equals(Buffer.from(a.data,'base64')))throw new Error('Attachment verification failed');}
 localFiles(state:State){return new Map<string,Buffer>([...Object.values(state.notes).filter(n=>!n.deleted).map(n=>[n.path,Buffer.from(n.content)] as [string,Buffer]),...Object.entries(state.styles??{}).map(([p,c])=>[p,Buffer.from(c)] as [string,Buffer]),...state.attachments.map(a=>[a.path,Buffer.from(a.data,'base64')] as [string,Buffer])]);}
 guardLocalReplay(before:State,after:State){const old=this.localFiles(before),next=this.localFiles(after);for(const p of new Set([...old.keys(),...next.keys()])){const file=this.vault(p);if(!fs.existsSync(file)){if(old.has(p)&&next.has(p))throw new Error('External deletion requires recovery: '+p);continue;}const data=fs.readFileSync(file);if(!(old.get(p)?.equals(data)||next.get(p)?.equals(data)))throw new Error('External or untracked content requires recovery: '+p);}}
 guardLocalFolder(folder:string){if(!this.contentDirectory)return;const tracked=this.localFiles(this.state);const walk=(p:string)=>{for(const entry of fs.readdirSync(this.vault(p),{withFileTypes:true})){const child=p+'/'+entry.name;if(entry.isDirectory())walk(child);else if(!tracked.has(child))throw new HttpError(409,'Untracked external file prevents folder deletion: '+child);}};walk(folder);}
 removeLocalEmptyFolder(folder:string){const full=this.vault(folder);if(!fs.existsSync(full))return;for(const entry of fs.readdirSync(full,{withFileTypes:true}))if(entry.isDirectory())this.removeLocalEmptyFolder(folder+'/'+entry.name);if(fs.readdirSync(full).length===0)fs.rmdirSync(full);}
 materialize(before:State,after:State){this.guardLocalReplay(before,after);for(const folder of after.folders??[]){const p=this.vault(folder);noSymlinks(p);fs.mkdirSync(p,{recursive:true,mode:0o700});}const files=new Map<string,string|Buffer>();for(const n of Object.values(after.notes))if(!n.deleted)files.set(n.path,n.content);for(const [p,css] of Object.entries(after.styles??{}))files.set(p,css);for(const a of after.attachments)files.set(a.path,Buffer.from(a.data,'base64'));for(const p of files.keys())this.vault(p);for(const n of Object.values(before.notes))this.vault(n.path);for(const p of Object.keys(before.styles??{}))this.vault(p);for(const [p,data] of files){const full=this.vault(p);if(this.contentDirectory&&fs.existsSync(full)&&fs.readFileSync(full).equals(Buffer.isBuffer(data)?data:Buffer.from(data)))continue;atomic(full,data);}for(const p of [...Object.values(before.notes).filter(n=>!n.deleted).map(n=>n.path),...Object.keys(before.styles??{})])if(!files.has(p)){const old=this.vault(p);if(fs.existsSync(old))fs.unlinkSync(old);} }
 commit(next:State){this.verify();this.guardLocalReplay(this.state,next);if(this.poisoned)throw new HttpError(503,'Storage recovery required; restart server'); // Validate every boundary before journal preparation.
 for(const n of Object.values(next.notes))this.vault(n.path);for(const a of next.attachments)this.vault(a.path);for(const f of next.folders??[])this.vault(f);
 const metadataAfter=this.metadataState(next);atomic(this.file('pending.json'),JSON.stringify({before:this.state,after:next,metadataAfter}));try{this.materialize(this.state,next);atomic(this.file('state.json'),JSON.stringify(metadataAfter));fs.unlinkSync(this.file('pending.json'));this.state=next;}catch(e){this.poisoned=true;throw e;}}
 quickTemplate(id:string|null){if(!id)return null;const template=id.startsWith('saved-')?this.state.templates?.find(t=>t.id===id.slice(6)):fullTemplates.find(t=>t.id===id);if(!template)throw new HttpError(409,'The configured template is unavailable. Edit this action in Settings.');return template;}
 saveQuickAction(input:unknown,id?:string,revision?:number){const body=quickActionInputSchema.parse(input);this.quickTemplate(body.templateId);const actions=this.state.quickActions??[];const old=id?actions.find(a=>a.id===id):undefined;if(id&&!old)throw new HttpError(404,'Quick action not found');if(old&&old.revision!==revision)throw new HttpError(409,'Quick action changed elsewhere. Reopen before saving.');safePath.parse(body.folder+'/'+actionStem(body.namePattern)+'.md');const action={...body,id:old?.id??randomUUID(),revision:(old?.revision??0)+1};const next=structuredClone(this.state);next.quickActions=old?actions.map(a=>a.id===id?action:a):[...actions,action];next.seq++;this.commit(next);return action;}
 deleteQuickAction(id:string,revision:number){const actions=this.state.quickActions??[];const old=actions.find(a=>a.id===id);if(!old)throw new HttpError(404,'Quick action not found');if(old.revision!==revision)throw new HttpError(409,'Quick action changed elsewhere');const next=structuredClone(this.state);next.quickActions=actions.filter(a=>a.id!==id);next.seq++;this.commit(next);return {ok:true};}
 reorderQuickActions(ids:string[],expected:string[]){const actions=this.state.quickActions??[];if(JSON.stringify(actions.map(a=>a.id))!==JSON.stringify(expected))throw new HttpError(409,'Action order changed elsewhere');if(ids.length!==actions.length||new Set(ids).size!==ids.length||ids.some(id=>!actions.some(a=>a.id===id)))throw new HttpError(400,'Include every action exactly once');const next=structuredClone(this.state);next.quickActions=ids.map(id=>actions.find(a=>a.id===id)!);next.seq++;this.commit(next);return {ok:true};}
 activateQuickAction(id:string,op:string,device:string){const replay=this.state.quickActionOperations?.[op];if(replay){if(replay.actionId!==id)throw new HttpError(409,'Operation ID already used');const note=this.state.notes[replay.noteId];if(!note)throw new HttpError(410,'Created file is no longer available');return note;}const action=this.state.quickActions?.find(a=>a.id===id);if(!action)throw new HttpError(404,'Quick action not found');const template=this.quickTemplate(action.templateId);const stem=actionStem(action.namePattern);let p='';for(let counter=1;;counter++){p=action.folder+'/'+stem+(counter===1?'':'-'+counter)+'.md';safePath.parse(p);try{this.assertFree(p);break;}catch(e){if(!(e instanceof HttpError&&e.status===409))throw e;if(!fs.existsSync(this.vault(p))&&!Object.values(this.state.notes).some(n=>!n.deleted&&n.path.toLowerCase()===p.toLowerCase())&&!this.state.attachments.some(a=>a.path.toLowerCase()===p.toLowerCase()))throw e;}}
 const next=structuredClone(this.state);const parts=action.folder.split('/');for(let i=1;i<=parts.length;i++){const folder=parts.slice(0,i).join('/');if(!(next.folders??[]).includes(folder))next.folders=[...(next.folders??[]),folder];}const note=this.revise(next,randomUUID(),{path:p,content:template?.content??'',deleted:false,...(action.templateId?{templateIds:[action.templateId]}:{})},device);next.quickActionOperations={...(next.quickActionOperations??{}),[op]:{actionId:id,noteId:note.id}};this.commit(next);return note;}
 saveSource(input:SourceInput,id?:string,expectedRevision?:number){
  const body=sourceInputSchema.parse(input);if(body.attachment){safePath.parse(body.attachment);if(!this.state.attachments.some(a=>a.path===body.attachment))throw new HttpError(400,'Choose an existing attached file');}
  const sources=this.state.sources??[],old=id?sources.find(s=>s.id===id):undefined;if(id&&!old)throw new HttpError(404,'Source not found');if(old&&old.revision!==expectedRevision)throw new HttpError(409,'Source changed elsewhere. Reopen before saving.');if(!old&&sources.length>=1000)throw new HttpError(409,'Source library is full');
  const source={...body,id:old?.id??randomUUID(),revision:(old?.revision??0)+1,created:old?.created??new Date().toISOString()};
  for(const p of [sourcePath(source.id),'Sources/library.json'])if([...Object.values(this.state.notes).filter(n=>!n.deleted).map(n=>n.path),...this.state.attachments.map(a=>a.path)].some(q=>q.toLowerCase()===p.toLowerCase()))throw new HttpError(409,'A workspace file occupies the portable source path');
  const next=structuredClone(this.state);next.sources=old?sources.map(s=>s.id===id?source:s):[...sources,source];next.seq++;this.commit(next);return source;
 }
 captureVideo(input:SourceInput,id:string,extension:string,data:Buffer){
  const body=sourceInputSchema.parse(input);if(body.kind!=='video'||body.attachment)throw new HttpError(400,'Expected video source metadata without original-file attachment');
  const path=`Attachments/video-${id}.${extension}`,sources=this.state.sources??[];
  const existing=sources.find(s=>s.kind==='video'&&s.title===body.title&&s.author===body.author&&(body.url?s.url===body.url:s.description===body.description));
  if(!existing&&sources.length>=1000)throw new HttpError(409,'Source library is full');
  const source=existing??{...body,id:randomUUID(),revision:1,created:new Date().toISOString()};
  if(!existing){this.assertFree(sourcePath(source.id));if(!sources.length)this.assertFree('Sources/library.json');}
  const prior=this.state.attachments.find(a=>a.path===path);if(prior){if(prior.data!==data.toString('base64'))throw new HttpError(409,'Capture identity already contains different media');if(existing)return {source,path};}
  else this.assertFree(path);
  const next=structuredClone(this.state);if(!existing)next.sources=[...sources,source];if(!prior)next.attachments.push({path,data:data.toString('base64')});next.seq++;this.commit(next);return {source,path};
 }
 deleteSource(id:string,revision:number){const old=this.state.sources?.find(s=>s.id===id);if(!old)throw new HttpError(404,'Source not found');if(old.revision!==revision)throw new HttpError(409,'Source changed elsewhere');if(Object.values(this.state.notes).some(n=>citations(n.content).some(c=>c.sourceId===id)))throw new HttpError(409,'This source is cited in files or Trash. Remove those citations before deleting it.');const next=structuredClone(this.state);next.sources=next.sources?.filter(s=>s.id!==id);next.seq++;this.commit(next);return {ok:true};}
 revise(state:State,id:string,value:{path:string;content:string;deleted:boolean;templateIds?:string[]},device:string){const old=state.notes[id];if(old&&old.path!==value.path)value={...value,content:rebaseCitations(value.content,value.path)};const time=new Date().toISOString();const rev=(old?.rev??0)+1;const history=old?[...old.history,{rev:old.rev,path:old.path,content:old.content,deleted:old.deleted,time:old.time,...(old.templateIds?{templateIds:old.templateIds}:{})}]:[];const note:Note={id,...value,...((value.templateIds??old?.templateIds)?{templateIds:[...new Set(value.templateIds??old?.templateIds)]}:{}),rev,time,history};state.notes[id]=note;state.events.push({seq:++state.seq,id,rev,device,time});return note;}
 mutate(input:unknown,device:string){const m=mutationSchema.parse(input);if(this.retained.notes[m.id]&&!this.state.notes[m.id])throw new HttpError(409,'Missing file requires explicit recovery; no files were changed');if(this.state.purged?.includes(m.id))throw new HttpError(410,'Note permanently deleted elsewhere; export local recovery data before discarding pending edits');const replay=this.state.operations[m.op];if(replay){if(replay.id!==m.id)throw new HttpError(409,'Operation ID already used');return this.state.notes[m.id];}const old=this.state.notes[m.id];if((old?.rev??0)!==m.base){const next=structuredClone(this.state);let conflict=next.conflicts.find(c=>c.mutation.op===m.op);if(!conflict){const baseContent=m.base===0&&!old?'':old?.rev===m.base?old.content:old?.history.find(r=>r.rev===m.base)?.content??null;conflict={id:randomUUID(),mutation:m,current:old?.rev??0,time:new Date().toISOString(),baseContent};next.conflicts.push(conflict);this.commit(next);}throw new HttpError(409,'Conflict: local edit preserved',conflict);}
 this.assertFree(m.path,m.id,m.deleted);
 const next=structuredClone(this.state);const all=Object.values(this.state.notes);if(old&&old.path!==m.path&&!m.deleted){for(const n of all)if(!n.deleted&&n.id!==m.id){const content=refactor(n,all,m.id,m.path);if(content!==n.content)this.revise(next,n.id,{path:n.path,content,deleted:false},device);}const oldStyle=old.path.replace(/\.md$/i,'.css'),newStyle=m.path.replace(/\.md$/i,'.css');if(next.styles?.[oldStyle]!==undefined){if(next.styles[newStyle]!==undefined)throw new HttpError(409,'Destination stylesheet already exists');next.styles[newStyle]=next.styles[oldStyle];delete next.styles[oldStyle];}}
 const note=this.revise(next,m.id,{path:m.path,content:m.content,deleted:m.deleted,templateIds:m.templateIds},device);next.operations[m.op]={id:m.id,rev:note.rev};this.commit(next);return note;}
 purge(id:string,base:number,device:string){const n=this.state.notes[id];if(!n)throw new HttpError(404,'Note not found');if(n.rev!==base)throw new HttpError(409,'Conflict: note changed since deletion request');if(!n.deleted)throw new HttpError(409,'Move note to trash before permanent deletion');const next=structuredClone(this.state);delete next.notes[id];next.purged=[...(next.purged??[]),id];next.conflicts=next.conflicts.filter(c=>c.mutation.id!==id);for(const [op,value] of Object.entries(next.operations))if(value.id===id)delete next.operations[op];next.events=next.events.filter(e=>e.id!==id);next.events.push({seq:++next.seq,id,rev:0,device,time:new Date().toISOString()});this.commit(next);return {ok:true};}
 resolveConflict(id:string,choice:{action:'keep-server'|'keep-device'|'keep-both'|'merge';expectedServerRevision:number;path?:string;content?:string},device:string){
  const conflict=this.state.conflicts.find(c=>c.id===id);if(!conflict)throw new HttpError(404,'Conflict not found');
  const current=this.state.notes[conflict.mutation.id];if(!current||current.rev!==choice.expectedServerRevision||current.rev!==conflict.current)throw new HttpError(409,'Server file changed since this conflict was opened');
  const next=structuredClone(this.state);next.conflicts=next.conflicts.filter(c=>c.id!==id);let primary=next.notes[current.id],copy:Note|undefined;
  if(choice.action==='keep-device'||choice.action==='merge'){
   const content=choice.action==='merge'?choice.content:conflict.mutation.content;if(typeof content!=='string')throw new HttpError(400,'Merged content is required');
   this.assertFree(conflict.mutation.path,current.id,conflict.mutation.deleted);primary=this.revise(next,current.id,{path:conflict.mutation.path,content,deleted:conflict.mutation.deleted,templateIds:conflict.mutation.templateIds},device);
  }else if(choice.action==='keep-both'){
   if(!choice.path)throw new HttpError(400,'Choose a path for the device copy');this.assertFree(choice.path);copy=this.revise(next,randomUUID(),{path:choice.path,content:conflict.mutation.content,deleted:false,templateIds:conflict.mutation.templateIds},device);
  }else if(choice.action!=='keep-server')throw new HttpError(400,'Unsupported conflict choice');
  next.seq++;this.commit(next);return {primary,copy};
 }
 assertFree(p:string,id?:string,deleted=false){safePath.parse(p);if(deleted)return;if((this.state.sources??[]).some(s=>sourcePath(s.id).toLowerCase()===p.toLowerCase())||this.state.sources?.length&&p.toLowerCase()==='sources/library.json')throw new HttpError(409,'This path belongs to the source library');const paths=[...Object.values(this.state.notes).filter(n=>!n.deleted&&n.id!==id).map(n=>n.path),...this.state.attachments.map(a=>a.path)];for(const q of paths){const a=p.toLowerCase(),b=q.toLowerCase();if(a===b||a.startsWith(b+'/')||b.startsWith(a+'/'))throw new HttpError(409,'Path already occupied');}if(fs.existsSync(this.vault(p))&&!Object.values(this.state.notes).some(n=>n.id===id&&n.path===p&&!n.deleted))throw new HttpError(409,'Untracked file occupies path');}
 updateTemplate(id:string,input:{title:string;category:'section'|'full';content:string;sourcePath:string},expectedContent:string){
  const templates=this.state.templates??[];const old=templates.find(t=>t.id===id);if(!old)throw new HttpError(404,'Template not found');if(old.content!==expectedContent)throw new HttpError(409,'Template changed on another device. Reopen it before saving.');if(templates.some(t=>t.id!==id&&t.category===input.category&&t.title.toLowerCase()===input.title.trim().toLowerCase()))throw new HttpError(409,'A template with this name already exists in this category');const next=structuredClone(this.state);const saved={...old,...input,title:input.title.trim()};next.templates=templates.map(t=>t.id===id?saved:t);next.seq++;this.commit(next);return saved;
 }
 saveTemplate(input:{title:string;category:'section'|'full';content:string;sourcePath:string}){
  const templates=this.state.templates??[];if(templates.length>=100)throw new HttpError(409,'Template library is full (100 templates)');
  if(templates.some(t=>t.category===input.category&&t.title.toLowerCase()===input.title.trim().toLowerCase()))throw new HttpError(409,'A template with this name already exists in this category');
  const saved={...input,title:input.title.trim(),id:randomUUID(),created:new Date().toISOString()};const next=structuredClone(this.state);next.templates=[...templates,saved];next.seq++;this.commit(next);return saved;
 }
 createFolder(p:string){safePath.parse(p);if((this.state.folders??[]).some(f=>f.toLowerCase()===p.toLowerCase()))throw new HttpError(409,'Folder already exists');const paths=[...Object.values(this.state.notes).filter(n=>!n.deleted).map(n=>n.path),...this.state.attachments.map(a=>a.path)];if(paths.some(q=>q.toLowerCase()===p.toLowerCase()||p.toLowerCase().startsWith(q.toLowerCase()+'/')))throw new HttpError(409,'A file occupies this folder path');if(fs.existsSync(this.vault(p))&&!fs.statSync(this.vault(p)).isDirectory())throw new HttpError(409,'Path occupied');const next=structuredClone(this.state);next.folders=[...(next.folders??[]),p];next.seq++;this.commit(next);return {path:p};}
 moveFolder(folder:string,destination:string,device:string){
  const source=safePath.parse(folder),parent=safePath.parse(destination);this.guardLocalFolder(source);const sourceLower=source.toLowerCase(),parentLower=parent.toLowerCase();
  if(parentLower===sourceLower||parentLower.startsWith(sourceLower+'/'))throw new HttpError(409,'A folder cannot be moved inside itself');
  const inside=(p:string)=>p.toLowerCase()===sourceLower||p.toLowerCase().startsWith(sourceLower+'/');
  const folders=this.state.folders??[];if(!folders.some(inside))throw new HttpError(404,'Folder not found');
  const name=source.split('/').at(-1)!;const target=parent+'/'+name,translate=(p:string)=>target+p.slice(source.length);
  const movingNotes=Object.values(this.state.notes).filter(n=>!n.deleted&&inside(n.path));const movingAttachments=this.state.attachments.filter(a=>inside(a.path));const movingStyles=Object.entries(this.state.styles??{}).filter(([p])=>inside(p));
  const stationaryFolders=folders.filter(f=>!inside(f)).map(p=>p.toLowerCase()),stationaryFiles=[...Object.values(this.state.notes).filter(n=>!n.deleted&&!inside(n.path)).map(n=>n.path),...this.state.attachments.filter(a=>!inside(a.path)).map(a=>a.path),...Object.keys(this.state.styles??{}).filter(p=>!inside(p))].map(p=>p.toLowerCase());
  for(const p of [target,...movingNotes.map(n=>translate(n.path)),...movingAttachments.map(a=>translate(a.path)),...movingStyles.map(([p])=>translate(p))]){const lower=p.toLowerCase();if(stationaryFolders.some(q=>q===lower||q.startsWith(lower+'/'))||stationaryFiles.some(q=>q===lower||q.startsWith(lower+'/')||lower.startsWith(q+'/')))throw new HttpError(409,`Destination path is occupied: ${p}`);}
  const next=structuredClone(this.state),original=Object.values(this.state.notes);for(const n of movingNotes)this.revise(next,n.id,{path:translate(n.path),content:n.content,deleted:false},device);
  for(const current of Object.values(next.notes).filter(n=>!n.deleted)){let content=current.content;const sourceNote=original.find(n=>n.id===current.id)??current;for(const moved of movingNotes)content=refactor({...sourceNote,content},original,moved.id,translate(moved.path));if(content!==current.content)this.revise(next,current.id,{path:current.path,content,deleted:false},device);}
  next.folders=[...new Set([...folders.filter(f=>!inside(f)),...folders.filter(inside).map(translate)])];next.attachments=next.attachments.map(a=>inside(a.path)?{...a,path:translate(a.path)}:a);next.styles=Object.fromEntries(Object.entries(next.styles??{}).map(([p,css])=>[inside(p)?translate(p):p,css]));this.commit(next);return {path:target,moved:movingNotes.length};
 }
 deleteFolder(folder:string,action:{mode:'empty'}|{mode:'trash'}|{mode:'reassign';destination:string},device:string){
  const source=safePath.parse(folder);this.guardLocalFolder(source);const sourceLower=source.toLowerCase();const folders=this.state.folders??[];
  const inside=(p:string)=>p.toLowerCase().startsWith(sourceLower+'/');
  const knownPaths=[...folders,...Object.values(this.state.notes).filter(n=>!n.deleted).map(n=>n.path),...this.state.attachments.map(a=>a.path),...Object.keys(this.state.styles??{})];
  if(!folders.some(f=>f.toLowerCase()===sourceLower)&&!knownPaths.some(inside))throw new HttpError(404,'Folder not found');
  if(action.mode==='empty'){
   const hasContents=Object.values(this.state.notes).some(n=>!n.deleted&&inside(n.path))||this.state.attachments.some(a=>inside(a.path))||Object.keys(this.state.styles??{}).some(inside)||folders.some(f=>inside(f));
   if(hasContents)throw new HttpError(409,'Folder is no longer empty; refresh before deleting it');
   const next=structuredClone(this.state);next.folders=folders.filter(f=>f.toLowerCase()!==sourceLower);next.seq++;
   this.commit(next);const old=this.vault(source);if(this.contentDirectory)this.removeLocalEmptyFolder(source);else if(fs.existsSync(old))fs.rmSync(old,{recursive:true,force:true});return {moved:0,destination:null};
  }
  if(this.state.attachments.some(a=>inside(a.path)))throw new HttpError(409,'Move attachments out of this folder before deleting it');
  const affected=Object.values(this.state.notes).filter(n=>!n.deleted&&inside(n.path));
  const next=structuredClone(this.state);let destination:string|null=null;
  if(action.mode==='trash'){
   for(const n of affected)this.revise(next,n.id,{path:n.path,content:n.content,deleted:true},device);
  }else{
   destination=safePath.parse(action.destination);
   const destinationLower=destination.toLowerCase();
   if(destinationLower===sourceLower||destinationLower.startsWith(sourceLower+'/'))throw new HttpError(409,'Choose a destination outside the folder being deleted');
   const moves=new Map(affected.map(n=>[n.id,destination+'/'+n.path.slice(source.length+1)]));
   const occupied=[...Object.values(this.state.notes).filter(n=>!n.deleted&&!moves.has(n.id)).map(n=>n.path.toLowerCase()),...this.state.attachments.map(a=>a.path.toLowerCase())];
   for(const target of moves.values())if(occupied.includes(target.toLowerCase()))throw new HttpError(409,`Destination path is occupied: ${target}`);
   const original=Object.values(this.state.notes);
   for(const n of affected)this.revise(next,n.id,{path:moves.get(n.id)!,content:n.content,deleted:false},device);
   for(const current of Object.values(next.notes).filter(n=>!n.deleted)){
    let content=current.content;const sourceNote=original.find(n=>n.id===current.id)??current;
    for(const moved of affected)content=refactor({...sourceNote,content},original,moved.id,moves.get(moved.id)!);
    if(content!==current.content)this.revise(next,current.id,{path:current.path,content,deleted:false},device);
   }
   const required=new Set<string>([destination]);
   for(const target of moves.values()){const parts=target.split('/').slice(0,-1);for(let i=1;i<=parts.length;i++)required.add(parts.slice(0,i).join('/'));}
   next.folders=[...new Set([...folders.filter(f=>!inside(f)&&f.toLowerCase()!==sourceLower),...required])];
  }
  if(action.mode==='trash')next.folders=folders.filter(f=>!inside(f)&&f.toLowerCase()!==sourceLower);
  this.commit(next);const old=this.vault(source);if(this.contentDirectory)this.removeLocalEmptyFolder(source);else if(fs.existsSync(old))fs.rmSync(old,{recursive:true,force:true});
  return {moved:affected.length,destination};
 }
 attachment(p:string,data:Buffer){this.assertFree(p);if(p.endsWith('.md'))throw new HttpError(400,'Use note creation for Markdown');if(data.length>10_000_000)throw new HttpError(413,'Attachment exceeds 10 MB');const next=structuredClone(this.state);next.attachments.push({path:p,data:data.toString('base64')});this.commit(next);}
 putStyle(p:string,css:string){safePath.parse(p);if(!p.toLowerCase().endsWith('.css'))throw new HttpError(400,'Stylesheets must end in .css');if(css.length>100_000)throw new HttpError(413,'Stylesheet exceeds 100 KB');if(/@import\b|url\s*\(/i.test(css))throw new HttpError(400,'CSS imports and URLs are not allowed');if(/@(?:namespace|charset|supports|layer|container|document|page|font-face|keyframes)\b/i.test(css))throw new HttpError(400,'This CSS at-rule is not allowed');const next=structuredClone(this.state);next.styles??={};next.styles[p]=css;next.seq++;this.commit(next);return {path:p,content:css};}
 importFiles(files:Record<string,Uint8Array>,device:string){const next=structuredClone(this.state);const added:string[]=[];const warnings:string[]=[];
 const imported=files['Sources/library.json']?sourceArchiveSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(files['Sources/library.json']))):null;
 if(imported){const generated=['Sources/library.json',...imported.sources.map(s=>sourcePath(s.id))];const existingPaths=[...Object.values(next.notes).filter(n=>!n.deleted).map(n=>n.path),...next.attachments.map(a=>a.path),...Object.keys(next.styles??{})];for(const p of generated)if(existingPaths.some(q=>q.toLowerCase()===p.toLowerCase()||p.toLowerCase().startsWith(q.toLowerCase()+'/')||q.toLowerCase().startsWith(p.toLowerCase()+'/'))||(next.folders??[]).some(q=>q.toLowerCase()===p.toLowerCase()||q.toLowerCase().startsWith(p.toLowerCase()+'/')))throw new HttpError(409,'Portable source path is occupied');}
 if(imported){for(const s of imported.sources){if((next.sources??[]).some(existing=>existing.id===s.id))throw new HttpError(409,'Source identity already exists; import into an empty Reliquary');if(s.attachment){safePath.parse(s.attachment);if(!files[s.attachment]&&!next.attachments.some(a=>a.path===s.attachment))throw new HttpError(400,'Source attachment missing');}const record=files[sourcePath(s.id)];if(!record||new TextDecoder('utf-8',{fatal:true}).decode(record)!==sourceRecordMarkdown(s))throw new HttpError(400,'Source record missing or inconsistent');}if((next.sources?.length??0)+imported.sources.length>1000)throw new HttpError(413,'Source library exceeds limit');next.sources=[...(next.sources??[]),...imported.sources];}
const occupied=[...Object.values(next.notes).filter(n=>!n.deleted).map(n=>n.path),...next.attachments.map(a=>a.path)];for(const [p,bytes]of Object.entries(files)){if(imported&&(p==='Sources/library.json'||imported.sources.some(s=>sourcePath(s.id)===p)))continue;if(p.endsWith('/')){const folder=safePath.parse(p.slice(0,-1));if(occupied.some(q=>folder.toLowerCase()===q.toLowerCase()||folder.toLowerCase().startsWith(q.toLowerCase()+'/')))throw new HttpError(409,'Archive folder collision');if(!(next.folders??[]).includes(folder))next.folders=[...(next.folders??[]),folder];added.push(p);continue;}if(p.startsWith('.obsidian/')||p==='.spire-ids.json'){warnings.push(`Skipped configuration: ${p}`);continue;}safePath.parse(p);this.assertFree(p);for(const q of occupied){const a=p.toLowerCase(),b=q.toLowerCase();if(a===b||a.startsWith(b+'/')||b.startsWith(a+'/'))throw new HttpError(409,'Archive path collision');}occupied.push(p);if(p.endsWith('.md')){const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(content.length>1_000_000)throw new HttpError(413,'Note exceeds 1 MB');this.revise(next,randomUUID(),{path:p,content,deleted:false},device);}else{if(bytes.length>10_000_000)throw new HttpError(413,'Attachment exceeds 10 MB');next.attachments.push({path:p,data:Buffer.from(bytes).toString('base64')});}added.push(p);}warnings.push('Plugins are not executed. Canvas, bases, block embeds, math and diagrams are preserved as source, not interpreted. Ambiguous links remain unresolved.');this.commit(next);return{added,warnings};}
}
