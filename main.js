const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const auth = require('./auth');
const eventManager = require('./eventManager');
const calendar = require('./calendar');
const Store = require('electron-store');
//const { google } = require('googleapis');
const notifier = require('node-notifier');
const { exec } = require('child_process');
const soundPath = path.join(__dirname, 'assets/sounds', 'notification1.wav');

// Создаем экземпляр Store
const store = new Store();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // Открываем DevTools в отдельном окне
  mainWindow.webContents.openDevTools({ mode: 'detach' });



  mainWindow.on('focus', () => {
    
    // При фокусе сразу обновляем события
    const token = store.get('googleToken');
    if (token) eventManager.startEventChecking(token);
  });

  // Изменение: обработка события обновления событий
  ipcMain.on('events-updated', (events) => {
    mainWindow.webContents.send('events-updated', events);
  });

  // Обработчик для минимизации окна
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  // Обработчик для закрытия окна
  ipcMain.on('close-window', () => {
    mainWindow.close();
  });
}



// Обработчик для авторизации
ipcMain.handle('google-auth', async () => {
  const tokens = await auth.authenticate();
  eventManager.startEventChecking(tokens);
  return tokens;
});

// Обработчик для получения токена
ipcMain.handle('get-token', () => {
  return auth.getToken();
});

// Обработчик для получения событий
ipcMain.handle('get-events', async (event, token) => {
  try {
    const events = await calendar.getEvents(token);
    return events || []; // Убедимся, что events всегда массив
  } catch (error) {
    console.error('Ошибка при получении событий:', error);
    throw error;
  }
});

// Добавим новый обработчик IPC
ipcMain.handle('show-notification', () => {
    console.log('Показываем уведомление');
    
    const command = `powershell -c (New-Object Media.SoundPlayer '${soundPath}').PlaySync()`;
    
    exec(command, (error) => {
        if (error) {
            console.error('Ошибка воспроизведения звука:', error);
        } else {
            console.log('Звук успешно воспроизведен');
        }
    });

    notifier.notify({
        title: 'Календарь',
        message: 'Скоро окончание события',
        sound: true,
        wait: false
    });
});

// Добавьте после других обработчиков ipcMain
ipcMain.handle('logout', async () => {
    try {
        auth.logout();
        eventManager.stopEventChecking();
        return true;
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        throw error;
    }
});

ipcMain.handle('set-opacity', (_, value) => {
    mainWindow.setOpacity(value);
    store.set('windowOpacity', value);
    return true;
});

ipcMain.handle('set-notification-times', (_, times) => {
    store.set('notificationTimes', times);
    return true;
});

app.whenReady().then(() => {
  // Добавляем протокол для доступа к локальным ресурсам
  protocol.handle('asset', (request) => {
    const url = request.url.replace('asset://', '');
    return net.fetch('file://' + path.join(__dirname, url));
  });
  
  createWindow();
  const token = auth.getToken();
  if (token) {
    eventManager.startEventChecking(token); // Запускаем проверку событий, если токен есть
  }
});