import type {MediaAttachment,MediaProgress} from './publication-media-queue';
export type NativeMediaContext={origin:string;workspace:string;device:string;account:string};
type Receipt={state:string;hash?:string;error?:string;direction?:MediaProgress['direction'];phase?:string;total?:number;loaded?:number};
export type BackgroundMedia={enqueue(input:NativeMediaContext&{attachments:(MediaAttachment&{base?:string})[]}):Promise<{tasks:Record<string,string>}>;status(taskId:string):Promise<Receipt>};
declare global {var spireBackgroundMedia:BackgroundMedia|undefined;var spirePublicationDisabled:boolean|undefined;}
export async function prepareNativeMedia(bridge:BackgroundMedia,attachments:MediaAttachment[],context:NativeMediaContext,readBase:(path:string)=>Promise<string|undefined>){
 const tasks=await Promise.all(attachments.filter(a=>!a.remove).map(async a=>({...a,base:await readBase(a.path)})));
 if(!tasks.length)return new Map<string,string>();
 const result=await bridge.enqueue({...context,attachments:tasks});return new Map(Object.entries(result.tasks));
}
export async function waitNativeMedia(bridge:Pick<BackgroundMedia,'status'>,id:string,current:()=>boolean,progress:(update:MediaProgress)=>void){
 for(;;){if(!current())throw Error('Workspace changed; background transfer remains scoped to its original folder');
  const state=await bridge.status(id);if(!current())throw Error('Workspace changed');
  progress({direction:state.direction,phase:state.phase??'Queued for background transfer',total:state.total,loaded:state.loaded});
  if(state.state==='ready'){if(!state.hash||!/^([a-f0-9]{64})$/.test(state.hash))throw Error('Invalid native transfer receipt');return state.hash;}
  if(state.state==='failed'||state.state==='cancelled')throw Error(state.error||'Background transfer failed; retry retained');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
}
