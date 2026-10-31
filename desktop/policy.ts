export function rendererPreferences(partition:string){return {partition,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true};}
export function allowsNavigation(origin:string,target:string){try{return new URL(target).origin===origin&&['https:','http:'].includes(new URL(target).protocol);}catch{return false;}}
export function allowsPermission(origin:string,requestOrigin:string,permission:string){return permission==='media'&&allowsNavigation(origin,requestOrigin);}
