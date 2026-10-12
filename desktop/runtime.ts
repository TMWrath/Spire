import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createApp} from '../server/app.ts';
import {atomic,noSymlinks} from '../server/store.ts';
import {lock} from '../server/lock.ts';

export function serverOrigin(input:string){
 const url=new URL(input.trim());
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Enter only the server address, without credentials, paths, or query parameters.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS for a remote server. HTTP is allowed only on this computer.');
 return url.origin;
}
export function workspacePartition(kind:string,identity:string){return 'persist:spire-'+createHash('sha256').update(kind+'\0'+identity).digest('hex');}
export async function startLocalWorkspace(folder:string,staticDirectory:string){
 folder=path.resolve(folder);noSymlinks(folder);
 if(!fs.statSync(folder).isDirectory())throw new Error('Choose a directory');
 const root=path.join(folder,'.spire-desktop');const unlock=lock(root);
 let released=false;const release=()=>{if(!released){released=true;unlock();}};
 let handler:http.RequestListener=(_req,res)=>{res.writeHead(503);res.end('Starting Spire');};
 const server=http.createServer((req,res)=>handler(req,res));
 try{
  const config=path.join(root,'desktop.json');
  const saved=fs.existsSync(config)?JSON.parse(fs.readFileSync(config,'utf8')):null;
  const port=saved?.port??0;
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid saved local port');
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Local listener failed');
  const origin=`http://127.0.0.1:${address.port}`;
  const {app,store}=createApp(root,origin,{contentDirectory:folder,staticDirectory});handler=app;
  atomic(config,JSON.stringify({version:1,port:address.port}));
  let closePromise:Promise<void>|undefined;
  return {origin,store,close:()=>closePromise??=(new Promise<void>((resolve,reject)=>{server.close(error=>{try{release();}catch(e){reject(e);return;}if(error)reject(error);else resolve();});server.closeAllConnections();}))};
 }catch(error){server.close();server.closeAllConnections();release();throw error;}
}
