import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPage,extractVimeoConfig,extractArchiveMetadata,discoverVideo} from '../server/video-extractor.ts';

test('HTML sources include extensionless typed URLs and do not let an embed hide real media',()=>{
 const p=extractPage(`<meta property="og:video" content="/embed/1"><video><source src="/bad.mp4"><source type='video/webm' src='/stream?id=1&amp;v=2'></video>`, 'https://example.com/watch');
 assert.deepEqual(p.candidates.map(c=>c.url),['https://example.com/bad.mp4','https://example.com/stream?id=1&v=2']);
});
test('JSON-LD VideoObject carries attribution and multiple candidates, never executes page code',()=>{
 const p=extractPage(`<script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':'VideoObject',name:'My film',author:{name:'Maker'},contentUrl:'/film',encodingFormat:'video/mp4'}]})}</script><script>throw Error('never run')</script>`,'https://example.com/page');
 assert.equal(p.title,'My film');assert.equal(p.author,'Maker');assert.equal(p.candidates[0].url,'https://example.com/film');
});
test('YouTube adapter reads only exposed progressive formats; restrictions remain explicit',()=>{
 const base='https://www.youtube.com/watch?v=abcdefghijk';
 const page=(data:unknown)=>'var ytInitialPlayerResponse = '+JSON.stringify(data)+';';
 const p=extractPage(page({videoDetails:{title:'Film',author:'Channel'},streamingData:{formats:[{url:'https://example.com/low',mimeType:'video/mp4',height:360},{url:'https://example.com/high',mimeType:'video/mp4',height:720},{url:'https://example.com/drm',mimeType:'video/mp4',drmFamilies:['x']}]}}),base);
 assert.equal(p.candidates.length,2);assert.equal(p.candidates[0].height,720);
 const blocked=extractPage(page({playabilityStatus:{status:'LOGIN_REQUIRED'},streamingData:{formats:[{url:'https://example.com/a.mp4',mimeType:'video/mp4'}]}}),base);
 assert.equal(blocked.candidates.length,0);assert.match(blocked.reason,/restricted/i);
 const cipher=extractPage(page({streamingData:{formats:[{signatureCipher:'s=secret'}],adaptiveFormats:[{url:'https://example.com/video-only.mp4'}]}}),base);
 assert.equal(cipher.candidates.length,0);assert.match(cipher.reason,/signature|separate/i);
});
test('Vimeo public config extracts progressive formats and creator without foreign code',()=>{
 const p=extractVimeoConfig({video:{title:'Film',owner:{name:'Maker'}},request:{files:{progressive:[{url:'https://example.com/a.mp4',mime:'video/mp4',height:720}]}}},'https://player.vimeo.com/video/123/config');
 assert.equal(p.title,'Film');assert.equal(p.author,'Maker');assert.equal(p.candidates.length,1);
});
test('Archive adapter encodes filenames and never offers restricted originals',()=>{
 const data={metadata:{title:'Archive film',creator:['Maker']},files:[{name:'film one.mp4',format:'MPEG4'},{name:'hidden.mp4',private:'true'},{name:'../bad.mp4'}]};
 const p=extractArchiveMetadata(data,'test-film');assert.equal(p.candidates.length,1);assert.equal(p.candidates[0].url,'https://archive.org/download/test-film/film%20one.mp4');
 assert.equal(extractArchiveMetadata({...data,is_dark:true},'test-film').candidates.length,0);
});
test('discovery tries next media when first fails and preserves original page metadata',async()=>{
 const visited:string[]=[];
 const r=await discoverVideo('https://example.com/watch',async url=>{visited.push(url);if(url.endsWith('/watch'))return {url,type:'text/html',text:'<title>Film</title><video><source src="/bad.mp4"><source src="/ok.webm"></video>'};if(url.endsWith('/bad.mp4'))throw Error('missing');return {url,type:'video/webm'};});
 assert.equal(r.media,'https://example.com/ok.webm');assert.equal(r.title,'Film');assert.equal(visited.length,3);
});
test('discovery follows allowlisted public player config, not arbitrary embedded pages',async()=>{
 const visited:string[]=[];const r=await discoverVideo('https://example.com/watch',async url=>{visited.push(url);if(url.includes('example.com/watch'))return {url,type:'text/html',text:'<iframe src="http://localhost/private"></iframe><iframe src="https://player.vimeo.com/video/123"></iframe>'};if(url.endsWith('/config'))return {url,type:'application/json',text:JSON.stringify({video:{title:'Film'},request:{files:{progressive:[{url:'https://example.com/film.mp4',mime:'video/mp4'}]}}})};if(url.endsWith('/123'))return {url,type:'text/html',text:''};return {url,type:'video/mp4'};});
 assert.equal(r.media,'https://example.com/film.mp4');assert.ok(!visited.some(u=>u.includes('localhost')));
});
test('discovery has a strict network budget even with many failing candidates',async()=>{
 let calls=0;const result=await discoverVideo('https://example.com/watch',async url=>{calls++;if(url.endsWith('/watch'))return {url,type:'text/html',text:'<video>'+Array.from({length:100},(_,i)=>`<source src="/${i}.mp4">`).join('')+'</video>'+Array.from({length:100},(_,i)=>`<iframe src="https://player.vimeo.com/video/${i+1}"></iframe>`).join('')};throw Error('unavailable');});
 assert.ok(calls<=12);assert.equal(result.media,'');
});
test('non-video JSON-LD and audio elements never become a movie',()=>{
 const p=extractPage('<audio><source src="/audio.mp4"></audio><script type="application/ld+json">{"@type":"ImageObject","contentUrl":"/not-video.mp4"}</script>','https://example.com');assert.equal(p.candidates.length,0);
});
test('unsupported manifests and bounded discovery return reasons, never fake playback',async()=>{
 const r=await discoverVideo('https://example.com/watch',async url=>({url,type:'application/vnd.apple.mpegurl',text:'#EXTM3U'}));assert.equal(r.media,'');assert.match(r.reason,/segmented/i);
});
