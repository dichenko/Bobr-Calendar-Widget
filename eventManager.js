const { ipcMain } = require('electron');
const calendar = require('./calendar');

let eventCheckInterval = null;

function startEventChecking(token) {
    if (eventCheckInterval) {
        clearInterval(eventCheckInterval);
    }

    // Проверяем события каждые 30 секунд
    eventCheckInterval = setInterval(async () => {
        try {
            const events = await calendar.getEvents(token);
            ipcMain.emit('events-updated', events); // Отправляем события в renderer
        } catch (error) {
            console.error('Ошибка при проверке событий:', error);
        }
    }, 30000); // 30 секунд

    // Первая проверка сразу
    calendar.getEvents(token)
        .then(events => ipcMain.emit('events-updated', events))
        .catch(error => console.error('Ошибка при первой проверке событий:', error));
}

function stopEventChecking() {
    if (eventCheckInterval) {
        clearInterval(eventCheckInterval);
        eventCheckInterval = null;
    }
}

module.exports = {
    startEventChecking,
    stopEventChecking
};