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
    // Отправляем событие для очистки UI
    mainWindow.webContents.send('clear-events');
    // Сбрасываем текущие события
    ipcMain.emit('events-updated', null, []);
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

// Добавим новый обработчик IPC
ipcMain.handle('show-notification', () => {
    console.log('Показываем уведомление'); // для отладки

     // Формируем путь к звуковому файлу
     //const soundPath = path.join(__dirname, 'assets/sounds', 'notification1.waw');
    
     // Используем PowerShell для воспроизведения звука в Windows
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
        message: 'До конца события осталось 10 минут',
        sound: true,
        wait: false
    }, (err, response) => {
        // Добавим логирование для отладки
        if (err) console.error('Ошибка уведомления:', err);
        console.log('Ответ уведомления:', response);
    });
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