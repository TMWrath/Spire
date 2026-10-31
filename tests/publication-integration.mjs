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
  server.snapshot.folders=['Remote'];
  L.request=async(url,options)=>{if(url!=='/workspace/fields')throw Error('unexpected local '+url);const {expected,changes}=JSON.parse(options.body);for(const field of Object.keys(changes)){const current=L.cache.snapshot[field]??(field==='styles'?{}:[]);if(JSON.stringify(current)!==JSON.stringify(expected[field]))throw Error('stale field');L.cache.snapshot[field]=changes[field];}return {ok:true};};
  const versions=new Map([[1,structuredClone(base)],[2,structuredClone(server.snapshot)]]);let patchReads=0;
  const saves=[];L.save=async incoming=>{saves.push(incoming.id);const current=L.cache.snapshot.notes.find(n=>n.id===incoming.id);if(incoming.id==='D'&&failD)throw Error('provider temporarily unavailable');if((current?.rev??0)!==incoming.rev)throw Error('stale provider write');L.cache.snapshot.notes=L.cache.snapshot.notes.map(n=>n.id===incoming.id?{...incoming,rev:incoming.rev+1}:n);};
  remote.request=async(url,options={})=>{if(url.startsWith('/device-workspaces/self/delta')){const after=Number(new URL(url,'https://test').searchParams.get('after'));if(after===server.revision)return {revision:server.revision,hash:snapshotHash(server.snapshot),unchanged:true};if(after&&versions.has(after)){patchReads++;return {revision:server.revision,hash:snapshotHash(server.snapshot),patch:makePublicationPatch(versions.get(after),server.snapshot)};}return {...structuredClone(server),hash:snapshotHash(server.snapshot)};}if(url==='/device-workspaces/self/patch'){const body=JSON.parse(options.body);if(body.base!==server.revision)throw new ApiError(409,'stale workspace');puts++;server={revision:server.revision+1,snapshot:applyPublicationPatch(server.snapshot,body.patch)};versions.set(server.revision,structuredClone(server.snapshot));if(loseReply){loseReply=false;throw Error('reply lost');}return {revision:server.revision,hash:snapshotHash(server.snapshot)};}throw Error('unexpected '+url);};
  L.cache.snapshot.attachments=[{path:'Attachments/missing.jpg',size:42}];
  let localMediaRefreshes=0;L.listeners.add(()=>localMediaRefreshes++);
  L.raw=async()=>new Response(null,{status:404});
  await mounted.reconcileDeviceWorkspaceLocked();
  await remote.publicationMedia?.whenIdle();
  if(!remote.publicationMedia?.states.has('Attachments/missing.jpg'))throw Error('Missing visible media state');
  if(remote.publicationMedia.states.get('Attachments/missing.jpg').state!=='failed')throw Error('Missing media not retryable');
  if(!localMediaRefreshes)throw Error('Opened Local editor was not notified of media status');
  const first=await db.get('cache',key);
  if(JSON.stringify(L.cache.snapshot.folders)!==JSON.stringify(['Remote']))throw Error('Remote folders were not applied');
  if(JSON.stringify(first.snapshot.folders)!==JSON.stringify(['Remote']))throw Error('Folder pull not acknowledged');
  const firstResult={remoteA:server.snapshot.notes[0].content,remoteB:server.snapshot.notes[1].content,localB:L.cache.snapshot.notes[1].content,localC:L.cache.snapshot.notes[2].content,baseB:first.snapshot.notes[1].content,baseD:first.snapshot.notes[3].content,status:remote.status};
  failD=false;await mounted.reconcileDeviceWorkspaceLocked();const retry=await db.get('cache',key);const retryPuts=puts;
  L.cache.snapshot.notes[0].content='newer phone';L.cache.snapshot.notes[0].rev++;loseReply=true;let lost=false;try{await mounted.reconcileDeviceWorkspaceLocked();}catch{lost=true;}
  await mounted.reconcileDeviceWorkspaceLocked();const recovered=await db.get('cache',key);
  const completedPuts=puts;const review=mounted.publicationReviews.find(r=>r.id==='B');if(!review)throw Error('Missing visible publication conflict');
  L.cache.snapshot.notes[1].content='newer unsynced';let rejected=false;try{await mounted.resolvePublication(review,'resolved');}catch{rejected=true;}L.cache.snapshot.notes[1].content='phone';
  await mounted.resolvePublication(review,'phone\nserver');const resolved=server.snapshot.notes.find(n=>n.id==='B').content;
  let release;const stalledRead=new Promise(resolve=>{release=()=>resolve(new Response(null,{status:404}));});L.raw=()=>stalledRead;
  L.cache.snapshot.attachments=[{path:'Attachments/stalled.jpg',size:42}];
  const sync=mounted.reconcileDeviceWorkspaceLocked();
  const completed=await Promise.race([sync.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),300))]);
  if(!completed){release?.();await sync;throw Error('Stalled media blocked text sync lock');}
  L.cache.snapshot.notes[0].content='text while media stalled';L.cache.snapshot.notes[0].rev++;
  await mounted.reconcileDeviceWorkspaceLocked();
  if(server.snapshot.notes[0].content!=='text while media stalled')throw Error('Later text did not publish during media transfer');
  release?.();await remote.publicationMedia.whenIdle();
  const metadata=mounted.reconcileDeviceMetadataLocked;mounted.reconcileDeviceMetadataLocked=async()=>undefined;
  let unapprovedReads=0;L.raw=async()=>{unapprovedReads++;return new Response(null,{status:404});};
  await mounted.reconcileDeviceWorkspaceLocked();await remote.publicationMedia.whenIdle();
  mounted.reconcileDeviceMetadataLocked=metadata;
  if(unapprovedReads)throw Error('Unconfirmed publication still transferred binary media');
  let releaseDetached,enteredDetached;const detachedStarted=new Promise(resolve=>enteredDetached=resolve);const detachedRead=new Promise(resolve=>releaseDetached=resolve);
  L.raw=async()=>{enteredDetached();await detachedRead;return new Response(new Uint8Array(42));};
  const originalRaw=remote.raw;let detachedUploads=0;
  remote.raw=async(_url,options={})=>{if(options.method==='PUT')detachedUploads++;return new Response(null,{status:options.method==='HEAD'?404:200});};
  await mounted.reconcileDeviceWorkspaceLocked();await detachedStarted;
  mounted.remote=undefined;releaseDetached();await remote.publicationMedia.whenIdle();mounted.remote=remote;remote.raw=originalRaw;
  if(detachedUploads)throw Error('Detached mount uploaded stale media after its source read completed');
  // Real mounted binary consumer: provider CAS + persisted common bases.
  const localBytes=new Map(),remoteBytes=new Map(),binaryPath='Attachments/from-server.bin';let binaryUploads=0,binaryDownloads=0;
  const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  L.raw=async(url,options={})=>{const q=new URL(url,'https://local').searchParams,p=q.get('path'),value=localBytes.get(p),current=value===undefined?'missing':await digest(value);
   if(options.method==='PUT'||options.method==='DELETE'){
    if(q.get('expected')!==current)return new Response(null,{status:409});
    if(options.method==='DELETE'){localBytes.delete(p);L.cache.snapshot.attachments=L.cache.snapshot.attachments.filter(a=>a.path!==p);return Response.json({hash:'missing'});}
    const next=await options.body.text();localBytes.set(p,next);L.cache.snapshot.attachments=[...L.cache.snapshot.attachments.filter(a=>a.path!==p),{path:p,size:next.length}];return Response.json({hash:await digest(next)});
   }return value===undefined?new Response(null,{status:404}):new Response(value);
  };
  remote.raw=async(url,options={})=>{const q=new URL(url,'https://remote').searchParams,p=q.get('path'),value=remoteBytes.get(p),hash=value===undefined?'missing':await digest(value);
   if(url.includes('attachment-info'))return Response.json({hash,size:value?.length??0,deleted:!server.snapshot.attachments.some(a=>a.path===p)});
   if(options.method==='PUT'){if(q.get('base')!==hash)return new Response(null,{status:409});const next=await options.body.text();binaryUploads++;remoteBytes.set(p,next);return Response.json({hash:await digest(next),size:next.length});}
   binaryDownloads++;return value===undefined?new Response(null,{status:404}):new Response(value);
  };
  const syncMedia=async()=>{await mounted.reconcileDeviceWorkspaceLocked();await remote.publicationMedia.whenIdle();};
  const editRemoteMetadata=attachments=>{server={revision:server.revision+1,snapshot:{...server.snapshot,attachments}};versions.set(server.revision,structuredClone(server.snapshot));};
  remoteBytes.set(binaryPath,'one');editRemoteMetadata([...server.snapshot.attachments,{path:binaryPath,size:3}]);
  await syncMedia();if(localBytes.get(binaryPath)!=='one')throw Error('Production queue omitted remote-only attachment: '+JSON.stringify([...remote.publicationMedia.states]));
  await syncMedia();if(binaryDownloads!==1||binaryUploads!==0)throw Error('Repeated sync transferred unchanged bytes');
  localBytes.set(binaryPath,'two');await syncMedia();if(remoteBytes.get(binaryPath)!=='two'||binaryUploads!==1)throw Error('Equal-size Local edit did not upload');
  remoteBytes.set(binaryPath,'six');await syncMedia();if(localBytes.get(binaryPath)!=='six'||binaryDownloads!==2)throw Error('Equal-size Server edit did not download');
  localBytes.set(binaryPath,'abc');remoteBytes.set(binaryPath,'xyz');await syncMedia();if(localBytes.get(binaryPath)!=='abc'||remoteBytes.get(binaryPath)!=='xyz'||remote.publicationMedia.states.get(binaryPath)?.state!=='failed')throw Error('Binary conflict lost a version');
  localBytes.set(binaryPath,'six');remoteBytes.set(binaryPath,'six');await syncMedia();
  editRemoteMetadata(server.snapshot.attachments.filter(a=>a.path!==binaryPath));await syncMedia();
  if(localBytes.has(binaryPath)||L.cache.snapshot.attachments.some(a=>a.path===binaryPath))throw Error('Intentional Server attachment deletion did not persist locally');
  editRemoteMetadata([...server.snapshot.attachments,{path:binaryPath,size:3}]);await syncMedia();
  if(localBytes.get(binaryPath)!=='six')throw Error('Attachment did not restore after tombstone');
  const moved='Attachments/Moved/renamed.bin';editRemoteMetadata(server.snapshot.attachments.map(a=>a.path===binaryPath?{path:moved,size:3}:a));
  await syncMedia();if(localBytes.get(binaryPath)!=='six')throw Error('Rename deleted source before replacement bytes were confirmed');
  remoteBytes.set(moved,'six');await syncMedia();if(localBytes.has(binaryPath)||localBytes.get(moved)!=='six')throw Error('Rename retry did not finish both sides');
  const transfersBeforeRestart=binaryUploads+binaryDownloads;remote.publicationMedia=undefined;await syncMedia();if(binaryUploads+binaryDownloads!==transfersBeforeRestart)throw Error('Reconstructed queue ignored persisted binary base');
  localBytes.set(moved,'new');editRemoteMetadata(server.snapshot.attachments.filter(a=>a.path!==moved));await syncMedia();
  if(localBytes.get(moved)!=='new'||remote.publicationMedia.states.get(moved)?.state!=='failed')throw Error('Server deletion erased concurrent Local bytes');

  return {patchReads,rejected,resolved,firstResult,retryD:retry.snapshot.notes[3].content,retryPuts,lost,puts:completedPuts,baseA:recovered.snapshot.notes[0].content,baseB:recovered.snapshot.notes[1].content,saves};
 });
 assert.ok(result.patchReads>0);assert.equal(result.rejected,true);assert.equal(result.resolved,'phone\nserver');assert.equal(result.firstResult.remoteA,'phone\n\n');assert.equal(result.firstResult.remoteB,'server');assert.equal(result.firstResult.localB,'phone');assert.equal(result.firstResult.localC,'server\n\n');assert.equal(result.firstResult.baseB,'old');assert.equal(result.firstResult.baseD,'old');assert.match(result.firstResult.status,/B.md/);assert.equal(result.retryD,'server');assert.equal(result.retryPuts,1);assert.equal(result.lost,true);assert.equal(result.puts,2);assert.equal(result.baseA,'newer phone');assert.equal(result.baseB,'old');assert.equal(result.saves.filter(id=>id==='B').length,1);
 console.log('PASS real reconcile integration: independent bidirectional files, exact blank lines, conflict preservation, failed provider retry, idempotency, lost reply recovery');
}finally{await browser.close();}
