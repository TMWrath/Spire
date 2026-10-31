import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.ts';import {Store} from '../server/store.ts';import {exportVault,unpack} from '../server/archive.ts';import {videoCaptureMarkdown} from '../shared/video.ts';
test('video capture auth, CSRF, atomic save, replay, reuse, portability and SSRF boundaries',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spire-video-api-'));const origin='http://127.0.0.1:4195';const {app,store}=createApp(root,origin),server=app.listen(4195,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let cookie='',csrf='';
 const request=(p:string,body?:any,headers:Record<string,string>={})=>fetch(origin+'/api'+p,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf,...(body?{'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json'}:{}),...headers},body:Buffer.isBuffer(body)?new Uint8Array(body):body?JSON.stringify(body):undefined});
 const source={kind:'video',title:'Local film',author:'Author',description:'Local file: own-film.webm',url:''};const id=randomUUID(),route='/video/capture?id='+id+'&extension=jpg&source='+encodeURIComponent(JSON.stringify(source)),bytes=Buffer.from([255,216,255,10,11,12]);
 try{
  assert.equal((await request('/video/resolve',{url:'https://example.com/video.mp4'})).status,401);assert.equal((await request('/video/stream/nope')).status,401);assert.equal((await request(route,bytes)).status,401);
  const setup=await request('/setup',{username:'owner',password:'disposable-video-password',reliquary:'Video test',device:'Video test browser'});cookie=setup.headers.get('set-cookie')!.split(';')[0];csrf=(await setup.json()).csrf;
  assert.equal((await request(route,bytes,{'X-CSRF-Token':'wrong'})).status,403);
  const before=store.state.seq;assert.equal((await request(route,Buffer.from('not an image'))).status,400);assert.equal(store.state.seq,before);
  const result=await request(route,bytes);assert.equal(result.status,200);const saved=await result.json();assert.equal(store.state.sources?.length,1);assert.equal(store.state.attachments.length,1);const seq=store.state.seq;
  assert.equal((await request(route,bytes)).status,200);assert.equal(store.state.seq,seq);assert.equal((await request(route,Buffer.from([255,216,255,99]))).status,409);assert.equal(store.state.seq,seq);
  assert.equal((await request(route.replace(id,randomUUID()),bytes)).status,200);assert.equal(store.state.sources?.length,1);assert.equal(store.state.attachments.length,2);
  for(const url of ['http://127.0.0.1/internal','http://2130706433/internal','http://[::1]/','http://169.254.169.254/latest','file:///etc/passwd'])assert.equal((await request('/video/resolve',{url})).status,400,url);
  const media=await request('/attachment?path='+encodeURIComponent(saved.path));assert.equal(media.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes);
  const content='Before'+videoCaptureMarkdown(saved.source,'Writing/Video.md',saved.path,1.25)+'After';store.mutate({op:randomUUID(),id:randomUUID(),base:0,path:'Writing/Video.md',content,deleted:false},'test');
  const restoredRoot=fs.mkdtempSync(path.join(os.tmpdir(),'spire-video-import-'));try{const restored=new Store(restoredRoot);restored.importFiles(unpack(Buffer.from(exportVault(store))),'test');assert.equal(restored.state.sources?.[0].title,source.title);assert.equal(Object.values(restored.state.notes)[0].content,content);assert.deepEqual(Buffer.from(restored.state.attachments[0].data,'base64'),bytes);restored.verify();}finally{fs.rmSync(restoredRoot,{recursive:true,force:true});}
  new Store(root).verify();
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(root,{recursive:true,force:true});}
});
