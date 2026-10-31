import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startLocalWorkspace,serverOrigin,workspacePartition} from '../desktop/runtime.ts';
test('desktop server URL rejects credentials, paths and unencrypted remote connections',()=>{
 assert.equal(serverOrigin('https://spire.example/'),'https://spire.example');
 assert.equal(serverOrigin('http://127.0.0.1:4173'),'http://127.0.0.1:4173');
 for(const value of ['file:///etc/passwd','javascript:alert(1)','http://spire.example','https://user:password@spire.example','https://spire.example/path','https://spire.example/?token=x'])assert.throws(()=>serverOrigin(value));
 assert.notEqual(workspacePartition('local','one'),workspacePartition('server','one'));
 assert.notEqual(workspacePartition('local','one'),workspacePartition('local','two'));
});
test('desktop engine serves shared app on loopback and releases folder lock on close',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'spire-host-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const dist=fs.mkdtempSync(path.join(os.tmpdir(),'spire-ui-'));t.after(()=>fs.rmSync(dist,{recursive:true,force:true}));fs.writeFileSync(path.join(dist,'index.html'),'shared Spire interface');
 const host=await startLocalWorkspace(folder,dist);t.after(()=>host.close());
 assert.match(host.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
 assert.equal(await (await fetch(host.origin)).text(),'shared Spire interface');
 assert.deepEqual(await (await fetch(host.origin+'/api/bootstrap')).json(),{setup:true});
 await assert.rejects(()=>startLocalWorkspace(folder,dist),/locked/i);
 await host.close();assert.equal(fs.existsSync(path.join(folder,'.spire-desktop','process.lock')),false);
 const again=await startLocalWorkspace(folder,dist);await again.close();
});
