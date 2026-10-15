import test from 'node:test';
import assert from 'node:assert/strict';
import {MountedWorkspace,type MountScope,scopeKey} from '../shared/mounted-workspace';
const local:MountScope={kind:'local',origin:'saf://device/one',account:'device',workspace:'folder'};
const server=(origin='https://a.example',account='owner-a',workspace='vault-a'):MountScope=>({kind:'server',origin,account,workspace});
test('mounted paths stay distinct across origin, account, workspace and local/server',()=>{
 const keys=[local,server(),server('https://a.example','owner-b'),server('https://a.example','owner-a','other'),server('https://b.example')].map(s=>scopeKey(s,'Writing/file.md'));
 assert.equal(new Set(keys).size,5);
});
test('Settings login and sign-out retain Local without uploading any local files',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server());assert.deepEqual(workspace.mounts,[local,server()]);workspace.disconnect();assert.deepEqual(workspace.mounts,[local]);
});
test('previously opened server edits persist offline and conflicts preserve both versions',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server());workspace.openServer('Writing/file.md','original',7);workspace.editServer('Writing/file.md','offline edit');
 const restored=MountedWorkspace.restore(workspace.serialize());assert.deepEqual(restored.pending(server()),[{path:'Writing/file.md',base:7,content:'offline edit'}]);restored.acceptServer('Writing/file.md','remote edit',8);
 assert.deepEqual(restored.serverFile('Writing/file.md'),{path:'Writing/file.md',base:7,content:'offline edit',pending:true,conflict:{content:'remote edit',rev:8}});
});
test('unopened server files are not manufactured as offline cached files',()=>{const workspace=new MountedWorkspace(local);workspace.connect(server());assert.throws(()=>workspace.editServer('Writing/missing.md','draft'),/opened/);});
test('same path on a different account never exposes cached content or pending edits',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server());workspace.openServer('Writing/file.md','alice private',1);workspace.editServer('Writing/file.md','alice draft');workspace.disconnect();workspace.connect(server('https://a.example','owner-b'));
 assert.equal(workspace.serverFile('Writing/file.md'),undefined);assert.deepEqual(workspace.pending(server('https://a.example','owner-b')),[]);
});
test('acknowledgement of an older edit never erases a newer pending edit',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server());workspace.openServer('Writing/file.md','initial',1);workspace.editServer('Writing/file.md','first');workspace.editServer('Writing/file.md','second');workspace.acknowledgeServer('Writing/file.md','first',1,2);
 assert.deepEqual(workspace.pending(server()),[{path:'Writing/file.md',base:2,content:'second'}]);
});
test('non-HTTPS and embedded credential origins are rejected',()=>{const workspace=new MountedWorkspace(local);for(const origin of ['http://spire.example','https://user:password@spire.example'])assert.throws(()=>workspace.connect(server(origin)),/HTTPS/);});
test('server file provenance survives move-away, local edit and rename, restart and return without changing Markdown',()=>{
 const w=new MountedWorkspace(local),scope=server();w.connect(scope);const id='stable-server-id',file={id,path:'Writing/Old.md',origin:scope,revision:7,bytes:'portable markdown',state:'moved-away' as const};w.rememberMovedServerFile(file);
 const moved=w.findMovedServerFile(scope,id);assert.equal(moved?.revision,7);assert.equal(moved?.path,'Writing/Old.md');assert.equal(file.bytes,'portable markdown');
 w.updateMovedServerFile({...moved!,path:'Local/New.md',bytes:'independent local edit'});const restored=MountedWorkspace.restore(w.serialize());restored.connect(scope);
 const returned=restored.findMovedServerFile(scope,id);assert.equal(returned?.path,'Local/New.md');assert.equal(returned?.bytes,'independent local edit');assert.equal(returned?.revision,7);
});
test('provenance is strictly owner and workspace scoped',()=>{
 const w=new MountedWorkspace(local),a=server(),b=server('https://a.example','owner-b'),c=server('https://b.example');w.connect(a);w.rememberMovedServerFile({id:'same-id',path:'A.md',origin:a,revision:3,bytes:'A',state:'moved-away'});
 assert.equal(w.findMovedServerFile(b,'same-id'),undefined);assert.equal(w.findMovedServerFile(c,'same-id'),undefined);assert.notEqual(scopeKey(a,'A.md'),scopeKey(b,'A.md'));
});
test('legacy mounted cache without provenance restores empty and never guesses by path',()=>{
 const w=MountedWorkspace.restore(JSON.stringify({version:1,local,server:server(),files:[]}));assert.equal(w.findMovedServerFile(server(),'legacy-id'),undefined);
});
test('ordinary server edits cannot be automatically uploaded just because a moved-away receipt exists',()=>{
 const w=new MountedWorkspace(local),scope=server();w.connect(scope);w.rememberMovedServerFile({id:'id',path:'A.md',origin:scope,revision:3,bytes:'A',state:'moved-away'});assert.deepEqual(w.pending(scope),[]);
});
test('return matching uses stable identity and refuses deleted, restored or changed Server versions',()=>{
 const w=new MountedWorkspace(local),scope=server();w.connect(scope);w.rememberMovedServerFile({id:'stable',path:'Local/A.md',origin:scope,revision:3,bytes:'base',state:'moved-away'});
 assert.deepEqual(w.checkMovedReturn(scope,'stable',{id:'stable',path:'Server/Renamed.md',revision:3,bytes:'base',deleted:false}),{kind:'unchanged',serverPath:'Server/Renamed.md',revision:3});
 assert.deepEqual(w.checkMovedReturn(scope,'stable',{id:'stable',path:'Server/Renamed.md',revision:4,bytes:'remote edit',deleted:false}),{kind:'conflict',reason:'remote-edited',serverPath:'Server/Renamed.md',revision:4,localBytes:'base',serverBytes:'remote edit'});
 assert.equal(w.checkMovedReturn(scope,'stable',{id:'stable',path:'Server/Renamed.md',revision:4,bytes:'base',deleted:true}).kind,'conflict');
 assert.equal(w.checkMovedReturn(scope,'stable',{id:'different',path:'Local/A.md',revision:3,bytes:'base',deleted:false}).kind,'collision');
 assert.equal(w.checkMovedReturn(scope,'missing',{id:'missing',path:'Local/A.md',revision:3,bytes:'base',deleted:false}).kind,'unmatched');
});
