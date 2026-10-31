import {Buffer} from 'buffer';
import path from 'path-browserify';
let references=new Map();
export const referenceBytes=ref=>Buffer.from('SPIRE-SAF-REFERENCE\0'+JSON.stringify(ref));
const sameEntry=(a,b)=>a===b||(a&&b&&typeof a==='object'&&typeof b==='object'&&a.kind===b.kind&&a.id===b.id&&a.size===b.size&&a.modified===b.modified);
let files=new Map(), dirs=new Set(['/','/workspace']), handles=new Map(), nextHandle=1, dirtyFiles=new Set(), dirtyDirs=new Set();
const clean=p=>{const s=path.resolve('/',p);if(s!=='/'&&s!=='/workspace'&&!s.startsWith('/workspace/'))throw Error('Outside workspace');return s;};
export let owner;
export function load(snapshot,token){owner=token;references=new Map();files=new Map(Object.entries(snapshot.files).map(([p,b])=>{const full=clean('/workspace/'+p);if(typeof b!=='string'){if(b?.kind!=='saf')throw Error('Invalid storage reference');references.set(full,b);return [full,referenceBytes(b)];}return [full,Buffer.from(b,'base64')];}));dirs=new Set(['/','/workspace',...snapshot.dirs.map(p=>clean('/workspace/'+p))]);handles=new Map();dirtyFiles=new Set();dirtyDirs=new Set();for(const p of files.keys())mkdirSync(path.dirname(p));dirtyDirs.clear();}
// Reconcile only changed acknowledged entries; leave unrelated buffers untouched.
export function apply(before,after){
 for(const p of Object.keys(before.files))if(!(p in after.files)){files.delete(clean('/workspace/'+p));references.delete(clean('/workspace/'+p));}
 for(const [p,value] of Object.entries(after.files))if(!sameEntry(value,before.files[p])){
  const full=clean('/workspace/'+p);mkdirSync(path.dirname(full));
  if(typeof value==='string'){references.delete(full);files.set(full,Buffer.from(value,'base64'));}
  else{references.set(full,value);files.set(full,referenceBytes(value));}
 }
 const nextDirs=new Set(after.dirs.map(p=>clean('/workspace/'+p)));
 for(const p of [...dirs])if(p.startsWith('/workspace/')&&!nextDirs.has(p))dirs.delete(p);
 for(const p of nextDirs)mkdirSync(p);
 dirtyFiles.clear();dirtyDirs.clear();
}
export function changes(){return {files:new Set([...dirtyFiles].map(p=>p.slice(11))),dirs:new Set([...dirtyDirs].map(p=>p.slice(11)))};}
export function dump(acknowledged){
 const output=acknowledged?{...acknowledged.files}:{};
 if(acknowledged){for(const full of dirtyFiles){const relative=full.slice(11),b=files.get(full);if(!b)delete output[relative];else output[relative]=references.has(full)?preserveReference(full,b):b.toString('base64');}}
 else for(const [p,b] of files)output[p.slice(11)]=references.has(p)?preserveReference(p,b):b.toString('base64');
 const outputDirs=acknowledged&&dirtyDirs.size===0?acknowledged.dirs:[...dirs].filter(p=>p.startsWith('/workspace/')).map(p=>p.slice(11)).sort();
 return {files:output,dirs:outputDirs};
}
export function acknowledge(){dirtyFiles.clear();dirtyDirs.clear();}
// Opaque references exist only in the in-memory Store adapter, never as file bytes.
function preserveReference(p,b){const ref=references.get(p);if(!b.equals(referenceBytes(ref)))throw Error('Deferred attachment cannot be overwritten');return ref;}
function existsSync(p){p=clean(p);return files.has(p)||dirs.has(p);}
function statSync(p){p=clean(p);if(!existsSync(p))throw Error('Missing file: '+p);return {size:files.get(p)?.length??0,isFile:()=>files.has(p),isDirectory:()=>dirs.has(p),isSymbolicLink:()=>false};}
function mkdirSync(p){p=clean(p);for(let q=p;;q=path.dirname(q)){if(files.has(q))throw Error('File occupies directory');if(!dirs.has(q)){dirs.add(q);if(q.startsWith('/workspace/'))dirtyDirs.add(q);}if(q==='/')break;}}
function readFileSync(p,encoding){p=clean(p);const b=files.get(p);if(!b)throw Error('Missing file: '+p);return encoding?b.toString(encoding):Buffer.from(b);}
function writeFileSync(p,data){p=typeof p==='number'?handles.get(p):clean(p);if(!p||dirs.has(p)||!dirs.has(path.dirname(p)))throw Error('Invalid write');files.set(p,Buffer.isBuffer(data)?Buffer.from(data):Buffer.from(data));dirtyFiles.add(p);}
function readdirSync(p,options){p=clean(p);if(!dirs.has(p))throw Error('Not a directory');const entries=[...dirs,...files.keys()].filter(q=>q!==p&&path.dirname(q)===p);return entries.map(q=>options?.withFileTypes?{name:path.basename(q),...statSync(q)}:path.basename(q));}
function unlinkSync(p){p=clean(p);if(!files.delete(p))throw Error('Missing file');references.delete(p);dirtyFiles.add(p);}
function rmdirSync(p){p=clean(p);if(readdirSync(p).length)throw Error('Directory not empty');if(p==='/workspace'||p==='/')throw Error('Cannot remove root');dirs.delete(p);dirtyDirs.add(p);}
function renameSync(a,b){a=clean(a);b=clean(b);if(!files.has(a)||dirs.has(b))throw Error('Only file replacement supported');files.set(b,files.get(a));if(references.has(a)){references.set(b,references.get(a));references.delete(a);}else references.delete(b);files.delete(a);dirtyFiles.add(a);dirtyFiles.add(b);}
function openSync(p,flags){p=clean(p);if(flags==='wx'){if(existsSync(p))throw Error('File exists');writeFileSync(p,Buffer.alloc(0));}else if(!existsSync(p))throw Error('Missing file');const fd=nextHandle++;handles.set(fd,p);return fd;}
export default {existsSync,statSync,lstatSync:statSync,mkdirSync,readFileSync,writeFileSync,readdirSync,unlinkSync,rmdirSync,renameSync,openSync,closeSync:fd=>handles.delete(fd),fsyncSync:()=>{},rmSync:rmdirSync};
