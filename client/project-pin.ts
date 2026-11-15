export async function persistOptimisticProjectPin<T>(previous:T,next:T,apply:(value:T)=>void,save:()=>Promise<unknown>){
 apply(next);
 try{await save();}
 catch(error){apply(previous);throw error;}
}
