#!/usr/bin/env node
/** Pinned, checksum-verified speech assets. No audio ever leaves the client. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(await fs.readFile(path.join(root,'documents/voice-assets.lock.json'),'utf8'));
const verifyOnly=process.argv.includes('--verify-only');
const sha=data=>createHash('sha256').update(data).digest('hex');
for(const entry of lock.files){
 if(entry.path.startsWith('/')||entry.path.split('/').some(p=>p==='..'||!p))throw Error('Unsafe asset path');
 const target=path.join(root,'public/voice',entry.path);let data;
 try{data=await fs.readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!data){
  if(verifyOnly)throw Error('Missing speech asset '+entry.path+'. Run npm run prepare:voice first.');
  if(entry.source)data=await fs.readFile(path.join(root,entry.source));
  else{let last;for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(entry.url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Asset download returned '+response.status);data=Buffer.from(await response.arrayBuffer());break;}catch(e){last=e;}}if(!data)throw last;}
 }
 if(data.length!==entry.bytes||sha(data)!==entry.sha256)throw Error('Speech asset checksum mismatch: '+entry.path+' (not replaced or accepted)');
 if(!verifyOnly){await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target+'.partial',data);await fs.rename(target+'.partial',target);}
}
if(!verifyOnly)await fs.writeFile(path.join(root,'public/voice/manifest.json'),JSON.stringify(lock,null,2)+'\n');
console.log(`Verified ${lock.files.length} pinned speech assets, runtime files and licenses.`);
