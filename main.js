const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { google } = require('googleapis');
const Store = require('electron-store');
require('@electron/remote/main').initialize();
require('dotenv').config();
const player = require('play-sound')((opts = {}));

const store = new Store();
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';

let authServer = null;
let mainWindow = null;

// Хранилище для отслеживания уже проигранных уведомлений
const playedNotifications = new Set();

let eventCheckInterval = null;

function createContextMenu() {
    return Menu.buildFromTemplate([
        {
            label: 'Скрыть',
            click: () => {
                mainWindow.minimize();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Закрыть',
            click: () => {
                app.quit();
            }
        }
    ]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 416,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,        // Убираем тень
    //backgroundColor: '#00000000',  // Полностью прозрачный фон
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Добавляем обработчик контекстного меню
  mainWindow.webContents.on('context-menu', (event) => {
    const contextMenu = createContextMenu();
    contextMenu.popup();
  });

  // Устанавливаем кодировку для консоли
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(message);
  });

  mainWindow.loadFile('index.html');
  require('@electron/remote/main').enable(mainWindow.webContents);
  //mainWindow.webContents.openDevTools();

  // Добавим отладочную информацию
  console.log('Текущая директория (__dirname):', __dirname);
  console.log('Полный путь к preload.js:', path.join(__dirname, 'preload.js'));
}

// Регистрируем кастомный протокол
app.setAsDefaultProtocolClient('myapp');

// Функция для запуска периодической проверки событий
function startEventChecking(token) {
    // Очищаем предыдущий интервал, если он существует
    if (eventCheckInterval) {
        clearInterval(eventCheckInterval);
    }

    // Создаем функцию проверки событий
    const checkEvents = async () => {
        try {
            const oauth2Client = new google.auth.OAuth2(
                CLIENT_ID,
                CLIENT_SECRET,
                REDIRECT_URI
            );
            oauth2Client.setCredentials(token);

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfDay,
                timeMax: endOfDay,
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 100
            });

            console.log('Периодическая проверка событий:', response.data.items.length);
            
            response.data.items.forEach(event => {
                const endTime = new Date(event.end.dateTime || event.end.date);
                const now = new Date();
                const timeLeft = endTime.getTime() - now.getTime();
                const minutesLeft = Math.floor(timeLeft / (1000 * 60));
                const notificationId = `${event.id}_${endTime.getTime()}`;

                // Проверяем, что осталось ровно 10 минут (с погрешностью в 30 секунд из-за интервала обновления)
                if (minutesLeft <= 10 && minutesLeft > 9 && !playedNotifications.has(notificationId)) {
                    console.log(`Отправка уведомления для события: ${event.summary}, осталось минут: ${minutesLeft}`);
                    mainWindow.webContents.send('play-notification');
                    playedNotifications.add(notificationId);
                }
            });

            // Отправляем обновленные события в renderer
            mainWindow.webContents.send('events-updated', response.data.items);

        } catch (error) {
            console.error('Ошибка при периодической проверке событий:', error);
        }
    };

    // Запускаем первую проверку сразу
    checkEvents();
    
    // Устанавливаем интервал проверки каждые 30 секунд
    eventCheckInterval = setInterval(checkEvents, 30000);
}

// Обработчик для авторизации Google
ipcMain.handle('google-auth', async () => {
    try {
        console.log('Получен запрос на авторизацию Google');
        const getAuthCode = new Promise((resolve, reject) => {
            authServer = require('http').createServer((req, res) => {
                if (req.url.startsWith('/oauth2callback')) {
                    const url = new URL(req.url, 'http://localhost:8080');
                    const code = url.searchParams.get('code');
                    if (code) {
                        resolve(code);
                        // Отправляем HTML-ответ
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(`
                            <html>
                                <head>
                                    <title>Authorization Complete</title>
                                    <script>
                                        window.onload = function() {
                                            window.close();
                                        }
                                    </script>
                                    <style>
                                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                                        h2 { color: #2c3e50; }
                                    </style>
                                </head>
                                <body>
                                    <h2>Authorization Successful!</h2>
                                    <p>You can close this window and return to the app.</p>
                                </body>
                            </html>
                        `);
                        // Отправляем событие в главное окно
                        mainWindow.webContents.send('auth-complete', true);
                        authServer.close();
                    } else {
                        reject(new Error('Код авторизации не получен'));
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authorization Failed</h1>');
                        authServer.close();
                    }
                }
            });

            authServer.listen(8080);
        });

        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        // Открываем URL в браузере
        await shell.openExternal(authUrl);

        // Ждем код авторизации
        const code = await getAuthCode;

        // Получаем токены
        const { tokens } = await oauth2Client.getToken(code);
        store.set('googleToken', tokens);
        
        // Запускаем периодическую проверку после успешной авторизации
        startEventChecking(tokens);
        
        return tokens;
    } catch (error) {
        console.error('Ошибка при обработке google-auth:', error);
        throw error;
    }
});

