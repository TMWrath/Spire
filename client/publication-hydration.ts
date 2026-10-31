type PublicationNote={id:string;path:string;rev:number;deleted?:boolean;content:string;contentLoaded?:boolean};
/** Reuse acknowledged unopened bodies. Only changed/new files need a provider read;
 * an unread placeholder is never valid publication content. */
export async function hydratePublicationNotes<T extends PublicationNote>(notes:T[],baseline:T[],open:(id:string)=>Promise<T>):Promise<T[]>{
 const prior=new Map(baseline.map(n=>[n.id,n]));
 const result:T[]=[];
 for(const n of notes){
  if(n.contentLoaded!==false){result.push(n);continue;}
  const old=prior.get(n.id);
  if(old&&old.contentLoaded!==false&&old.rev===n.rev&&old.path===n.path&&old.deleted===n.deleted){result.push(old);continue;}
  const full=await open(n.id);
  if(full.id!==n.id||full.rev!==n.rev||full.path!==n.path||full.deleted!==n.deleted||full.contentLoaded===false||typeof full.content!=='string')throw Error('Local file changed while preparing synchronization; files retained');
  result.push(full);
 }
 return result;
}
