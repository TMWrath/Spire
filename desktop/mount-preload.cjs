const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('spireRemoteTransport',Object.freeze({request:input=>ipcRenderer.invoke('spire:mounted-request',input)}));
contextBridge.exposeInMainWorld('spireLocalWorkspace',true);
