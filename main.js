const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const auth = require('./auth');
const eventManager = require('./eventManager');
const calendar = require('./calendar');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 416,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // Открываем DevTools в отдельном окне
  mainWindow.webContents.openDevTools({ mode: 'detach' });

}

// Обработчик для авторизации
ipcMain.handle('google-auth', async () => {
  const tokens = await auth.authenticate();
  eventManager.startEventChecking(tokens); // Запускаем проверку событий
  const events = await calendar.getEvents(tokens); // Загружаем события
  mainWindow.webContents.send('events-updated', events || []); // Убедимся, что events всегда массив
  return tokens;
});

// Обработчик для выхода
ipcMain.handle('logout', () => {
  auth.logout();
  eventManager.stopEventChecking();
  mainWindow.webContents.send('clear-events'); // Очищаем события в интерфейсе
  return true;
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