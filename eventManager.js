const { ipcMain } = require('electron');
const calendar = require('./calendar');

let eventCheckInterval = null;
let currentToken = null;

function startEventChecking(token) {
    currentToken = token;
    if (eventCheckInterval) clearInterval(eventCheckInterval);
    
    // Запускаем немедленное обновление
    updateEvents();
    
    // Устанавливаем постоянный интервал
    eventCheckInterval = setInterval(updateEvents, 30000);
}

async function updateEvents() {
    try {
        const events = await calendar.getEvents(currentToken);
        ipcMain.emit('events-updated', events);
    } catch (error) {
        console.error('Ошибка обновления событий:', error);
    }
}

function stopEventChecking() {
    if (eventCheckInterval) {
        clearInterval(eventCheckInterval);
        eventCheckInterval = null;
    }
}

// Добавляем обработчик для работы в фоновом режиме
ipcMain.on('app-blur', () => {
    console.log('Приложение ушло в фон, продолжаем проверку событий');
});

ipcMain.on('app-focus', () => {
    console.log('Приложение вернулось в фокус');
});

module.exports = {
    startEventChecking,
    stopEventChecking
};