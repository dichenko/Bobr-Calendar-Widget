const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { google } = require('googleapis');
const Store = require('electron-store');
require('@electron/remote/main').initialize();
require('dotenv').config();

const store = new Store();
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let authServer = null;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Устанавливаем кодировку для консоли
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(message);
  });

  mainWindow.loadFile('index.html');
  require('@electron/remote/main').enable(mainWindow.webContents);
  mainWindow.webContents.openDevTools();

  // Добавим отладочную информацию
  console.log('Текущая директория (__dirname):', __dirname);
  console.log('Полный путь к preload.js:', path.join(__dirname, 'preload.js'));
}

// Регистрируем кастомный протокол
app.setAsDefaultProtocolClient('myapp');

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
            'http://localhost:8080/oauth2callback'
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
            'urn:ietf:wg:oauth:2.0:oob'
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
                'myapp://oauth2callback'
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

ipcMain.handle('get-events', async (_, tokenData) => {
    try {
        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET
        );
        
        // Устанавливаем токен
        oauth2Client.setCredentials({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expiry_date: tokenData.expiry_date
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 1,
            orderBy: 'startTime',
            singleEvents: true,
        });

        // Возвращаем только необходимые поля событий
        return response.data.items.map(event => ({
            id: event.id,
            summary: event.summary || 'Без названия',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date
        }));
    } catch (error) {
        console.error('Ошибка при получении событий:', error);
        throw new Error('Ошибка при получении событий');
    }
});

// Добавляем обработчик для открытия внешних ссылок
ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url);
});

// Добавляем обработчик для выхода из аккаунта
ipcMain.handle('logout', () => {
    try {
        store.delete('googleToken');
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

app.whenReady().then(createWindow);