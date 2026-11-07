import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeWave,resampleMono,joinSamples,sanitizeVoiceSamples} from '../client/voice-audio';
test('PCM exports portable mono 16 kHz WAV with clipped signed samples',async()=>{
 const blob=encodeWave(new Float32Array([-2,0,2]));const bytes=await blob.arrayBuffer(),view=new DataView(bytes);
 assert.equal(blob.type,'audio/wav');assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(view.getUint32(24,true),16000);assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(48,true),32767);
});
test('downsampling preserves duration and constant amplitude',()=>{
 const mono=resampleMono(new Float32Array(48000).fill(.5),48000);assert.equal(mono.length,16000);assert.ok(mono.every(x=>Math.abs(x-.5)<.001));
});
test('joining capture chunks preserves original audio without gaps',()=>{assert.deepEqual([...joinSamples([new Float32Array([1,2]),new Float32Array([3])])],[1,2,3]);});
test('invalid microphone samples are made safe for local transcription',()=>{
 assert.deepEqual([...sanitizeVoiceSamples(new Float32Array([Number.NaN,Number.POSITIVE_INFINITY,-2,-.5,.5,2]))],[0,0,-1,-.5,.5,1]);
});
