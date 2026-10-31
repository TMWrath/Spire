import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
// Always consume the shared frontend/store from this repository by default.
const source=process.env.SPIRE_SOURCE??path.resolve(root,'..');
if(source){
 for(const dir of ['shared','server']){fs.mkdirSync('vendor/'+dir,{recursive:true});if(dir==='shared')fs.cpSync(path.join(source,dir),'vendor/'+dir,{recursive:true});else for(const name of ['store.ts','archive.ts','transfer.ts'])fs.copyFileSync(path.join(source,dir,name),'vendor/'+dir+'/'+name);}
 fs.rmSync('app/src/main/assets/web',{recursive:true,force:true});fs.cpSync(process.env.SPIRE_DIST??path.join(source,'dist'),'app/src/main/assets/web',{recursive:true});
 const index=fs.readFileSync('app/src/main/assets/web/index.html','utf8');fs.writeFileSync('vendor/index.html',index);
 const manifest={source:'Spire canonical shared frontend and store',files:{}};
 for(const dir of ['vendor','app/src/main/assets/web'])for(const f of fs.readdirSync(dir,{recursive:true})){const p=path.join(dir,f);if(fs.statSync(p).isFile())manifest.files[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
 fs.writeFileSync('vendor/provenance.json',JSON.stringify(manifest,null,2)+'\n');
}
const plugin={name:'mobile-core',setup(b){
 b.onResolve({filter:/^node:fs$/},()=>({path:path.join(root,'local/fs.js')}));
 b.onResolve({filter:/^node:path$/},()=>({path:path.join(root,'node_modules/path-browserify/index.js')}));
 b.onResolve({filter:/^node:crypto$/},()=>({path:'crypto',namespace:'mobile'}));
 b.onLoad({filter:/.*/,namespace:'mobile'},()=>({contents:'export const randomUUID=()=>globalThis.crypto.randomUUID();',loader:'js'}));
}};
const common={bundle:true,platform:'browser',target:'es2022',plugins:[plugin],inject:['local/globals.js'],define:{'process.platform':'"win32"'}};
await build({...common,entryPoints:['local/runtime.ts'],outfile:'local/runtime.mjs',format:'esm'});
await build({...common,entryPoints:['local/bootstrap.js'],outfile:'app/src/main/assets/web/local.js',format:'iife'});
const index=fs.readFileSync('vendor/index.html','utf8');const entry=/\s*<script type="module" crossorigin src="([^"]+)"><\/script>/.exec(index);if(!entry)throw Error('Missing canonical editor entry');
const entryPath=path.join('app/src/main/assets/web',entry[1].replace(/^\//,''));
if(!fs.existsSync(entryPath))throw Error(`Canonical editor entry is absent from Android assets: ${entry[1]}`);
fs.writeFileSync('app/src/main/assets/web/index.html',index.replace(entry[0],`<script defer src="/local.js" data-entry="${entry[1]}"></script>`));
console.log('Bundled canonical editor + local storage runtime');
