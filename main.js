const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const auth = require('./auth');
const eventManager = require('./eventManager');
const calendar = require('./calendar');
const Store = require('electron-store');
//const { google } = require('googleapis');
const notifier = require('node-notifier');
const { exec } = require('child_process');
const fs = require('fs');
const { URL } = require('url');

// Создаем экземпляр Store
const store = new Store();

// Установка значений по умолчанию, если их нет
if (!store.has('settings')) {
  store.set('settings', {
    opacity: 100,
    notificationTimes: [10]
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // Включение DevTools при запуске
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

// Правильный путь к звуковому файлу
const soundPath = app.isPackaged 
  ? path.join(process.resourcesPath, 'assets', 'sounds', 'notification1.wav')
  : path.join(__dirname, 'assets', 'sounds', 'notification1.wav');

function playNotificationSound() {
    const audio = new Audio(soundPath);
    audio.play().catch(err => {
        console.error('Ошибка воспроизведения звука:', err);
    });
}

// Обработчик IPC для воспроизведения звука
ipcMain.handle('show-notification', () => {
    playNotificationSound();
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

// Добавить после других обработчиков ipcMain
ipcMain.handle('get-settings', () => {
  return {
    opacity: store.get('windowOpacity', 100),
    notificationTimes: store.get('notificationTimes', [10])
  };
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
  protocol.handle('asset', async (request) => {
    // Получаем полный путь из URL, включая 'icons/'
    const filePath = request.url
      .replace('asset://', '')  // Убираем протокол
      .split('/')               // Разбиваем путь
      .filter(Boolean)          // Убираем пустые части
      .join(path.sep);          // Собираем путь с учетом ОС
    
    const basePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, 'assets');
    
    const fullPath = path.join(basePath, filePath);
    
    console.log('Asset request:', {
      url: request.url,
      filePath,
      basePath,
      fullPath,
      exists: fs.existsSync(fullPath),
      isPackaged: app.isPackaged
    });

    try {
      const data = await fs.promises.readFile(fullPath);
      const mimeType = {
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon'
      }[path.extname(fullPath)] || 'text/plain';

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      });
    } catch (error) {
      console.error('ASSET LOAD ERROR:', {
        requested: request.url,
        resolvedPath: fullPath,
        error: error.message,
        exists: fs.existsSync(fullPath),
        parentDir: path.dirname(fullPath),
        parentFiles: fs.existsSync(path.dirname(fullPath)) 
          ? fs.readdirSync(path.dirname(fullPath)) 
          : 'directory not found'
      });
      return new Response('Not Found', { status: 404 });
    }
  });
  
  createWindow();
  const token = auth.getToken();
  if (token) {
    eventManager.startEventChecking(token); // Запускаем проверку событий, если токен есть
  }
});