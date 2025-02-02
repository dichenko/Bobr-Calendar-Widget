const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const auth = require('./auth');
const eventManager = require('./eventManager');
const calendar = require('./calendar');
const Store = require('electron-store');
const { google } = require('googleapis');

// Создаем экземпляр Store
const store = new Store();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 416,
    height: 200,
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

  // Обработчики фокуса окна
  mainWindow.on('blur', () => {
    console.log('Окно потеряло фокус');
  });

  mainWindow.on('focus', () => {
    console.log('Окно получило фокус');
    // При фокусе сразу обновляем события
    const token = store.get('googleToken');
    if (token) eventManager.startEventChecking(token);
  });

  // Изменение: обработка события обновления событий
  ipcMain.on('events-updated', (events) => {
    mainWindow.webContents.send('events-updated', events);
  });
}

// Единственный обработчик для logout
ipcMain.handle('logout', async () => {
  console.log('Обработчик logout вызван');
  auth.logout();
  eventManager.stopEventChecking();
  store.delete('googleToken');
  if (mainWindow) {
    mainWindow.webContents.send('clear-events');
  }
  return true;
});

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

app.whenReady().then(() => {
  createWindow();
  const token = auth.getToken();
  if (token) {
    eventManager.startEventChecking(token); // Запускаем проверку событий, если токен есть
  }
});