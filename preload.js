const { contextBridge, ipcRenderer } = require('electron');

// Добавим отладочный вывод
console.log('Инициализация preload.js');

// Экспортируем API именно как electronAPI, а не api
contextBridge.exposeInMainWorld(
    'electronAPI',  // Важно! Именно electronAPI, а не api
    {
        googleAuth: () => ipcRenderer.invoke('google-auth'),
        submitAuthCode: (code) => ipcRenderer.invoke('submit-auth-code', code),
        getToken: () => ipcRenderer.invoke('get-token'),
        setToken: (token) => ipcRenderer.invoke('set-token', token),
        getEvents: (token) => ipcRenderer.invoke('get-events', token),
        openExternal: (url) => ipcRenderer.invoke('open-external', url),
        logout: () => ipcRenderer.invoke('logout'),
        onAuthComplete: (callback) => ipcRenderer.on('auth-complete', callback)
    }
);

console.log('Preload script загружен');