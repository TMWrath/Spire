import test from 'node:test';
import assert from 'node:assert/strict';
import {MountedWorkspace,scopeKey} from '../shared/mounted-workspace';

const local={kind:'local' as const,origin:'local:folder-1',account:'local',workspace:'folder-1'};
const server={kind:'server' as const,origin:'https://spire.example',account:'alice',workspace:'writing'};

test('mounted paths stay distinct across origin, account, workspace and local/server',()=>{
 const keys=[local,server,{...server,account:'bob'},{...server,workspace:'other'},{...server,origin:'https://other.example'}].map(s=>scopeKey(s,'Writing/file.md'));
 assert.equal(new Set(keys).size,5);
});
test('Settings login and sign-out retain Local without uploading any local files',()=>{
 const workspace=new MountedWorkspace(local);
 workspace.connect(server);
 assert.deepEqual(workspace.mounts,[local,server]);
 workspace.disconnect();
 assert.deepEqual(workspace.mounts,[local]);
});
test('previously opened server edits persist offline and conflicts preserve both versions',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server);
 workspace.openServer('Writing/file.md','original',7);
 workspace.editServer('Writing/file.md','offline edit');
 const restored=MountedWorkspace.restore(workspace.serialize());
 assert.deepEqual(restored.pending(server),[{path:'Writing/file.md',base:7,content:'offline edit'}]);
 restored.acceptServer('Writing/file.md','remote edit',8);
 assert.deepEqual(restored.serverFile('Writing/file.md'),{path:'Writing/file.md',base:7,content:'offline edit',pending:true,conflict:{content:'remote edit',rev:8}});
});
test('unopened server files are not manufactured as offline cached files',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server);
 assert.throws(()=>workspace.editServer('Writing/missing.md','draft'),/opened/);
});
test('same path on a different account never exposes cached content or pending edits',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server);workspace.openServer('Writing/file.md','alice private',1);workspace.editServer('Writing/file.md','alice draft');
 workspace.disconnect();workspace.connect({...server,account:'bob'});
 assert.equal(workspace.serverFile('Writing/file.md'),undefined);
 assert.deepEqual(workspace.pending({...server,account:'bob'}),[]);
});
test('acknowledgement of an older edit never erases a newer pending edit',()=>{
 const workspace=new MountedWorkspace(local);workspace.connect(server);workspace.openServer('Writing/file.md','initial',1);workspace.editServer('Writing/file.md','first');workspace.editServer('Writing/file.md','second');
 workspace.acknowledgeServer('Writing/file.md','first',1,2);
 assert.deepEqual(workspace.pending(server),[{path:'Writing/file.md',base:2,content:'second'}]);
});
test('non-HTTPS and embedded credential origins are rejected',()=>{
 const workspace=new MountedWorkspace(local);
 for(const origin of ['http://spire.example','https://user:password@spire.example'])assert.throws(()=>workspace.connect({...server,origin}),/HTTPS/);
});
