import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectPinIcon} from '../client/ProjectPinIcon';

test('a pinned project uses a top-position icon while an unpinned project uses a pin icon',()=>{
 const unpinned=renderToStaticMarkup(<ProjectPinIcon pinned={false}/>);
 const pinned=renderToStaticMarkup(<ProjectPinIcon pinned/>);
 assert.match(unpinned,/lucide-pin/);
 assert.doesNotMatch(unpinned,/lucide-arrow-up-to-line/);
 assert.match(pinned,/lucide-arrow-up-to-line/);
 assert.doesNotMatch(pinned,/lucide-pin(?:\s|\")/);
});
