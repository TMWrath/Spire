import test from 'node:test';
import assert from 'node:assert/strict';
import * as memory from './local/fs.js';

const b64=value=>Buffer.from(value).toString('base64');

test('memory snapshot reuses acknowledged entries and serializes only dirty paths',()=>{
 const acknowledged={
  files:{
   'Writing/keep.md':b64('keep'),
   'Writing/change.md':b64('old'),
   'Writing/remove.md':b64('remove')
  },
  dirs:['Writing']
 };
 memory.load(acknowledged,{});

 // A trusted acknowledged value can be reused without rereading/re-encoding its
 // unchanged in-memory buffer. The deliberately distinct marker makes that visible.
 const reusable={...acknowledged,files:{...acknowledged.files,'Writing/keep.md':'ACKNOWLEDGED-MARKER'}};
 memory.default.writeFileSync('/workspace/Writing/change.md',Buffer.from('new'));
 memory.default.unlinkSync('/workspace/Writing/remove.md');
 const snapshot=memory.dump(reusable);

 assert.equal(snapshot.files['Writing/keep.md'],'ACKNOWLEDGED-MARKER');
 assert.equal(snapshot.files['Writing/change.md'],b64('new'));
 assert.equal(Object.hasOwn(snapshot.files,'Writing/remove.md'),false);
 assert.deepEqual(snapshot.dirs,['Writing']);
});

test('acknowledging a snapshot clears dirty tracking for the next operation',()=>{
 const initial={files:{'Writing/a.md':b64('one')},dirs:['Writing']};
 memory.load(initial,{});
 memory.default.writeFileSync('/workspace/Writing/a.md',Buffer.from('two'));
 const saved=memory.dump(initial);
 memory.acknowledge(saved);
 const reusable={...saved,files:{...saved.files,'Writing/a.md':'ACKNOWLEDGED-SECOND'}};
 assert.equal(memory.dump(reusable).files['Writing/a.md'],'ACKNOWLEDGED-SECOND');
});
