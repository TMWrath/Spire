import {app,BrowserWindow,dialog,ipcMain,Menu,shell,session} from 'electron';
import {createBackup,restoreBackup} from '../server/backup.ts';
import {nativeRemoteRequest} from './remote-transport';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {startLocalWorkspace,serverOrigin,workspacePartition} from './runtime.ts';
import {rendererPreferences,allowsNavigation,allowsPermission} from './policy.ts';

let launcher:BrowserWindow;
const hosts=new Map<string,Awaited<ReturnType<typeof startLocalWorkspace>>>();
const windows=new Map<string,BrowserWindow>();
const opening=new Set<string>();
const localRenderers=new Map<number,string>();
const workspaceRenderers=new Map<number,string>();
const root=path.resolve(__dirname,'..');
const launcherURL=pathToFileURL(path.join(__dirname,'launcher.html')).href;
const safeError=(error:unknown)=>error instanceof Error?error.message:'Unable to open workspace';
async function external(url:string,parent:BrowserWindow){
 let parsed:URL;try{parsed=new URL(url);}catch{return;}
 if(!['https:','http:','mailto:'].includes(parsed.protocol)||parsed.username||parsed.password)return;
 const answer=await dialog.showMessageBox(parent,{type:'question',message:'Open this link in your default browser?',detail:url,buttons:['Cancel','Open browser'],defaultId:0,cancelId:0});
 if(answer.response===1)await shell.openExternal(url);
}
async function openWorkspace(kind:'local'|'server',identity:string){
 identity=kind==='local'?fs.realpathSync(identity):serverOrigin(identity);
 const key=workspacePartition(kind,process.platform==='win32'&&kind==='local'?identity.toLowerCase():identity);
 const existing=windows.get(key);if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return;}
 if(opening.has(key))return;opening.add(key);
 let host:Awaited<ReturnType<typeof startLocalWorkspace>>|undefined;
 let win:BrowserWindow|undefined;
 try{
  host=kind==='local'?await startLocalWorkspace(identity,path.join(root,'dist')):undefined;
  const origin=host?.origin??identity;
  if(host)hosts.set(key,host);
  const ses=session.fromPartition(key);
  win=new BrowserWindow({width:1400,height:920,minWidth:420,minHeight:500,title:`Spire — ${kind==='local'?identity:origin}`,backgroundColor:'#090909',webPreferences:{...rendererPreferences(key),preload:path.join(__dirname,host?'mount-preload.cjs':'workspace-preload.cjs')}});
  const owned=win;workspaceRenderers.set(owned.webContents.id,origin);windows.set(key,owned);if(host)localRenderers.set(owned.webContents.id,origin);
  ses.setPermissionCheckHandler((contents,permission,requestOrigin)=>contents===owned.webContents&&allowsPermission(origin,requestOrigin,permission));
  ses.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
   if(contents!==owned.webContents||!allowsPermission(origin,details.requestingUrl,permission)){callback(false);return;}
   const answer=await dialog.showMessageBox(owned,{type:'question',message:'Allow camera or microphone access for this workspace?',detail:origin,buttons:['Deny','Allow'],defaultId:0,cancelId:0});callback(answer.response===1);
  });
  owned.webContents.on('will-navigate',(event,url)=>{if(!allowsNavigation(origin,url)){event.preventDefault();void external(url,owned);}});
  owned.webContents.on('will-redirect',(event,url)=>{if(!allowsNavigation(origin,url))event.preventDefault();});
  owned.webContents.setWindowOpenHandler(({url})=>{void external(url,owned);return {action:'deny'};});
  const rendererId=owned.webContents.id;
  owned.on('closed',()=>{localRenderers.delete(rendererId);workspaceRenderers.delete(rendererId);windows.delete(key);void host?.close().finally(()=>hosts.delete(key));});
  owned.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{
   if(isMainFrame&&code!==-3&&!owned.isDestroyed())void dialog.showMessageBox(owned,{type:'error',message:'Spire could not load this workspace.',detail:'Check the server address and connection. Your local files have not been moved. Use View → Reload to retry or close this window to return to the launcher.'});
  });
  await owned.loadURL(origin);
 }catch(error){win?.destroy();if(host){await host.close();hosts.delete(key);}throw error;}
 finally{opening.delete(key);}
}
function showLauncher(){if(launcher&&!launcher.isDestroyed()){launcher.show();launcher.focus();return;}
 launcher=new BrowserWindow({width:650,height:580,minWidth:480,minHeight:450,title:'Spire',backgroundColor:'#090909',webPreferences:{...rendererPreferences('persist:spire-launcher'),preload:path.join(__dirname,'preload.cjs')}});
 launcher.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 launcher.webContents.on('will-navigate',e=>e.preventDefault());
 void launcher.loadURL(launcherURL);
}
function trusted(event:Electron.IpcMainInvokeEvent){if(event.sender!==launcher?.webContents||event.senderFrame?.url!==launcherURL)throw new Error('Untrusted desktop request');}
ipcMain.handle('spire:workspace-launcher',event=>{const origin=workspaceRenderers.get(event.sender.id);if(!origin||event.senderFrame!==event.sender.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Untrusted workspace request');showLauncher();});
ipcMain.handle('spire:mounted-request',async(event,input:unknown)=>{const expected=localRenderers.get(event.sender.id);if(!expected||event.senderFrame!==event.sender.mainFrame||new URL(event.senderFrame.url).origin!==expected)throw Error('Untrusted mounted-workspace request');return nativeRemoteRequest(input,(origin,url,options)=>session.fromPartition('persist:spire-mounted-server-'+createHash('sha256').update(origin).digest('hex')).fetch(url,options));});
ipcMain.handle('spire:local',async event=>{trusted(event);try{const result=await dialog.showOpenDialog(launcher,{title:'Open Spire folder',properties:['openDirectory','createDirectory']});if(!result.canceled)await openWorkspace('local',result.filePaths[0]);return {ok:true};}catch(error){return {ok:false,error:safeError(error)};}});
ipcMain.handle('spire:server',async(event,value:unknown)=>{trusted(event);try{if(typeof value!=='string'||value.length>2048)throw new Error('Invalid server address');await openWorkspace('server',value);return {ok:true};}catch(error){return {ok:false,error:safeError(error)};}});
ipcMain.handle('spire:backup',async event=>{trusted(event);try{
 const selected=await dialog.showOpenDialog(launcher,{title:'Back up a closed local workspace',properties:['openDirectory']});if(selected.canceled)return {ok:true};
 const folder=fs.realpathSync(selected.filePaths[0]);const target=await dialog.showSaveDialog(launcher,{title:'Save full Spire backup',defaultPath:'spire-backup.json',filters:[{name:'Spire backup',extensions:['json']}]});if(target.canceled||!target.filePath)return {ok:true};
 const relative=path.relative(folder,path.resolve(target.filePath));if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('Save backups outside the workspace folder.');
 createBackup(path.join(folder,'.spire-desktop'),target.filePath,{contentDirectory:folder});return {ok:true,message:'Backup verified. Includes indexed files, history, styles and account settings. Keep this unencrypted backup private.'};
 }catch(error){return {ok:false,error:safeError(error)};}});
ipcMain.handle('spire:restore',async event=>{trusted(event);try{
 const source=await dialog.showOpenDialog(launcher,{title:'Select full Spire backup',properties:['openFile'],filters:[{name:'Spire backup',extensions:['json']}]});if(source.canceled)return {ok:true};
 const target=await dialog.showOpenDialog(launcher,{title:'Restore into a new empty folder (existing workspaces are never overwritten)',properties:['openDirectory','createDirectory']});if(target.canceled)return {ok:true};
 const folder=fs.realpathSync(target.filePaths[0]);restoreBackup(source.filePaths[0],path.join(folder,'.spire-desktop'),{contentDirectory:folder});return {ok:true,message:'Restore verified. Open the restored folder and sign in. Original workspace remains unchanged.'};
 }catch(error){return {ok:false,error:safeError(error)};}});
app.whenReady().then(()=>{
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'File',submenu:[{label:'Workspace launcher',accelerator:'CmdOrCtrl+Shift+O',click:showLauncher},{type:'separator'},{label:'Print',accelerator:'CmdOrCtrl+P',click:()=>BrowserWindow.getFocusedWindow()?.webContents.print()},{label:'Save PDF',click:async()=>{const w=BrowserWindow.getFocusedWindow();if(!w||w===launcher)return;try{const result=await dialog.showSaveDialog(w,{defaultPath:'spire.pdf',filters:[{name:'PDF',extensions:['pdf']}]});if(!result.canceled&&result.filePath)fs.writeFileSync(result.filePath,await w.webContents.printToPDF({printBackground:true}));}catch{dialog.showErrorBox('PDF export failed','No successful export was acknowledged.');}}},{type:'separator'},{role:'close'},{role:'quit'}]},
  {role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));showLauncher();
});
app.on('activate',showLauncher);
app.on('window-all-closed',()=>app.quit());
let quitting=false;
app.on('before-quit',event=>{if(!quitting&&hosts.size){event.preventDefault();quitting=true;Promise.allSettled([...hosts.values()].map(host=>host.close())).then(()=>app.quit());}});
