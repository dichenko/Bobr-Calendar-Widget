const { contextBridge, ipcRenderer } = require('electron');
const notifier = require('node-notifier');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

contextBridge.exposeInMainWorld('electronAPI', {
    googleAuth: () => ipcRenderer.invoke('google-auth'),
    getToken: () => ipcRenderer.invoke('get-token'),
    
    getEvents: (token) => ipcRenderer.invoke('get-events', token),
    onAuthComplete: (callback) => ipcRenderer.on('auth-complete', callback),
    onEventsUpdated: (callback) => {
        ipcRenderer.on('events-updated', (_, events) => callback(events));
    },
    onClearEvents: (callback) => ipcRenderer.on('clear-events', callback),
    playNotification: () => {
        const audio = new Audio(path.join(process.resourcesPath, 'assets', 'sounds', 'notification1.wav'));
        return audio.play();
    },
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    logout: () => ipcRenderer.invoke('logout'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setOpacity: (value) => {
        store.set('settings.opacity', value * 100);
        ipcRenderer.invoke('set-opacity', value);
    },
    setNotificationTimes: (times) => {
        store.set('settings.notificationTimes', times);
        ipcRenderer.invoke('set-notification-times', times);
    },
});