import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveMediaSource} from '../client/file-media';
import {setAttachmentResolver} from '../client/attachment-urls';
test('media references share the current storage attachment resolver',()=>{
 setAttachmentResolver(path=>'native-media://'+encodeURIComponent(path));
 try{
  for(const src of ['../Attachments/a%20b.mp3','Attachments/a b.mp3','a b.mp3','/api/attachment?path=Attachments%2Fa%20b.mp3'])assert.deepEqual(resolveMediaSource('Writing/A.md',src,['Attachments/a b.mp3']),{url:'native-media://Attachments%2Fa%20b.mp3',name:'a b.mp3',missing:false});
 }finally{setAttachmentResolver(path=>'/api/attachment?path='+encodeURIComponent(path));}
});
test('media preserves external URLs and identifies unavailable local references',()=>{
 assert.deepEqual(resolveMediaSource('Writing/A.md','https://example.com/a%20b.png?v=1',[]),{url:'https://example.com/a%20b.png?v=1',name:'a b.png',missing:false});
 assert.deepEqual(resolveMediaSource('Writing/A.md','../Attachments/missing.mp4',[]),{url:'/api/attachment?path=Attachments%2Fmissing.mp4',name:'missing.mp4',missing:true});
});
test('media rejects executable, filesystem and protocol-relative source URLs',()=>{
 for(const src of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','file:///etc/passwd','//remote.example/a.png','/etc/passwd','%ZZ','../../../outside.mp3',''])assert.equal(resolveMediaSource('Writing/A.md',src,[]),null,src);
});
