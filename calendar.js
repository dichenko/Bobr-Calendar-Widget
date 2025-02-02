const { google } = require('googleapis');

// Функция форматирования времени
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

async function getEvents(token) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            'http://localhost:8080/oauth2callback'
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

        // Форматируем время в событиях
        const formattedEvents = (response.data.items || []).map(event => ({
            ...event,
            formattedStart: formatTime(event.start.dateTime || event.start.date),
            formattedEnd: formatTime(event.end.dateTime || event.end.date)
        }));

        return formattedEvents;
    } catch (error) {
        console.error('Ошибка при получении событий:', error);
        return [];
    }
}

module.exports = {
    getEvents
};