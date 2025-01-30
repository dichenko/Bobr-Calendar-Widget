const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  googleAuth: () => ipcRenderer.invoke('google-auth'),
  submitAuthCode: (code) => ipcRenderer.invoke('submit-auth-code', code),
  getToken: () => ipcRenderer.invoke('get-token'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),
  getEvents: (token) => ipcRenderer.invoke('get-events', token),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  handleAuthComplete: (callback) => ipcRenderer.on('auth-complete', callback)
});

console.log('Preload script загружен');