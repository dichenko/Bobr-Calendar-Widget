// Добавьте в начало файла для отладки
console.log('Инициализация API:', window.electronAPI);

// Ждем полной загрузки DOM перед инициализацией
document.addEventListener('DOMContentLoaded', () => {
    // Отладка
    console.log('DOM загружен, начинаем инициализацию...');
    
    // Получаем элементы DOM с отладочной информацией
    const authButton = document.getElementById('auth-button');
    console.log('auth-button найден:', !!authButton);

    const logoutButton = document.getElementById('logoutButton');
    console.log('logoutButton найден:', !!logoutButton);

    const eventsContainer = document.querySelector('.events-container');
    console.log('events-container найден:', !!eventsContainer);

    const currentEventContainer = document.getElementById('current-event-container');
    console.log('current-event-container найден:', !!currentEventContainer);

    const nextEventContainer = document.getElementById('next-event-container');
    console.log('next-event-container найден:', !!nextEventContainer);

    // Проверяем наличие всех необходимых элементов
    if (!authButton || !logoutButton || !eventsContainer || !currentEventContainer || !nextEventContainer) {
        console.error('Не все необходимые элементы DOM найдены');
        return;
    }

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
            if (!token || !token.access_token) {
                console.error('Невалидный токен:', token);
                throw new Error('Токен отсутствует или недействителен');
            }

            const events = await window.electronAPI.getEvents(token);
            console.log('Все полученные события:', events);
            
            if (!events || events.length === 0) {
                if (eventsContainer && currentEventContainer) {
                    eventsContainer.style.display = 'block';
                    currentEventContainer.innerHTML = '<div class="event-title">Нет событий на сегодня</div>';
                }
                return;
            }

            updateEventsDisplay(events);
        } catch (error) {
            console.error('Ошибка при загрузке событий:', error);
            if (currentEventContainer) {
                currentEventContainer.innerHTML = '<div class="event-title">Ошибка при загрузке событий</div>';
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
        if (authButton) authButton.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'none';
        if (eventsContainer) eventsContainer.style.display = 'none';
        if (currentEventContainer) currentEventContainer.innerHTML = '';
    }

    // Добавляем обработчики только если элементы существуют
    if (authButton) {
        authButton.addEventListener('click', async () => {
            console.log('Кнопка авторизации нажата');
            try {
                const tokens = await window.electronAPI.googleAuth();
                authButton.style.display = 'none';
                if (logoutButton) logoutButton.style.display = 'block';
                await loadEvents(tokens);
            } catch (error) {
                console.error('Ошибка при авторизации:', error);
                authButton.style.display = 'block';
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await window.electronAPI.logout();
                clearUI();
                console.log('Успешный выход');
            } catch (error) {
                console.error('Ошибка при выходе:', error);
            }
        });
    }

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
    checkAuth();

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
        if (!eventsContainer) {
            console.error('Контейнер событий не найден');
            return;
        }

        const currentEventContainer = document.getElementById('current-event-container');
        const nextEventContainer = document.getElementById('next-event-container');

        if (!currentEventContainer || !nextEventContainer) {
            console.error('Контейнеры событий не найдены');
            return;
        }

        if (!events || events.length === 0) {
            eventsContainer.style.display = 'block';
            currentEventContainer.innerHTML = `
                <div class="no-events">
                    <div class="no-events-text">Нет событий на сегодня</div>
                </div>`;
            nextEventContainer.innerHTML = '';
            return;
        }

        const now = new Date();
        const currentEvent = events.find(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            const endTime = new Date(event.end.dateTime || event.end.date);
            return now >= startTime && now <= endTime;
        });

        eventsContainer.style.display = 'block';

        // Находим следующее событие
        const nextEvent = events.find(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            return startTime > now;
        });

        // Функция форматирования времени
        function formatEventTime(startTime, endTime) {
            const start = formatTime(startTime);
            const end = formatTime(endTime);
            return `${start} - ${end}`;
        }

        if (currentEvent) {
            const endTime = new Date(currentEvent.end.dateTime || currentEvent.end.date);
            const timeLeft = formatTimeLeft(endTime);

            currentEventContainer.innerHTML = `
                <div class="current-event-item">
                    <div class="current-event-status">СЕЙЧАС</div>
                    <div class="current-event-title">${truncateTitle(currentEvent.summary)}</div>
                    <div class="current-event-time-left">
                        <span class="time-left-value">${timeLeft}</span>
                    </div>
                </div>`;

            if (nextEvent) {
                nextEventContainer.innerHTML = `
                    <div class="next-event-compact">
                        ${truncateTitle(nextEvent.summary)}, ${formatEventTime(
                            nextEvent.start.dateTime || nextEvent.start.date,
                            nextEvent.end.dateTime || nextEvent.end.date
                        )}
                    </div>`;
            } else {
                nextEventContainer.innerHTML = '';
            }
        } else if (nextEvent) {
            const startTime = new Date(nextEvent.start.dateTime || nextEvent.start.date);
            const timeUntil = formatTimeUntil(startTime);

            currentEventContainer.innerHTML = `
                <div class="current-event-item">
                    <div class="current-event-status">ДО НАЧАЛА</div>
                    <div class="current-event-title">${truncateTitle(nextEvent.summary)}</div>
                    <div class="current-event-time-left">
                        <span class="time-left-value">${timeUntil}</span>
                    </div>
                </div>`;
            nextEventContainer.innerHTML = '';
        } else {
            currentEventContainer.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
            nextEventContainer.innerHTML = '';
        }
    }

    // Добавляем слушатель очистки событий
    window.electron.onClearEvents(() => {
        clearUI();
    });
});