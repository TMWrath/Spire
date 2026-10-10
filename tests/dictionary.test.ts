import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaryEntries,dictionaryFiles,relativeTermTarget,termLinkMarkdown} from '../client/dictionary.ts';
import type {Note} from '../shared/model.ts';
const note=(path:string,content:string):Note=>({id:path,path,content,rev:1,deleted:false,time:'2026-01-01T00:00:00.000Z',history:[]});

test('discovers only explicitly tagged dictionary files and parses heading entries',()=>{
 const valid=note('Reference/Astronomy.md','---\nspire_type: dictionary\n---\n# Astronomy\n\n## Aphelion\nThe **farthest** orbital point.\n\n### Detail\nStill part of Aphelion.\n\n## Perihelion\nThe closest point.');
 const ordinary=note('Reference/Other.md','## Hidden\nNot a dictionary.');
 assert.deepEqual(dictionaryFiles([ordinary,valid]).map(n=>n.path),['Reference/Astronomy.md']);
 assert.deepEqual(dictionaryEntries(valid),[
  {term:'Aphelion',anchor:'aphelion',definition:'The **farthest** orbital point.\n\n### Detail\nStill part of Aphelion.'},
  {term:'Perihelion',anchor:'perihelion',definition:'The closest point.'}
 ]);
});

test('ignores the dictionary title and disambiguates duplicate heading anchors',()=>{
 const file=note('Terms.md','---\nspire_type: dictionary\n---\n# Terms\n## Echo\nFirst.\n## Echo\nSecond.');
 assert.deepEqual(dictionaryEntries(file).map(e=>e.anchor),['echo','echo-1']);
});

test('builds portable relative markdown links and escapes labels',()=>{
 assert.equal(relativeTermTarget('Writing/Chapters/One.md','Reference/Terms.md','aphelion'),'../../Reference/Terms.md#aphelion');
 assert.equal(termLinkMarkdown('its [farthest] point','../../Reference/Terms.md#aphelion'),'[its \\[farthest\\] point](../../Reference/Terms.md#aphelion)');
});
