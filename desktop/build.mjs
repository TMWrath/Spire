import {build} from 'esbuild';
import fs from 'node:fs';
await build({entryPoints:['desktop/main.ts'],outfile:'desktop-dist/main.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron']});
for(const name of ['preload.cjs','launcher.html','launcher.css','launcher.js'])fs.copyFileSync('desktop/'+name,'desktop-dist/'+name);
