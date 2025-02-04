const { contextBridge, ipcRenderer } = require('electron');
const notifier = require('node-notifier');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
    googleAuth: () => ipcRenderer.invoke('google-auth'),
    getToken: () => ipcRenderer.invoke('get-token'),
    logout: () => ipcRenderer.invoke('logout'),
    getEvents: (token) => ipcRenderer.invoke('get-events', token),
    onAuthComplete: (callback) => ipcRenderer.on('auth-complete', callback),
    onEventsUpdated: (callback) => {
        ipcRenderer.on('events-updated', (_, events) => callback(events));
    },
    onClearEvents: (callback) => ipcRenderer.on('clear-events', callback),
    playNotification: () => ipcRenderer.invoke('show-notification'),
});