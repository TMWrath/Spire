import {taskBoardSchema} from '../shared/project-tasks.ts';
import {byteRange} from '../shared/byte-range';
import {workspaceSnapshot} from './workspace-index.ts';
import {workspaceDirectory} from '../shared/workspace-directory.ts';
import {quickActionInputSchema} from '../shared/quick-actions.ts';
import {registerVideo} from './video.ts';

import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { Store, HttpError, atomic } from './store.ts';
import { unpack, exportVault } from './archive.ts';
import {sourceInputSchema} from '../shared/sources.ts';
import { safePath,templateInputSchema } from '../shared/model.ts';
import {visualGroupsSchema} from '../shared/visual-groups.ts';
import {transcribeOnServer} from './voice-transcription.ts';
type Session = {csrf:string;expires:number};
type Auth = {owner?:{id:string;username:string;salt:string;hash:string};sessions:Record<string,Session>};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function createApp(root:string,origin:string,options:{contentDirectory?:string;staticDirectory?:string}={}){
 const app=express(),store=new Store(root,options);const url=new URL(origin);if(url.origin!==origin)throw new Error('SPIRE_ORIGIN must be an exact origin');if(url.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Non-loopback origins require HTTPS');
 app.set('trust proxy',1);
 let auth:Auth=store.load('auth.json')??{sessions:{}};const saveAuth=()=>atomic(store.file('auth.json'),JSON.stringify(auth));
 const serverIdentity:{id:string;name:string}=store.load('server-identity.json')??{id:randomUUID(),name:'Server'};if(!store.load('server-identity.json'))atomic(store.file('server-identity.json'),JSON.stringify(serverIdentity));
 app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'wasm-unsafe-eval'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],mediaSrc:["'self'",'blob:'],objectSrc:["'none'"],frameSrc:["'none'"],upgradeInsecureRequests:url.protocol==='https:'?[]:null}},strictTransportSecurity:url.protocol==='https:'?undefined:false}));
 app.use((req,res,next)=>{if(req.headers.host!==url.host)return res.status(403).json({error:'Host rejected'});next();});
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)){const started=Date.now();res.on('finish',()=>console.info(JSON.stringify({event:'api_mutation',method:req.method,path:req.path,status:res.statusCode,durationMs:Date.now()-started})));}if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return res.status(403).json({error:'Origin rejected'});next();});
 app.use(cookieParser());app.use(express.json({limit:'10mb'}));
 app.get('/api/health',(_req,res)=>res.json({ok:!store.poisoned}));
 app.get('/api/bootstrap',(_req,res)=>res.json({setup:!auth.owner}));
 const credentials=z.object({username:z.string().trim().min(1).max(80),password:z.string().min(12).max(256)});
 const issue=(res:Response)=>{const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');auth.sessions[hash(token)]={csrf,expires:Date.now()+30*24*3600*1000};for(const [key,session] of Object.entries(auth.sessions))if(session.expires<Date.now())delete auth.sessions[key];saveAuth();res.cookie('spire_session',token,{httpOnly:true,secure:url.protocol==='https:',sameSite:'strict',path:'/',maxAge:30*24*3600*1000});res.json({owner:auth.owner!.id,username:auth.owner!.username,server:serverIdentity,csrf,browser:true});};
 app.use(['/api/setup','/api/login'],rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}));
 app.post('/api/setup',(req,res)=>{if(auth.owner)throw new HttpError(409,'Owner already exists');const c=credentials.extend({reliquary:z.string().trim().min(1).max(100)}).parse(req.body);const salt=randomBytes(16).toString('hex');const owner={id:randomUUID(),username:c.username,salt,hash:scryptSync(c.password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')};store.moveReliquary(c.reliquary);auth.owner=owner;issue(res);});
 app.post('/api/login',(req,res)=>{const c=credentials.parse(req.body);const owner=auth.owner;const computed=scryptSync(c.password,owner?.salt??'no-owner',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});if(!owner||!timingSafeEqual(computed,Buffer.from(owner.hash,'hex'))||c.username!==owner.username)throw new HttpError(401,'Invalid credentials');issue(res);});
 app.use('/api',(req,res,next)=>{const token=req.cookies.spire_session;const session=typeof token==='string'?auth.sessions[hash(token)]:undefined;if(!session||session.expires<Date.now()||!auth.owner)return res.status(401).json({error:'Sign in required'});if(!['GET','HEAD'].includes(req.method)&&req.headers['x-csrf-token']!==session.csrf)return res.status(403).json({error:'CSRF token rejected'});res.locals.session=session;res.locals.device={id:'server',name:'Server'};next();});
 app.post('/api/video/capture',express.raw({type:'application/octet-stream',limit:'8mb'}),(req,res)=>{
  const id=z.string().uuid().parse(req.query.id),extension=z.enum(['jpg','webm','mp4']).parse(req.query.extension);let input;try{input=JSON.parse(z.string().max(16000).parse(req.query.source));}catch{throw new HttpError(400,'Invalid video source metadata');}
  const data=req.body;if(!Buffer.isBuffer(data)||!data.length)throw new HttpError(400,'Expected captured media');
  const magic=extension==='jpg'?data.subarray(0,3).equals(Buffer.from([255,216,255])):extension==='webm'?data.subarray(0,4).equals(Buffer.from([26,69,223,163])):data.subarray(4,8).toString()==='ftyp';if(!magic)throw new HttpError(400,'Capture format does not match its media');
  res.json(store.captureVideo(sourceInputSchema.parse(input),id,extension,data));
 });
 app.post('/api/voice/transcribe',express.raw({type:'application/octet-stream',limit:'10mb'}),async(req,res)=>{
  if(!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(400,'Expected recorded audio');
  const language=z.enum(['en','de','fr','es','it','nl','pl']).optional().parse(req.query.language||undefined);
  const keywords=z.string().max(500).optional().transform(value=>value?.split(',').map(item=>item.trim()).filter(Boolean).slice(0,20)??[]).parse(req.query.keywords||undefined);
  try{res.json(await transcribeOnServer(req.body,{language,keywords}));}catch(error){const status=(error as {status?:number}).status;if(status)throw new HttpError(status,error instanceof Error?error.message:'Transcription failed');throw error;}
 });
 registerVideo(app);
 const identity=(res:Response)=>({owner:auth.owner!.id,username:auth.owner!.username,server:serverIdentity,csrf:res.locals.session.csrf,browser:true});
 app.get('/api/me',(_req,res)=>res.json(identity(res)));
 app.get('/api/reliquary',(_req,res)=>res.json(store.location()));
 app.post('/api/reliquary/migrate',(req,res)=>res.json(store.moveReliquary(z.object({name:z.string().trim().min(1).max(100)}).parse(req.body).name)));
 app.post('/api/logout',(req,res)=>{delete auth.sessions[hash(req.cookies.spire_session)];saveAuth();res.clearCookie('spire_session',{path:'/'});res.json({ok:true});});

 app.post('/api/workspace/fields',(req,res)=>res.json(store.updateWorkspaceFields(req.body)));
 app.post('/api/quick-actions',(req,res)=>res.status(201).json(store.saveQuickAction(req.body)));
 app.put('/api/quick-actions/order',(req,res)=>{const body=z.object({ids:z.array(z.string().uuid()),expected:z.array(z.string().uuid())}).parse(req.body);res.json(store.reorderQuickActions(body.ids,body.expected));});
 app.put('/api/quick-actions/:id',(req,res)=>{const body=quickActionInputSchema.extend({revision:z.number().int().positive()}).parse(req.body);res.json(store.saveQuickAction(body,String(req.params.id),body.revision));});
 app.delete('/api/quick-actions/:id',(req,res)=>res.json(store.deleteQuickAction(String(req.params.id),z.coerce.number().int().positive().parse(req.query.revision))));
 app.post('/api/quick-actions/:id/activate',(req,res)=>res.status(201).json(store.activateQuickAction(String(req.params.id),z.object({op:z.string().uuid()}).parse(req.body).op,res.locals.device.id)));
 app.put('/api/templates/:id',(req,res)=>{const body=templateInputSchema.extend({expectedContent:z.string().max(1_000_000)}).parse(req.body);res.json(store.updateTemplate(req.params.id,body,body.expectedContent));});
 app.post('/api/templates',(req,res)=>{const body=templateInputSchema.parse(req.body);res.status(201).json(store.saveTemplate(body));});
 app.post('/api/sources',(req,res)=>res.status(201).json(store.saveSource(sourceInputSchema.parse(req.body))));
 app.put('/api/sources/:id',(req,res)=>{const body=sourceInputSchema.extend({expectedRevision:z.number().int().positive()}).parse(req.body);const {expectedRevision,...input}=body;res.json(store.saveSource(input,String(req.params.id),expectedRevision));});
 app.delete('/api/sources/:id',(req,res)=>res.json(store.deleteSource(String(req.params.id),z.coerce.number().int().positive().parse(req.query.revision))));
 app.get('/api/workspace/directory',(_req,res)=>res.json(workspaceDirectory(store.state)));
 app.get('/api/workspace/files/:id/content',(req,res)=>{const note=store.state.notes[String(req.params.id)];if(!note||note.deleted)throw new HttpError(404,'File unavailable');const directory=workspaceDirectory(store.state).files.find(file=>file.id===note.id)!;res.json({id:note.id,path:note.path,rev:note.rev,deleted:note.deleted,time:note.time,content:note.content,createdTime:directory.createdTime,editTimes:directory.editTimes,...(note.navigation?{navigation:note.navigation}:{}),...(note.templateIds?{templateIds:note.templateIds}:{})});});
 app.get('/api/workspace/files/:id/history',(req,res)=>{const note=store.state.notes[String(req.params.id)];if(!note)throw new HttpError(404,'File unavailable');res.json(note.history);});
 app.get('/api/snapshot',(_req,res)=>res.json(workspaceSnapshot(store)));
 app.put('/api/visual-groups',(req,res)=>{const body=z.object({directory:z.string().max(240),groups:visualGroupsSchema}).parse(req.body);res.json(store.saveVisualGroups(body.directory,body.groups));});
 app.get('/api/project-tasks',(_req,res)=>{store.migrateProjectFiles();res.json(store.projectTaskBoards());});
 app.get('/api/project-overview/:project/background',(req,res)=>{
  const {background}=store.getProjectOverview(String(req.params.project));
  const image=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(background);
  if(!image){res.status(204).end();return;}
  res.type(image[1]).send(Buffer.from(image[2],'base64'));
 });
 app.get('/api/project-overview/:project',(req,res)=>res.json(store.getProjectOverview(String(req.params.project))));
 app.put('/api/project-overview/:project',(req,res)=>res.json(store.saveProjectOverview(String(req.params.project),req.body)));
 app.delete('/api/project-overview/:project',(req,res)=>{const revision=z.number().int().nonnegative().parse(req.body?.revision);res.json(store.trashProjectOverview(String(req.params.project),revision));});
 app.post('/api/project-task-file/:project',(req,res)=>{const body=z.object({taskId:z.string().uuid(),revision:z.number().int().nonnegative(),path:safePath}).parse(req.body);res.json(store.createTaskFile(String(req.params.project),body.taskId,body.revision,body.path));});
 app.put('/api/project-tasks/:project',(req,res)=>{const project=z.string().min(1).max(100).refine(n=>!/[\\/]/.test(n)&&n!=='.'&&n!=='..').parse(req.params.project);res.json(store.saveProjectTasks(project,taskBoardSchema.parse(req.body)));});
 app.get('/api/projects',(_req,res)=>{const prefix='Projects/';const names=new Set<string>();for(const folder of store.state.folders??[])if(folder.startsWith(prefix)){const name=folder.slice(prefix.length).split('/')[0];if(name)names.add(name);}for(const note of Object.values(store.state.notes))if(!note.deleted&&note.path.startsWith(prefix)){const name=note.path.slice(prefix.length).split('/')[0];if(name)names.add(name);}res.json([...names].sort((a,b)=>a.localeCompare(b)).map(name=>({name,path:prefix+name})));});
 app.post('/api/projects',(req,res)=>{const name=z.string().trim().min(1).max(100).refine(value=>!/[\\/]/.test(value)&&value!=='.'&&value!=='..','Use a project name without slashes').parse(req.body?.name);const projectPath='Projects/'+name;if((store.state.folders??[]).some(folder=>folder.toLowerCase()===projectPath.toLowerCase())||Object.values(store.state.notes).some(note=>!note.deleted&&note.path.toLowerCase().startsWith(projectPath.toLowerCase()+'/')))throw new HttpError(409,'A project with this name already exists');store.createFolder(projectPath);res.status(201).json({name,path:projectPath});});
 app.put('/api/styles',(req,res)=>{const body=z.object({path:safePath.refine(p=>p.toLowerCase().endsWith('.css'),'Stylesheets must end in .css'),content:z.string().max(100_000)}).parse(req.body);res.json(store.putStyle(body.path,body.content));});
 app.post('/api/folders',(req,res)=>res.status(201).json(store.createFolder(z.object({path:safePath}).parse(req.body).path)));
 app.post('/api/folders/move',(req,res)=>{const body=z.object({path:safePath,destination:safePath}).parse(req.body);res.json(store.moveFolder(body.path,body.destination,res.locals.device.id));});
 app.delete('/api/folders',(req,res)=>{const body=z.discriminatedUnion('mode',[z.object({path:safePath,mode:z.literal('empty')}),z.object({path:safePath,mode:z.literal('trash')}),z.object({path:safePath,mode:z.literal('reassign'),destination:safePath})]).parse(req.body);res.json(store.deleteFolder(body.path,body.mode==='empty'?{mode:'empty'}:body.mode==='trash'?{mode:'trash'}:{mode:'reassign',destination:body.destination},res.locals.device.id));});
 app.post('/api/folders/rename',(req,res)=>{const body=z.object({path:safePath,name:safePath}).parse(req.body);res.json(store.moveFolder(body.path,body.path.split('/').slice(0,-1).join('/'),res.locals.device.id,body.name));});
 app.get('/api/events',(req,res)=>{const after=z.coerce.number().int().nonnegative().parse(req.query.after??0);res.json(store.state.events.filter(e=>e.seq>after));});
 app.get('/api/search',(req,res)=>{const q=z.string().max(300).parse(req.query.q??'').toLowerCase();res.json(Object.values(store.state.notes).filter(n=>!n.deleted&&q.trim().split(/\s+/).every(term=>(n.path+'\n'+n.content).toLowerCase().includes(term))).map(n=>({id:n.id,path:n.path})));});

 app.post('/api/mutate',(req,res)=>res.json(store.mutate(req.body,res.locals.device.id)));
 app.post('/api/restore/:id',(req,res)=>{const b=z.object({base:z.number().int(),rev:z.number().int(),op:z.string().uuid()}).parse(req.body);const n=store.state.notes[String(req.params.id)];if(!n)throw new HttpError(404,'Note not found');const revision=[...n.history,n].find(h=>h.rev===b.rev);if(!revision)throw new HttpError(404,'Revision not found');res.json(store.mutate({...revision,id:n.id,base:b.base,op:b.op,deleted:false},res.locals.device.id));});
 app.delete('/api/trash/:id',(req,res)=>{const base=z.coerce.number().int().nonnegative().parse(req.query.base);res.json(store.purge(String(req.params.id),base,res.locals.device.id));});
 app.post('/api/trash-files/:id/restore',(req,res)=>res.json(store.restoreTrashedFile(String(req.params.id))));
 app.delete('/api/trash-files/:id',(req,res)=>res.json(store.purgeTrashedFile(String(req.params.id))));
 app.post('/api/conflicts/:id/resolve',(req,res)=>{const body=z.discriminatedUnion('action',[
  z.object({action:z.literal('keep-server'),expectedServerRevision:z.number().int().nonnegative()}),
  z.object({action:z.literal('keep-device'),expectedServerRevision:z.number().int().nonnegative()}),
  z.object({action:z.literal('keep-both'),expectedServerRevision:z.number().int().nonnegative(),path:safePath.refine(p=>p.endsWith('.md'),'Files must end in .md')}),
  z.object({action:z.literal('merge'),expectedServerRevision:z.number().int().nonnegative(),content:z.string().max(1_000_000)})
 ]).parse(req.body);res.json(store.resolveConflict(String(req.params.id),body,res.locals.device.id));});

 app.post('/api/attachments',express.raw({type:'application/octet-stream',limit:'10mb'}),(req,res)=>{const p=safePath.parse(req.query.path);if(!Buffer.isBuffer(req.body))throw new HttpError(400,'Expected binary upload');store.attachment(p,req.body);res.json({path:p});});
 app.get('/api/attachment',(req,res)=>{const p=safePath.parse(req.query.path);const a=store.state.attachments.find(a=>a.path===p);if(!a)throw new HttpError(404,'Attachment not found');const ext=path.extname(p).toLowerCase();const types:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.ogv':'video/ogg','.pdf':'application/pdf'};res.set('Content-Security-Policy',"sandbox; default-src 'none'");res.type(types[ext]??'application/octet-stream');res.set('Content-Disposition',`${types[ext]?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(path.basename(p))}`);const bytes=Buffer.from(a.data,'base64');res.set('Accept-Ranges','bytes');if(req.headers.range){const range=byteRange(req.headers.range,bytes.length);if(!range){res.status(416).set('Content-Range',`bytes */${bytes.length}`).end();return;}res.status(206).set('Content-Range',`bytes ${range.start}-${range.end}/${bytes.length}`).send(bytes.subarray(range.start,range.end+1));return;}res.send(bytes);});
 app.post('/api/import',express.raw({type:'application/zip',limit:'25mb'}),(req,res)=>{if(!Buffer.isBuffer(req.body))throw new HttpError(400,'Expected ZIP');res.json(store.importFiles(unpack(req.body),res.locals.device.id));});
 app.get('/api/export',(_req,res)=>res.type('application/zip').attachment('spire-vault.zip').send(Buffer.from(exportVault(store))));
 app.use('/api',(_req,res)=>res.status(404).json({error:'Not found'}));
 app.use(express.static(path.resolve(options.staticDirectory??'dist'),{setHeaders:(res,p)=>{if(p.endsWith('sw.js')||p.endsWith('index.html'))res.setHeader('Cache-Control','no-cache');}}));
 app.get('/',(_req,res)=>res.sendFile(path.resolve(options.staticDirectory??'dist','index.html')));
 app.use((e:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(e instanceof z.ZodError)return res.status(400).json({error:e.issues.map(i=>i.message).join('; ')});if(e instanceof HttpError)return res.status(e.status).json({error:e.message,details:e.details});const status=(e as {status?:number}).status;if(status===413)return res.status(413).json({error:'Payload too large'});if(status===400)return res.status(400).json({error:'Invalid request body'});console.error('Request failed:',e instanceof Error?e.name:'unknown');res.status(500).json({error:'Storage or archive error; no success acknowledged'});});
 return{app,store};
}
