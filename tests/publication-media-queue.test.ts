import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicationMediaQueue} from '../client/publication-media-queue';

test('media queue isolates failed files and retries without duplicating concurrent transfers',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);const calls:string[]=[];
 let fail=true;
 const queue=new PublicationMediaQueue(async a=>{calls.push(a.path);if(a.path==='bad'&&fail)throw Error('Unavailable');if(a.path==='good')await gate;});
 const files=[{path:'bad',size:1},{path:'good',size:1}];
 const first=queue.sync(files);const second=queue.sync(files);
 release();await Promise.all([first,second]);
 assert.deepEqual(calls,['bad','good']);
 assert.equal(queue.states.get('bad')?.state,'failed');
 assert.equal(queue.states.get('good')?.state,'ready');
 fail=false;await queue.sync(files);
 assert.equal(queue.states.get('bad')?.state,'ready');
 // Ready files are rechecked: same size does not prove unchanged content.
 assert.deepEqual(calls,['bad','good','bad','good']);
});
test('one missing attachment does not reject the queue or skip later files',async()=>{
 const queue=new PublicationMediaQueue(async a=>{if(a.path==='missing')throw Error('missing bytes');});
 await queue.sync([{path:'missing',size:1},{path:'later',size:2}]);
 assert.equal(queue.states.get('later')?.state,'ready');
 assert.equal(queue.states.get('missing')?.error,'missing bytes');
});

test('requests during a transfer drain the latest snapshot without dropping added or changed bytes',async()=>{
 let release!:()=>void,started!:()=>void;const entered=new Promise<void>(resolve=>started=resolve);const gate=new Promise<void>(resolve=>release=resolve);const seen:string[]=[];let bytes='old';
 const queue=new PublicationMediaQueue(async a=>{seen.push(a.path+':'+bytes);if(seen.length===1){started();await gate;}});
 const first=queue.sync([{path:'A.jpg',size:3}]);
 await entered;bytes='new';const second=queue.sync([{path:'A.jpg',size:3},{path:'B.jpg',size:3}]);
 assert.equal(first,second);release();await second;
 assert.deepEqual(seen,['A.jpg:old','A.jpg:new','B.jpg:new']);
 assert.equal(queue.states.get('B.jpg')?.state,'ready');
});
