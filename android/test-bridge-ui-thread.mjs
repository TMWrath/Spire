import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./app/src/main/java/com/tmwrath/spire/MainActivity.java',import.meta.url),'utf8');
// Regression for the device ANR: JSONStringer must not run in UI callbacks.
assert.doesNotMatch(source,/runOnUiThread\(\(\)->\{[^}]*response\.toString\(\)/);
assert.equal((source.match(/final String serialized=response\.toString\(\);runOnUiThread/g)||[]).length,2);
assert.equal((source.match(/reply\.postMessage\(serialized\)/g)||[]).length,2);
console.log('PASS: Local and media responses serialize before UI dispatch');
