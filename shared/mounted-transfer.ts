export type TransferBundle={path:string;version:string;pending:boolean;files:{path:string;bytes:Uint8Array;id?:string;revision?:number}[]};
/** create MUST be atomic create-only, not upsert. read MUST acquire actual linked
 * attachment bytes. removeIfUnchanged MUST atomically check version, full bytes,
 * pending edits and permissions before removal. This interface is not yet wired
 * to SAF, Electron or authenticated server endpoints. No transport guarantee is
 * implied by the domain protocol alone. Interruption may leave a verified copy;
 * retry must not overwrite it. */
export type TransferAdapter={read(path:string):Promise<TransferBundle>;create(bundle:TransferBundle):Promise<{acknowledged:boolean}>;removeIfUnchanged(path:string,expected:TransferBundle):Promise<void>};
function validPath(path:string):boolean{return !!path&&!path.startsWith('/')&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').some(p=>!p||p==='.'||p==='..');}
function validate(bundle:TransferBundle,path:string):void{
 const paths=bundle.files.map(file=>file.path);
 if(bundle.path!==path||!validPath(path)||!bundle.version||paths.some(p=>!validPath(p))||new Set(paths).size!==paths.length||!paths.includes(path)||bundle.files.some(file=>!(file.bytes instanceof Uint8Array)))throw new Error('Invalid transfer bundle');
 if(bundle.pending)throw new Error('Source has pending edits; transfer refused');
}
function sameBytes(a:Uint8Array,b:Uint8Array):boolean{return a.length===b.length&&a.every((byte,i)=>byte===b[i]);}
export async function transferMountedFile(source:TransferAdapter,destination:TransferAdapter,path:string):Promise<void>{
 const bundle=structuredClone(await source.read(path));validate(bundle,path);
 // Pass copies to prevent an adapter mutating the reference used for verification.
 const result=await destination.create(structuredClone(bundle));
 if(result.acknowledged!==true)throw new Error('Destination not acknowledged; source retained');
 const verified=await destination.read(path);
 if(verified.path!==path||verified.pending||verified.files.length!==bundle.files.length||new Set(verified.files.map(file=>file.path)).size!==verified.files.length||bundle.files.some(file=>{
  const actual=verified.files.find(candidate=>candidate.path===file.path);return !actual||!sameBytes(file.bytes,actual.bytes);
 }))throw new Error('Destination byte verification failed; source retained');
 // Source adapter must check the original captured version, not a fresh snapshot.
 await source.removeIfUnchanged(path,structuredClone(bundle));
}
