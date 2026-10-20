import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_LANGUAGES,normalizeVoiceLanguage,parseVoiceKeywords,voiceLanguageName,type VoiceLanguage} from '../client/voice-language';

test('voice language choices include automatic detection and every Whistle language',()=>{
 assert.deepEqual(VOICE_LANGUAGES.map(option=>option.value),['auto','en','de','fr','es','it','nl','pl']);
});

test('invalid persisted voice languages safely fall back to automatic detection',()=>{
 for(const value of [null,'','ja','EN'])assert.equal(normalizeVoiceLanguage(value),'auto');
 for(const value of ['auto','en','de','fr','es','it','nl','pl'])assert.equal(normalizeVoiceLanguage(value),value as VoiceLanguage);
});

test('keyword hints trim, deduplicate, and stay bounded',()=>{
 assert.deepEqual(parseVoiceKeywords(' Siobhán, Needle\nneedle; clase de español ;; '),['Siobhán','Needle','clase de español']);
 assert.equal(parseVoiceKeywords(Array.from({length:100},(_,index)=>`term${index}`).join(',')).length,32);
});

test('detected language labels remain readable',()=>{
 assert.equal(voiceLanguageName('de'),'German');
 assert.equal(voiceLanguageName(''),'Unknown');
});
