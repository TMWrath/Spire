import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationDecision,samePublication} from '../client/publication-state';
test('recover committed upload with lost reply without false conflict',()=>{const old={seq:1,notes:[{content:'old'}]},saved={seq:2,notes:[{content:'saved'}]};assert.equal(publicationDecision(saved,old,structuredClone(saved)),'acknowledged');});
test('revision-only race with unchanged server contents permits local publish',()=>{assert.equal(publicationDecision({seq:2},{seq:1},{seq:1}),'publish');});
test('real concurrent changes remain protected',()=>{assert.equal(publicationDecision({seq:2,text:'local'},{seq:1,text:'old'},{seq:2,text:'remote'}),'conflict');});
test('unchanged local may pull remote changes',()=>{assert.equal(publicationDecision({seq:1},{seq:1},{seq:2}),'pull');});
test('object key ordering is not a workspace edit',()=>{assert.ok(samePublication({seq:1,notes:[{id:'a',rev:2}]},{notes:[{rev:2,id:'a'}],seq:1}));assert.ok(!samePublication({a:undefined},{b:undefined}));});
