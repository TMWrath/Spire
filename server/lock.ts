import fs from 'node:fs';
import path from 'node:path';
import { noSymlinks } from './store.ts';
export function lock(root:string){noSymlinks(root);fs.mkdirSync(root,{recursive:true,mode:0o700});const p=path.join(root,'process.lock');noSymlinks(p);try{fs.writeFileSync(p,String(process.pid),{flag:'wx',mode:0o600});}catch{throw new Error('Data directory locked. Stop the server before maintenance; remove process.lock only after verifying no writer is running.');}return()=>fs.unlinkSync(p);}
