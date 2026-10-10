import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicIPv4,videoURL,parseVideoPage} from '../server/video.ts';
import {videoTime,videoCaptureMarkdown} from '../shared/video.ts';
import {sourceInputSchema} from '../shared/sources.ts';
test('video fetch boundary rejects private and special networks and unsafe URLs',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','192.168.1.1','169.254.169.254','100.64.1.2','172.31.9.1','0.0.0.0','224.0.0.1','198.18.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('8.8.8.8'),true);
 for(const url of ['file:///etc/passwd','https://user:pass@example.com/v','http://localhost/video','https://example.com:444/v'])assert.throws(()=>videoURL(url));
});
test('own video-page parser reads metadata and unprotected media, never executable cipher code',()=>{
 const page='<meta property="og:title" content="A &amp; B"><meta name="author" content="Creator"><meta property="og:video" content="https://cdn.example.com/a.mp4">';
 assert.deepEqual(parseVideoPage(page,'https://example.com/watch'),{title:'A & B',author:'Creator',media:'https://cdn.example.com/a.mp4'});
 const yt='var ytInitialPlayerResponse = '+JSON.stringify({videoDetails:{title:'Film',author:'Channel'},streamingData:{formats:[{url:'https://media.example.com/film.mp4',mimeType:'video/mp4',height:720}]}})+';';
 assert.deepEqual(parseVideoPage(yt,'https://www.youtube.com/watch?v=abcdef12345'),{title:'Film',author:'Channel',media:'https://media.example.com/film.mp4'});
 const encrypted='var ytInitialPlayerResponse = '+JSON.stringify({videoDetails:{title:'Protected',author:'Channel'},streamingData:{formats:[{signatureCipher:'secret'}]}})+';';
 assert.equal(parseVideoPage(encrypted,'https://www.youtube.com/watch?v=abcdef12345').media,'');
});
test('captures export ordinary Markdown and exact timestamp attribution',()=>{
 assert.equal(videoTime(65.125),'00:01:05.125');
 const source={...sourceInputSchema.parse({kind:'video',title:'A [film]',author:'Creator',url:'https://example.com/watch'}),id:'00000000-0000-4000-8000-000000000001',revision:1,created:new Date(0).toISOString()};
 const md=videoCaptureMarkdown(source,'Writing/Deep/file.md','Attachments/frame.jpg',65.125);
 assert.match(md,/!\[.*\]\(\.\.\/\.\.\/Attachments\/frame.jpg\)/);
 assert.match(md,/Creator, A \\\[film\\\], 00:01:05.125/);
 assert.match(md,/Sources\/00000000/);assert.match(md,/Original video/);
});
