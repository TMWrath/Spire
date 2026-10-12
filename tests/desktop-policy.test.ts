import test from 'node:test';
import assert from 'node:assert/strict';
import {rendererPreferences,allowsNavigation,allowsPermission} from '../desktop/policy.ts';
test('workspace renderer has no Node or privileged preload access',()=>{
 const prefs=rendererPreferences('persist:example');
 assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);assert.equal(prefs.webSecurity,true);assert.equal(prefs.partition,'persist:example');assert.equal('preload' in prefs,false);
});
test('workspace navigation cannot escape the selected server',()=>{
 assert.equal(allowsNavigation('https://spire.example','https://spire.example/login'),true);
 for(const target of ['https://other.example','file:///etc/passwd','javascript:alert(1)','https://spire.example.evil/'])assert.equal(allowsNavigation('https://spire.example',target),false);
});
test('only foreground media permission from the actual workspace is eligible for consent',()=>{
 assert.equal(allowsPermission('https://spire.example','https://spire.example','media'),true);
 assert.equal(allowsPermission('https://spire.example','https://other.example','media'),false);
 assert.equal(allowsPermission('https://spire.example','https://spire.example','geolocation'),false);
});
