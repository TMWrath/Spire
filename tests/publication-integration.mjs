import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:"import {mounted,localEngine,Engine,ApiError} from './client/sync';import {openDB} from 'idb';import {applyPublicationPatch,makePublicationPatch,snapshotHash} from './shared/publication-patch';window.syncHarness={mounted,localEngine,Engine,ApiError,openDB,applyPublicationPatch,makePublicationPatch,snapshotHash};",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolation acceptance</title>'}));await page.goto('http://localhost/');await page.evaluate(()=>{globalThis.spireLocalManual=true;globalThis.spireRemoteTransport={request:async()=>{throw Error("unused native transport");}};});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(async()=>{
  const {mounted,localEngine:L,Engine,ApiError,openDB,applyPublicationPatch,makePublicationPatch,snapshotHash}=window.syncHarness;
  const note=(id,content,rev=1)=>({id,path:id+'.md',content,rev,deleted:false,history:[],templateIds:[],time:'2026-01-01T00:00:00Z'});
  const snapshot=(...notes)=>({seq:1,notes,folders:[],styles:{},attachments:[],conflicts:[]});
  const base=snapshot(note('A','old'),note('B','old'),note('C','old'),note('D','old'));
  const db=await openDB('spire-private-v1',1);const remote=new Engine({kind:'server',origin:'https://example.test'},'remote');remote.cache.identity={owner:'test',username:'test',csrf:'test',device:{id:'device',name:'test'}};
  mounted.remote=remote;mounted.publicationAuthorized=true;
  const key='device-publication:device';await db.put('cache',{revision:1,snapshot:base},key);
  L.cache.snapshot=snapshot(note('A','phone\n\n',4),note('B','phone',3),note('C','old'),note('D','old'));L.sync=async()=>{};
  let server={revision:2,snapshot:snapshot(note('A','old'),note('B','server',2),note('C','server\n\n',2),note('D','server',2))};let failD=true,puts=0,loseReply=false;
  const versions=new Map([[1,structuredClone(base)],[2,structuredClone(server.snapshot)]]);let patchReads=0;
  const saves=[];L.save=async incoming=>{saves.push(incoming.id);const current=L.cache.snapshot.notes.find(n=>n.id===incoming.id);if(incoming.id==='D'&&failD)throw Error('provider temporarily unavailable');if((current?.rev??0)!==incoming.rev)throw Error('stale provider write');L.cache.snapshot.notes=L.cache.snapshot.notes.map(n=>n.id===incoming.id?{...incoming,rev:incoming.rev+1}:n);};
  remote.request=async(url,options={})=>{if(url.startsWith('/device-workspaces/self/delta')){const after=Number(new URL(url,'https://test').searchParams.get('after'));if(after===server.revision)return {revision:server.revision,hash:snapshotHash(server.snapshot),unchanged:true};if(after&&versions.has(after)){patchReads++;return {revision:server.revision,hash:snapshotHash(server.snapshot),patch:makePublicationPatch(versions.get(after),server.snapshot)};}return {...structuredClone(server),hash:snapshotHash(server.snapshot)};}if(url==='/device-workspaces/self/patch'){const body=JSON.parse(options.body);if(body.base!==server.revision)throw new ApiError(409,'stale workspace');puts++;server={revision:server.revision+1,snapshot:applyPublicationPatch(server.snapshot,body.patch)};versions.set(server.revision,structuredClone(server.snapshot));if(loseReply){loseReply=false;throw Error('reply lost');}return {revision:server.revision,hash:snapshotHash(server.snapshot)};}throw Error('unexpected '+url);};
  await mounted.reconcileDeviceWorkspaceLocked();const first=await db.get('cache',key);
  const firstResult={remoteA:server.snapshot.notes[0].content,remoteB:server.snapshot.notes[1].content,localB:L.cache.snapshot.notes[1].content,localC:L.cache.snapshot.notes[2].content,baseB:first.snapshot.notes[1].content,baseD:first.snapshot.notes[3].content,status:remote.status};
  failD=false;await mounted.reconcileDeviceWorkspaceLocked();const retry=await db.get('cache',key);const retryPuts=puts;
  L.cache.snapshot.notes[0].content='newer phone';L.cache.snapshot.notes[0].rev++;loseReply=true;let lost=false;try{await mounted.reconcileDeviceWorkspaceLocked();}catch{lost=true;}
  await mounted.reconcileDeviceWorkspaceLocked();const recovered=await db.get('cache',key);
  const completedPuts=puts;const review=mounted.publicationReviews.find(r=>r.id==='B');if(!review)throw Error('Missing visible publication conflict');
  L.cache.snapshot.notes[1].content='newer unsynced';let rejected=false;try{await mounted.resolvePublication(review,'resolved');}catch{rejected=true;}L.cache.snapshot.notes[1].content='phone';
  await mounted.resolvePublication(review,'phone\nserver');const resolved=server.snapshot.notes.find(n=>n.id==='B').content;
  return {patchReads,rejected,resolved,firstResult,retryD:retry.snapshot.notes[3].content,retryPuts,lost,puts:completedPuts,baseA:recovered.snapshot.notes[0].content,baseB:recovered.snapshot.notes[1].content,saves};
 });
 assert.ok(result.patchReads>0);assert.equal(result.rejected,true);assert.equal(result.resolved,'phone\nserver');assert.equal(result.firstResult.remoteA,'phone\n\n');assert.equal(result.firstResult.remoteB,'server');assert.equal(result.firstResult.localB,'phone');assert.equal(result.firstResult.localC,'server\n\n');assert.equal(result.firstResult.baseB,'old');assert.equal(result.firstResult.baseD,'old');assert.match(result.firstResult.status,/B.md/);assert.equal(result.retryD,'server');assert.equal(result.retryPuts,1);assert.equal(result.lost,true);assert.equal(result.puts,2);assert.equal(result.baseA,'newer phone');assert.equal(result.baseB,'old');assert.equal(result.saves.filter(id=>id==='B').length,1);
 console.log('PASS real reconcile integration: independent bidirectional files, exact blank lines, conflict preservation, failed provider retry, idempotency, lost reply recovery');
}finally{await browser.close();}
