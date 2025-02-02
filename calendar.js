const { google } = require('googleapis');

async function getEvents(token) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID, // Передаем client_id
      process.env.CLIENT_SECRET, // Передаем client_secret
      'http://localhost:8080/oauth2callback' // Передаем redirect_uri
    );

    // Устанавливаем токены
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

    return response.data.items || []; // Убедимся, что возвращается массив
  } catch (error) {
    console.error('Ошибка при получении событий:', error);
    return []; // Возвращаем пустой массив в случае ошибки
  }
}

module.exports = {
  getEvents
};