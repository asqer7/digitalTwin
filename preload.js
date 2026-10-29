const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shell', {
  capture: () => ipcRenderer.invoke('capture'),
  minimize: () => ipcRenderer.send('win:min'),
  maximize: () => ipcRenderer.send('win:max'),
  close: () => ipcRenderer.send('win:close'),
  setBackground: (c) => ipcRenderer.send('win:bg', c),
  onMaximize: (fn) => ipcRenderer.on('win:state', (_e, v) => fn(v)),
});
