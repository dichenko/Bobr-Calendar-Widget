// Добавьте в начало файла для отладки
console.log('Инициализация API:', window.electronAPI);

// Получаем элементы DOM
const authButton = document.getElementById('auth-button');
const logoutButton = document.getElementById('logoutButton');
const eventsContainer = document.querySelector('.events-container');
const pastEventsList = document.getElementById('past-events-list');
const currentEventElement = document.getElementById('current-event');
const futureEventsList = document.getElementById('future-events-list');

// Проверяем, что все элементы найдены
console.log('DOM Elements:', {
    authButton,
    logoutButton,
    eventsContainer,
    pastEventsList,
    currentEventElement,
    futureEventsList
});

// Функция форматирования времени
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Функция проверки, является ли дата сегодняшней
function isToday(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    
    // Отладочная информация
    console.log('Проверка даты:');
    console.log('Исходная строка даты:', dateString);
    console.log('Дата события:', date);
    console.log('Сегодня:', today);
    
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    
    console.log('Результат проверки:', isToday);
    return isToday;
}

// Функция для обрезки длинных названий
function truncateTitle(title, maxLength = 40) {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
}

// Функция форматирования времени до конца события
function formatTimeLeft(endTime) {
    const now = new Date();
    const diff = endTime - now;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Функция загрузки событий
async function loadEvents(token) {
    try {
        // Проверяем валидность токена
        if (!token || !token.access_token) {
            console.error('Невалидный токен:', token);
            throw new Error('Токен отсутствует или недействителен');
        }

        const events = await window.electronAPI.getEvents(token);
        console.log('Все полученные события:', events);
        
        if (!events || events.length === 0) {
            eventsContainer.style.display = 'block';
            currentEventElement.innerHTML = '<div class="event-title">Нет событий на сегодня</div>';
            return;
        }

        const now = new Date();
        const pastEvents = [];
        const upcomingEvents = [];
        let currentEvent = null;

        // Разделяем события на прошедшие, текущие и будущие
        events.forEach(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            const endTime = new Date(event.end.dateTime || event.end.date);
            
            if (endTime < now) {
                pastEvents.push(event);
            } else if (startTime <= now && endTime >= now) {
                currentEvent = event;
            } else if (startTime > now) {
                upcomingEvents.push(event);
            }
        });

        // Показываем контейнер событий
        eventsContainer.style.display = 'block';

        // Заполняем прошедшие события
        pastEventsList.innerHTML = pastEvents.map(event => {
            const startTime = formatTime(new Date(event.start.dateTime || event.start.date));
            const endTime = formatTime(new Date(event.end.dateTime || event.end.date));
            return `
                <div class="past-event-item">
                    <span class="past-event-title">${truncateTitle(event.summary)}</span>
                    <span class="past-event-time">${startTime} - ${endTime}</span>
                </div>
            `;
        }).join('');

        // Отображаем текущее событие или время до следующего
        if (currentEvent) {
            const endTime = new Date(currentEvent.end.dateTime || currentEvent.end.date);
            const timeLeft = formatTimeLeft(endTime);
            currentEventElement.innerHTML = `
                <div class="current-event-item">
                    <div class="current-event-status">СЕЙЧАС</div>
                    <div class="current-event-title">${truncateTitle(currentEvent.summary)}</div>
                    <div class="current-event-time-left">
                        <span class="time-left-label">осталось</span>
                        <span class="time-left-value">${timeLeft}</span>
                    </div>
                </div>
            `;
        } else if (upcomingEvents.length > 0) {
            const nextEvent = upcomingEvents[0];
            const startTime = new Date(nextEvent.start.dateTime || nextEvent.start.date);
            const timeUntil = formatTimeUntil(startTime);
            currentEventElement.innerHTML = `
                <div class="next-event-item">
                    <div class="next-event-time">${timeUntil}</div>
                    <div class="next-event-title">${truncateTitle(nextEvent.summary)}</div>
                </div>
            `;
        } else {
            currentEventElement.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
        }

        // Заполняем будущие события
        futureEventsList.innerHTML = upcomingEvents.map(event => {
            const startTime = formatTime(new Date(event.start.dateTime || event.start.date));
            const endTime = formatTime(new Date(event.end.dateTime || event.end.date));
            return `
                <div class="event-item">
                    <span class="event-title">${truncateTitle(event.summary)}</span>
                    <span class="event-time">${startTime} - ${endTime}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
        // Если ошибка связана с токеном, попробуем переавторизоваться
        if (error.message.includes('invalid_request')) {
            clearUI();
            await checkAuth(); // Попытка переавторизации
        } else {
            currentEventElement.innerHTML = '<div class="event-title">Ошибка при загрузке событий</div>';
        }
    }
}

// Функция форматирования времени до события
function formatTimeUntil(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Функция проверки авторизации
async function checkAuth() {
    try {
        const token = await window.electronAPI.getToken();
        if (token && token.access_token) {
            authButton.style.display = 'none';
            logoutButton.style.display = 'block';
            await loadEvents(token); // Загружаем события после успешной авторизации
            return true;
        } else {
            authButton.style.display = 'block';
            logoutButton.style.display = 'none';
            return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        return false;
    }
}

// Переменная для хранения интервала обновления
let updateInterval;

// Функция запуска автообновления
function startAutoUpdate(token) {
    // Очищаем предыдущий интервал, если он был
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // Устанавливаем новый интервал (60000 мс = 1 минута)
    updateInterval = setInterval(() => {
        console.log('Автоматическое обновление событий');
        loadEvents(token);
    }, 60000);
}

// Функция остановки автообновления
function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Функция очистки UI
function clearUI() {
    console.log('Очищаем UI');
    // Показываем только кнопку входа
    authButton.style.display = 'block';
    // Скрываем все остальное
    logoutButton.style.display = 'none';
    eventsContainer.style.display = 'none';
    // Очищаем содержимое
    pastEventsList.innerHTML = '';
    currentEventElement.innerHTML = '';
    futureEventsList.innerHTML = '';
    console.log('UI очищен');
}

// Обновляем обработчик авторизации
authButton.addEventListener('click', async () => {
    console.log('Кнопка нажата');
    try {
        const tokens = await window.electronAPI.googleAuth();
        console.log('Авторизация успешна');
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
        await loadEvents(tokens);
        startAutoUpdate(tokens); // Запускаем автообновление
    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        authButton.style.display = 'block';
    }
});

// Обработчик кнопки выхода
logoutButton.addEventListener('click', async () => {
    try {
        await window.electronAPI.logout();
        clearUI();
        console.log('Успешный выход');
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
});

// Добавляем обработчик фокуса окна
window.addEventListener('focus', async () => {
    try {
        const token = await window.electronAPI.getToken();
        if (token && token.access_token) {
            console.log('Обновление событий при фокусе окна');
            await loadEvents(token);
        }
    } catch (error) {
        console.error('Ошибка при обновлении событий:', error);
    }
});

// Обновляем обработчик завершения авторизации
window.electronAPI.onAuthComplete(async () => {
    console.log('Получено событие завершения авторизации');
    try {
        const token = await window.electronAPI.getToken();
        if (token && token.access_token) {
            authButton.style.display = 'none';
            logoutButton.style.display = 'block';
            await loadEvents(token);
            startAutoUpdate(token); // Запускаем автообновление
        }
    } catch (error) {
        console.error('Ошибка при обработке завершения авторизации:', error);
    }
});

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, проверяем авторизацию');
    checkAuth();
});

// Добавляем обработчик для раскрывающегося списка
const pastEventsHeader = document.getElementById('past-events-header');
const pastEventsToggle = pastEventsHeader.querySelector('.past-events-toggle');

pastEventsHeader.addEventListener('click', () => {
    pastEventsToggle.classList.toggle('open');
    pastEventsList.classList.toggle('open');
});

// Создаем аудио элемент один раз при загрузке
const notificationSound = new Audio('notification.mp3');

// Слушаем события уведомлений
window.electron.onPlayNotification(() => {
    notificationSound.play().catch(err => {
        console.error('Ошибка воспроизведения звука:', err);
    });
});

// Добавляем слушатель обновления событий
window.electron.onEventsUpdated((events) => {
    console.log('Получено обновление событий');
    updateEventsDisplay(events);
});

// Функция для обновления отображения событий
function updateEventsDisplay(events) {
    if (!events || events.length === 0) {
        eventsContainer.style.display = 'block';
        currentEventElement.innerHTML = '<div class="event-title">Нет событий на сегодня</div>';
        return;
    }

    const now = new Date();
    const currentEvent = events.find(event => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);
        return now >= startTime && now <= endTime;
    });

    if (currentEvent) {
        const endTime = new Date(currentEvent.end.dateTime || currentEvent.end.date);
        const timeLeft = formatTimeLeft(endTime);

        eventsContainer.style.display = 'block';
        currentEventElement.innerHTML = `
            <div class="current-event-item">
                <div class="current-event-status">СЕЙЧАС</div>
                <div class="current-event-title">${truncateTitle(currentEvent.summary)}</div>
                <div class="current-event-time-left">
                    <span class="time-left-label">осталось</span>
                    <span class="time-left-value">${timeLeft}</span>
                </div>
            </div>
        `;
    } else {
        const nextEvent = events.find(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            return startTime > now;
        });

        if (nextEvent) {
            const startTime = new Date(nextEvent.start.dateTime || nextEvent.start.date);
            const timeUntil = formatTimeUntil(startTime);
            currentEventElement.innerHTML = `
                <div class="next-event-item">
                    <div class="next-event-time">${timeUntil}</div>
                    <div class="next-event-title">${truncateTitle(nextEvent.summary)}</div>
                </div>
            `;
        } else {
            currentEventElement.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
        }
    }
}

// Добавляем слушатель очистки событий
window.electron.onClearEvents(() => {
    clearUI();
});