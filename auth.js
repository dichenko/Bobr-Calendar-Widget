const { google } = require('googleapis');
const { shell } = require('electron');
const Store = require('electron-store');
const store = new Store();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Проверка переменных окружения при запуске
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  throw new Error('Missing CLIENT_ID or CLIENT_SECRET in .env file');
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:0/oauth2callback';

let authServer = null;
let oauth2Client = null;
let actualPort = null;
let isAuthInProgress = false;

// Функция для создания и получения oauth2Client
function createOAuth2Client(port) {
  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    `http://localhost:${port}/oauth2callback`
  );
}

async function getAuthCode() {
  if (isAuthInProgress) {
    console.log('Процесс авторизации уже запущен');
    return null;
  }

  return new Promise((resolve, reject) => {
    try {
      isAuthInProgress = true;

      if (authServer) {
        authServer.close();
        authServer = null;
      }

      authServer = require('http').createServer((req, res) => {
        if (req.url.startsWith('/oauth2callback')) {
          const url = new URL(req.url, `http://localhost:${actualPort}`);
          const code = url.searchParams.get('code');
          
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Авторизация успешна! Вы можете закрыть это окно.</h1>');
            cleanup();
            resolve(code);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Ошибка авторизации</h1>');
            cleanup();
            reject(new Error('Код авторизации не найден'));
          }
        }
      });

      authServer.listen(0, 'localhost', () => {
        actualPort = authServer.address().port;
        console.log(`Сервер обратного вызова запущен на порту ${actualPort}`);
        oauth2Client = createOAuth2Client(actualPort);
        
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        // Открываем URL для авторизации
        require('electron').shell.openExternal(authUrl);
      });

    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

// Отдельная функция для получения URL авторизации
function getAuthUrl() {
  if (!oauth2Client) {
    throw new Error('OAuth2 клиент не инициализирован');
  }
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly']
  });
}

async function authenticate() {
  try {
    // Создаем новый экземпляр клиента при каждой авторизации
    oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      prompt: 'consent',
      include_granted_scopes: true
    });

    await shell.openExternal(authUrl);
    const code = await getAuthCode();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Сохраняем токены
    store.set('googleToken', tokens);
    return tokens;
  } catch (error) {
    console.error('Authentication failed:', error);
    // Сбрасываем клиент при ошибке
    oauth2Client = null;
    throw error;
  }
}

function getToken() {
  return store.get('googleToken');
}

function logout() {
  store.delete('googleToken');
  // Сбрасываем OAuth клиент
  oauth2Client = null;
  // Закрываем сервер если остался
  if (authServer) {
    authServer.close();
    authServer = null;
  }
}

function cleanup() {
  if (authServer) {
    authServer.close();
    authServer = null;
  }
  isAuthInProgress = false;
  actualPort = null;
}

module.exports = {
  getAuthCode,
  getAuthUrl,
  authenticate,
  getToken,
  logout,
  cleanup,
  getOAuth2Client: () => oauth2Client
};