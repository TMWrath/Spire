export type DeviceStateRequest={op:'get'|'put'|'delete'|'import';key?:string;value?:unknown;entries?:Record<string,unknown>};
export type DeviceStateBridge=(request:DeviceStateRequest)=>Promise<{present?:boolean;value?:unknown}>;
declare global {var spireDeviceState:DeviceStateBridge|undefined;}
export interface CacheStorage{get(store:string,key:IDBValidKey):Promise<any>;put(store:string,value:any,key:IDBValidKey):Promise<any>;delete(store:string,key:IDBValidKey):Promise<any>;getAllKeys(store:string):Promise<IDBValidKey[]>;}
/** Device identity and Server caches may be owned by a future native client. Local files,
 * transfer journals and publication baselines stay in their folder's database.
 * Native tombstones prevent an old folder from resurrecting a signed-out profile.
 */
export function deviceKey(key:IDBValidKey):boolean{
 if(key==='server-profile'||key==='installation-identity')return true;
 if(typeof key!=='string')return false;
 try{const s=JSON.parse(key);return Array.isArray(s)&&s.length===5&&s[0]==='server'&&typeof s[1]==='string'&&new URL(s[1]).protocol==='https:'&&s.slice(2).every(v=>typeof v==='string'&&!!v);}catch{return false;}
}
export async function deviceStorage(legacy:CacheStorage,bridge?:DeviceStateBridge):Promise<CacheStorage>{
 if(!bridge)return legacy;
 const entries:Record<string,unknown>={};
 for(const key of await legacy.getAllKeys('cache'))if(deviceKey(key))entries[String(key)]=await legacy.get('cache',key);
 // Import is additive and atomic. Never delete the old database or replace a
 // native value; migration failure is visible rather than a silent fresh login.
 await bridge({op:'import',entries});
 return {
  async get(store,key){if(!deviceKey(key))return legacy.get(store,key);const result=await bridge({op:'get',key:String(key)});return result.present?result.value:undefined;},
  async put(store,value,key){if(!deviceKey(key))return legacy.put(store,value,key);await bridge({op:'put',key:String(key),value});return key;},
  async delete(store,key){if(!deviceKey(key))return legacy.delete(store,key);await bridge({op:'delete',key:String(key)});},
  getAllKeys:store=>legacy.getAllKeys(store)
 };
}
