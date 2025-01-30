// Добавьте в начало файла для отладки
console.log('Инициализация API:', window.electronAPI);

// Получаем элементы сразу после загрузки страницы
const timerElement = document.getElementById('timer');
const authButton = document.getElementById('auth-button');
const logoutButton = document.getElementById('logoutButton');
const eventsContainer = document.getElementById('events');

// Проверяем, что элементы найдены
if (!timerElement) console.error('Элемент timer не найден');
if (!authButton) console.error('Элемент auth-button не найден');
if (!logoutButton) console.error('Элемент logoutButton не найден');
if (!eventsContainer) console.error('Элемент events не найден');

let currentEvent = null;

// Функция обновления таймера
function updateTimer() {
    if (!currentEvent) {
        if (timerElement) timerElement.textContent = 'Нет активных событий';
        return;
    }

    const now = new Date();
    const start = new Date(currentEvent.start);
    const end = new Date(currentEvent.end);

    if (now < start) {
        const diff = start - now;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        timerElement.textContent = `До начала: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (now < end) {
        const diff = end - now;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        timerElement.textContent = `До конца: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
        timerElement.textContent = 'Событие завершено';
    }
}

// Функция загрузки событий
async function loadEvents(token) {
    try {
        const events = await window.electronAPI.getEvents(token);
        console.log('Получены события:', events);
        
        if (events && events.length > 0) {
            currentEvent = {
                summary: events[0].summary,
                start: events[0].start.dateTime || events[0].start.date,
                end: events[0].end.dateTime || events[0].end.date
            };
            // Запускаем обновление таймера
            updateTimer();
            setInterval(updateTimer, 1000);
            
            // Отображаем события в контейнере
            eventsContainer.innerHTML = events.map(event => `
                <div class="event">
                    <h3>${event.summary}</h3>
                    <p>Начало: ${new Date(event.start.dateTime || event.start.date).toLocaleString()}</p>
                    <p>Конец: ${new Date(event.end.dateTime || event.end.date).toLocaleString()}</p>
                </div>
            `).join('');
        } else {
            currentEvent = null;
            updateTimer();
            eventsContainer.innerHTML = '<p>Нет предстоящих событий</p>';
        }
    } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
        eventsContainer.innerHTML = '<p>Ошибка при загрузке событий</p>';
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

// Обработчик клика по кнопке авторизации
authButton.addEventListener('click', async () => {
    console.log('Кнопка нажата');
    try {
        const tokens = await window.electronAPI.googleAuth();
        console.log('Авторизация успешна');
        // Сразу обновляем UI и загружаем события
        authButton.style.display = 'none';
        logoutButton.style.display = 'block';
        await loadEvents(tokens); // Загружаем события сразу после получения токенов
    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        authButton.style.display = 'block';
    }
});

// Обработчик для кнопки выхода
logoutButton.addEventListener('click', async () => {
    console.log('Начало выхода из системы');
    try {
        await window.electronAPI.logout();
        await checkAuth(); // Проверяем и обновляем состояние после выхода
        if (eventsContainer) {
            eventsContainer.innerHTML = '';
        }
        currentEvent = null;
        updateTimer();
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    }
});

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, проверяем авторизацию');
    checkAuth();
});

// Добавляем слушатель события завершения авторизации
window.electronAPI.onAuthComplete(async () => {
    console.log('Получено событие завершения авторизации');
    try {
        const token = await window.electronAPI.getToken();
        if (token && token.access_token) {
            authButton.style.display = 'none';
            logoutButton.style.display = 'block';
            await loadEvents(token);
        }
    } catch (error) {
        console.error('Ошибка при обработке завершения авторизации:', error);
    }
});