// Добавляем обработчик для получения кода авторизации
ipcMain.handle('submit-auth-code', async (_, code) => {
    try {
        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        store.set('googleToken', tokens);
        return tokens;
    } catch (error) {
        console.error('Ошибка при получении токена:', error);
        throw error;
    }
});

// Обработчик протокола
app.on('open-url', async (event, url) => {
    event.preventDefault();
    console.log('Получен callback:', url);
    
    try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        
        if (code) {
            const oauth2Client = new google.auth.OAuth2(
                CLIENT_ID,
                CLIENT_SECRET,
                REDIRECT_URI
            );

            const { tokens } = await oauth2Client.getToken(code);
            console.log('Получены токены');
            
            // Сохраняем токены
            store.set('googleToken', tokens);
            
            // Отправляем событие в renderer process
            mainWindow.webContents.send('auth-complete', tokens);
        }
    } catch (error) {
        console.error('Ошибка при обработке callback:', error);
    }
});

ipcMain.handle('get-token', () => {
    try {
        const token = store.get('googleToken');
        // Возвращаем только необходимые поля токена
        if (token) {
            return {
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                expiry_date: token.expiry_date
            };
        }
        return null;
    } catch (error) {
        console.error('Ошибка при получении токена:', error);
        return null;
    }
});

ipcMain.handle('set-token', (_, tokenData) => {
    try {
        // Сохраняем только необходимые поля
        const token = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expiry_date: tokenData.expiry_date
        };
        store.set('googleToken', token);
        return true;
    } catch (error) {
        console.error('Ошибка при сохранении токена:', error);
        return false;
    }
});

// Функция для воспроизведения звука уведомления
function playNotificationSound() {
    player.play(path.join(__dirname, 'notification.mp3'), function(err) {
        if (err) console.error('Ошибка при воспроизведении звука:', err);
    });
}

// Обработчик для получения событий из календаря
ipcMain.handle('get-events', async (event, token) => {
    try {
        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );
        oauth2Client.setCredentials(token);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay,
            timeMax: endOfDay,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100
        });

        console.log('Получено событий:', response.data.items.length);
        
        // Проверяем каждое событие
        response.data.items.forEach(event => {
            const endTime = new Date(event.end.dateTime || event.end.date);
            const now = new Date();
            const timeLeft = endTime.getTime() - now.getTime();
            const minutesLeft = Math.floor(timeLeft / (1000 * 60));
            const notificationId = `${event.id}_${endTime.getTime()}`;

            // Проверяем, что осталось ровно 10 минут (с погрешностью в 30 секунд из-за интервала обновления)
            if (minutesLeft <= 10 && minutesLeft > 9 && !playedNotifications.has(notificationId)) {
                console.log(`Отправка уведомления для события: ${event.summary}, осталось минут: ${minutesLeft}`);
                mainWindow.webContents.send('play-notification');
                playedNotifications.add(notificationId);
            }
        });

        return response.data.items;
    } catch (error) {
        console.error('Ошибка при получении событий:', error);
        throw error;
    }
});

// Добавляем обработчик для открытия внешних ссылок
ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url);
});

// Обработчик для выхода
ipcMain.handle('logout', () => {
    try {
        // Останавливаем интервал проверки событий
        if (eventCheckInterval) {
            clearInterval(eventCheckInterval);
            eventCheckInterval = null;
        }
        // Очищаем сохраненный токен
        store.delete('googleToken');
        // Очищаем Set с уведомлениями
        playedNotifications.clear();
        // Отправляем сигнал в renderer для очистки UI
        mainWindow.webContents.send('clear-events');
        return true;
    } catch (error) {
        console.error('Ошибка при выходе из аккаунта:', error);
        return false;
    }
});

// В функции, где создается окно авторизации
function createAuthWindow() {
    const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Добавляем обработчик для установки правильной кодировки
    authWindow.webContents.on('did-finish-load', () => {
        authWindow.webContents.executeJavaScript(`
            document.open('text/html', 'replace');
            document.write('<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                    '<meta charset="UTF-8">' +
                    '<title>Authorization</title>' +
                    '<style>' +
                        'body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }' +
                        'h2 { color: #2c3e50; }' +
                    '</style>' +
                '</head>' +
                '<body>' +
                    '<h2>Authorization Successful!</h2>' +
                    '<p>You can close this window now.</p>' +
                '</body>' +
                '</html>');
            document.close();
        `);
    });

    return authWindow;
}

app.whenReady().then(() => {
    createWindow();
    const savedToken = store.get('googleToken');
    if (savedToken) {
        startEventChecking(savedToken);
    }
});