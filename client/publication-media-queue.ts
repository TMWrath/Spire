export type MediaAttachment={path:string;size:number;remove?:boolean;requires?:string[]};
export type MediaProgress={direction?:'checking'|'upload'|'download'|'delete';phase?:string;loaded?:number;total?:number};
export type MediaTransferState=MediaProgress&{state:'pending'|'transferring'|'ready'|'failed';error?:string;startedAt?:number;finishedAt?:number};
/** Per-workspace queue. New requests coalesce into a follow-up pass, never parallel uploads. */
export class PublicationMediaQueue{
 readonly states=new Map<string,MediaTransferState>();
 private flight:Promise<void>|undefined;
 private pending:MediaAttachment[]|undefined;
 constructor(private transfer:(attachment:MediaAttachment,progress:(update:MediaProgress)=>void)=>Promise<void>,private changed:()=>void=()=>{},private settled:()=>Promise<void>=async()=>{}){}
 whenIdle():Promise<void>{return this.flight??Promise.resolve();}
 sync(attachments:MediaAttachment[]):Promise<void>{
  this.pending=attachments.map(a=>({...a}));
  if(this.flight)return this.flight;
  this.flight=Promise.resolve().then(async()=>{
   try{
    while(this.pending){
     const captured=this.pending;this.pending=undefined;
     const paths=new Set(captured.map(a=>a.path));
     for(const path of this.states.keys())if(!paths.has(path))this.states.delete(path);
     for(const a of captured)this.states.set(a.path,{state:'pending',total:a.size});
     this.changed();
     for(const a of captured){
      this.states.set(a.path,{state:'transferring',startedAt:Date.now(),total:a.size,phase:'Starting'});this.changed();
      try{if(a.remove&&a.requires?.some(path=>this.states.get(path)?.state!=='ready'))throw Error('Replacement attachment not yet saved; original retained');await this.transfer(a,update=>{this.states.set(a.path,{...this.states.get(a.path)!,...update});this.changed();});this.states.set(a.path,{...this.states.get(a.path)!,state:'ready',phase:'Confirmed',finishedAt:Date.now()});}
      catch(error){this.states.set(a.path,{...this.states.get(a.path)!,state:'failed',finishedAt:Date.now(),error:error instanceof Error?error.message:String(error)});}
      this.changed();
     }
     await this.settled();
    }
   }finally{this.flight=undefined;}
  });
  return this.flight;
 }
}
