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
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';

let authServer = null;
let oauth2Client = null;

async function getAuthCode() {
  return new Promise((resolve, reject) => {
    // Закрываем предыдущий сервер если был
    if (authServer) {
      authServer.close();
    }

    authServer = require('http').createServer((req, res) => {
      if (req.url.startsWith('/oauth2callback')) {
        const url = new URL(req.url, 'http://localhost:8080');
        const code = url.searchParams.get('code');
        
        if (code) {
          resolve(code);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Authorization Successful! You can close this window.</h1>');
        } else {
          reject(new Error('Authorization code not found'));
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization Failed</h1>');
        }
        
        // Всегда закрываем сервер после обработки
        authServer.close(() => {
          authServer = null;
        });
      }
    });

    authServer.listen(8080, () => {
      console.log('Callback server started on port 8080');
    });
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

module.exports = {
  authenticate,
  getToken,
  logout
};