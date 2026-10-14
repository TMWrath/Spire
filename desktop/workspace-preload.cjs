const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('spireWorkspaceLauncher',Object.freeze({open:()=>ipcRenderer.invoke('spire:workspace-launcher')}));
