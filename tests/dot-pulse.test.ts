import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderPulseEdges} from '../client/dot-map/renderer.mjs';
test('pulse phase remains stable when camera depth reverses edge drawing order',()=>{const edges=[{source:'a',target:'b'},{source:'b',target:'c'},{source:'c',target:'a'}];const first=orderPulseEdges(edges,e=>edges.indexOf(e)),rotated=orderPulseEdges(edges,e=>-edges.indexOf(e));assert.notDeepEqual(first.map(e=>e.source),rotated.map(e=>e.source));for(const edge of first){const next=rotated.find(e=>e.source===edge.source)!;assert.equal(edge.pulseOffset,next.pulseOffset);assert.equal((1000/5200+edge.pulseOffset)%1,(1000/5200+next.pulseOffset)%1);}assert.ok(Math.abs((6200/5200+first[0].pulseOffset)%1-(1000/5200+first[0].pulseOffset)%1)<1e-12);});
