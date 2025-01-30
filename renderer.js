// Добавьте в начало файла для отладки
console.log('Инициализация API:', window.electronAPI);

// Получаем элементы
const authButton = document.getElementById('auth-button');
const logoutButton = document.getElementById('logoutButton');
const eventsContainer = document.querySelector('.events-container');
const currentEventElement = document.getElementById('current-event');

// Проверяем, что элементы найдены
if (!authButton) console.error('Элемент auth-button не найден');
if (!logoutButton) console.error('Элемент logoutButton не найден');
if (!eventsContainer) console.error('Элемент events не найден');
if (!currentEventElement) console.error('Элемент current-event не найден');

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

// Функция загрузки событий
async function loadEvents(token) {
    try {
        const events = await window.electronAPI.getEvents(token);
        console.log('Все полученные события:', events);
        
        if (!events || events.length === 0) {
            console.log('Нет событий вообще');
            eventsContainer.style.display = 'block';
            currentEventElement.innerHTML = '<div class="event-title">Нет событий на сегодня</div>';
            return;
        }

        // Фильтруем события только за сегодня
        const todayEvents = events.filter(event => {
            console.log('Проверяем событие:', event.summary);
            console.log('Данные о начале:', event.start);
            
            // Получаем dateTime или date из объекта start
            const startDateTime = event.start.dateTime || event.start.date;
            const endDateTime = event.end.dateTime || event.end.date;
            
            console.log('Время начала события:', startDateTime);
            return isToday(startDateTime);
        });

        console.log('События на сегодня после фильтрации:', todayEvents);

        // Сортируем по времени начала
        todayEvents.sort((a, b) => {
            const timeA = new Date(a.start.dateTime || a.start.date);
            const timeB = new Date(b.start.dateTime || b.start.date);
            return timeA - timeB;
        });

        // Показываем контейнер событий
        eventsContainer.style.display = 'block';

        // Отображаем все события за сегодня
        if (todayEvents.length > 0) {
            currentEventElement.innerHTML = todayEvents.map(event => {
                const startTime = formatTime(new Date(event.start.dateTime || event.start.date));
                const endTime = formatTime(new Date(event.end.dateTime || event.end.date));
                return `
                    <div class="event-item">
                        <div class="event-title">${event.summary}</div>
                        <div class="event-time">${startTime} - ${endTime}</div>
                    </div>
                `;
            }).join('');
        } else {
            console.log('Нет событий на сегодня после фильтрации');
            currentEventElement.innerHTML = '<div class="event-title">Нет событий на сегодня</div>';
        }

    } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
        currentEventElement.innerHTML = '<div class="event-title">Ошибка при загрузке событий</div>';
    }
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
    currentEventElement.innerHTML = '';
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

// Обновляем обработчик выхода
logoutButton.addEventListener('click', async () => {
    console.log('Нажата кнопка выхода');
    try {
        await window.electronAPI.logout();
        clearUI(); // Используем функцию очистки UI
        stopAutoUpdate();
        console.log('Выход выполнен успешно');
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