#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const outputPath=path.join(root,'THIRD_PARTY_NOTICES.md');
const check=process.argv.includes('--check');
const evidenceNames=/^(?:licen[cs]e|copying|copyright|notice)(?:[._-].*)?$/i;
const fallbacks=new Map([
 ['cookie-signature',['cookie-signature','Readme.md']],
 ['isarray',['isarray','README.md']],
 ['fsevents',['fsevents','README.md']],
]);

function cleanText(text){return text.replaceAll('\r\n','\n').replaceAll('\r','\n').split('\n').map(line=>line.trimEnd()).join('\n').trim();}
function packageDir(name){return path.join(root,'node_modules',...name.split('/'));}
function readEvidence(name){
 const dir=packageDir(name);
 if(fs.existsSync(dir)){
  const files=fs.readdirSync(dir,{withFileTypes:true})
   .filter(entry=>entry.isFile()&&evidenceNames.test(entry.name))
   .map(entry=>entry.name).sort((a,b)=>a.localeCompare(b));
  if(files.length)return files.map(file=>({file,text:cleanText(fs.readFileSync(path.join(dir,file),'utf8'))}));
 }
 let fallback=fallbacks.get(name);
 if(!fallback&&name.startsWith('@esbuild/'))fallback=['esbuild','LICENSE.md'];
 if(!fallback&&name.startsWith('@napi-rs/canvas-'))fallback=['@napi-rs/canvas','LICENSE'];
 if(fallback){
  const file=path.join(packageDir(fallback[0]),fallback[1]);
  if(fs.existsSync(file))return [{file:`${fallback[0]}/${fallback[1]} (parent-project notice)`,text:cleanText(fs.readFileSync(file,'utf8'))}];
 }
 return [];
}
function repository(name){
 const file=path.join(packageDir(name),'package.json');
 if(!fs.existsSync(file))return '';
 const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
 let repo=pkg.homepage||pkg.repository||'';
 if(repo&&typeof repo==='object')repo=repo.url||'';
 return String(repo).replace(/^git\+/,'').replace(/^git:\/\//,'https://').replace(/\.git(?:#.*)?$/,'');
}
const packages=Object.entries(lock.packages||{})
 .filter(([key,meta])=>key.startsWith('node_modules/')&&meta.dev!==true)
 .map(([key,meta])=>({name:key.slice('node_modules/'.length),version:meta.version||'unknown',license:meta.license||'not declared in package-lock',repository:repository(key.slice('node_modules/'.length)),evidence:readEvidence(key.slice('node_modules/'.length))}))
 .sort((a,b)=>a.name.localeCompare(b.name));

const lines=[
 '# Third-party notices',
 '',
 'This file preserves license and notice material for the resolved third-party npm packages distributed with Spire. It is generated from `package-lock.json` and the installed package contents by `scripts/generate-third-party-notices.mjs`.',
 '',
 `Resolved production packages: **${packages.length}**.`,
 '',
 'Spire itself is licensed separately under the Apache License 2.0. Package names, project names, and trademarks belong to their respective owners.',
 ''
];
for(const pkg of packages){
 lines.push(`## ${pkg.name} ${pkg.version}`,'','Declared license: `'+pkg.license+'`');
 if(pkg.repository)lines.push(`Project: ${pkg.repository}`);
 lines.push('');
 if(!pkg.evidence.length){
  lines.push('The installed package does not include a standalone license or notice file. The declared license identifier above is retained from the lockfile metadata. Consult the linked package source or npm release metadata before redistributing this package independently.','');
  continue;
 }
 for(const item of pkg.evidence){
  lines.push('Source notice file: `'+item.file+'`','','```text',item.text.replaceAll('```','` ` `'),'```','');
 }
}
const output=lines.join('\n').trimEnd()+'\n';
if(check){
 if(!fs.existsSync(outputPath)||fs.readFileSync(outputPath,'utf8')!==output){
  console.error('THIRD_PARTY_NOTICES.md is out of date. Run npm run licenses:generate.');
  process.exit(1);
 }
 console.log(`Verified third-party notices for ${packages.length} production packages.`);
}else{
 fs.writeFileSync(outputPath,output);
 console.log(`Wrote third-party notices for ${packages.length} production packages.`);
}
