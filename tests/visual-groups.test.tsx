import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectPinIcon} from '../client/ProjectPinIcon';

test('a pinned project rotates the familiar pin counterclockwise while an unpinned pin stays upright',()=>{
 const unpinned=renderToStaticMarkup(<ProjectPinIcon pinned={false}/>);
 const pinned=renderToStaticMarkup(<ProjectPinIcon pinned/>);
 assert.match(unpinned,/lucide-pin/);
 assert.doesNotMatch(unpinned,/project-pin-icon-pinned/);
 assert.match(pinned,/lucide-pin/);
 assert.match(pinned,/project-pin-icon-pinned/);
});
