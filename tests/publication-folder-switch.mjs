import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:"import {mounted,localEngine,Engine,ApiError} from './client/sync';import {openDB} from 'idb';import {snapshotHash} from './shared/publication-patch';window.h={mounted,localEngine,Engine,ApiError,openDB,snapshotHash};",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Folder switch</title>'}));await page.goto('http://localhost/');
 await page.evaluate(()=>{globalThis.spireLocalManual=true;globalThis.spireRemoteTransport={request:async()=>{throw Error('unused transport');}};});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(async()=>{
  const {mounted,localEngine:L,Engine,ApiError,openDB,snapshotHash}=window.h;
  const note=(id,content)=>({id,path:'Folder/'+id+'.md',content,rev:1,deleted:false,history:[],templateIds:[],time:'2026-01-01T00:00:00Z'});
  const snapshot=(...notes)=>({seq:1,notes,folders:['Folder'],styles:{},attachments:[],conflicts:[]});
  const remote=new Engine({kind:'server',origin:'https://example.test',account:'a',workspace:'vault'},'remote');remote.cache.identity={owner:'a',username:'a',csrf:'fixture',device:{id:'device',name:'phone'}};
  mounted.remote=remote;mounted.publicationAuthorized=true;
  const db=await openDB('spire-private-v1',1);L.sync=async()=>{};
  let pulls=0;L.save=async()=>{pulls++;throw Error('Must not import the old folder');};
  const old=snapshot(note('old','pending remote writing'));old.localWorkspaceId='https://previous-folder.invalid';
  let server={revision:7,snapshot:old};const archived=[];let fail=false;
  remote.request=async(url,options={})=>{
   if(url.startsWith('/device-workspaces/self/delta'))return {...structuredClone(server),hash:snapshotHash(server.snapshot)};
   if(url==='/device-workspaces/self/snapshot'){
    const body=JSON.parse(options.body);if(fail)throw Error('offline');if(body.base!==server.revision)throw new ApiError(409,'stale');
    archived.push(structuredClone(server));server={revision:server.revision+1,snapshot:body.snapshot};return structuredClone(server);
   }
   throw Error('unexpected '+url);
  };
  L.cache.snapshot=snapshot(note('new','new folder text\n\n'));await mounted.reconcileDeviceWorkspaceLocked();
  const first={paths:server.snapshot.notes.map(n=>n.id),text:server.snapshot.notes[0].content,archived:archived[0]?.snapshot.notes[0].content,pulls,record:await db.get('cache','device-publication:device')};
  // A switching request that fails must not acknowledge the new workspace.
  const acknowledged=structuredClone(first.record);server.snapshot.localWorkspaceId='https://another-folder.invalid';fail=true;
  let rejected=false;try{await mounted.reconcileDeviceWorkspaceLocked();}catch{rejected=true;}
  return {first,rejected,unchanged:JSON.stringify(await db.get('cache','device-publication:device'))===JSON.stringify(acknowledged)};
 });
 assert.deepEqual(result.first.paths,['new']);assert.equal(result.first.text,'new folder text\n\n');assert.equal(result.first.archived,'pending remote writing');assert.equal(result.first.pulls,0);assert.ok(result.first.record);assert.equal(result.rejected,true);assert.equal(result.unchanged,true);
 console.log('PASS real folder switch: active files only, old publication retained, no cross-folder pulls, failed switch unacknowledged');
}finally{await browser.close();}
