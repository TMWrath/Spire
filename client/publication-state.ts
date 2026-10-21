// Compare JSON data independently of object-property insertion order.
export function samePublication(a:unknown,b:unknown):boolean{
 if(Object.is(a,b))return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>samePublication(v,b[i]));
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x).sort();
 return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&samePublication(x[k],y[k]));
}
export function publicationDecision(local:unknown,baseline:unknown,server:unknown):'acknowledged'|'publish'|'pull'|'conflict'{
 if(samePublication(local,server))return 'acknowledged';
 if(samePublication(server,baseline))return 'publish';
 if(samePublication(local,baseline))return 'pull';
 return 'conflict';
}
