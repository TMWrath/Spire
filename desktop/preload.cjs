const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('spireDesktop',{backup:()=>ipcRenderer.invoke('spire:backup'),restore:()=>ipcRenderer.invoke('spire:restore'),openLocal:()=>ipcRenderer.invoke('spire:local'),openServer:address=>ipcRenderer.invoke('spire:server',address)});
