// Получаем элементы сразу после загрузки страницы
const timerElement = document.getElementById('timer');
const authButton = document.getElementById('auth-button');

// Проверяем, что элементы найдены и устанавливаем начальную видимость кнопки
if (!timerElement) console.error('Элемент timer не найден');
if (!authButton) console.error('Элемент auth-button не найден');
else authButton.style.display = 'block'; // Явно показываем кнопку при загрузке

console.log('Элементы DOM загружены:', { 
    timerElement: !!timerElement, 
    authButton: !!authButton,
    authButtonDisplay: authButton ? authButton.style.display : 'element not found'
});

let currentEvent = null;

// Обработчик клика по кнопке
authButton.addEventListener('click', async () => {
    console.log('Кнопка нажата');
    try {
        const tokens = await window.electronAPI.googleAuth();
        console.log('Авторизация успешна');
        authButton.style.display = 'none';
        loadEvents(tokens);
    } catch (error) {
        console.error('Ошибка при авторизации:', error);
        authButton.style.display = 'block';
    }
});

// Функция загрузки событий
async function loadEvents(token) {
    if (!token || !token.access_token) {
        console.log('Токен отсутствует или недействителен');
        return;
    }

    try {
        const events = await window.electronAPI.getEvents(token);
        console.log('Получены события:', events);
        if (events && events.length > 0) {
            currentEvent = {
                summary: events[0].summary,
                start: new Date(events[0].start),
                end: new Date(events[0].end)
            };
            updateTimer();
        }
    } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
    }
}

// Проверяем токен при загрузке
async function checkAuth() {
    try {
        const token = await window.electronAPI.getToken();
        console.log('Проверка токена:', token ? 'токен найден' : 'токен не найден');
        
        if (token && token.access_token) {
            console.log('Токен найден, загружаем события');
            authButton.style.display = 'none';
            await loadEvents(token);
        } else {
            console.log('Токен не найден или недействителен');
            authButton.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        authButton.style.display = 'block';
    }
}

function updateTimer() {
    if (!currentEvent) return;

    const now = new Date();
    const start = currentEvent.start;
    const end = currentEvent.end;

    if (now < start) {
        // Событие еще не началось
        const diff = start - now;
        timerElement.textContent = formatTime(diff);
    } else if (now < end) {
        // Событие идет
        const diff = end - now;
        timerElement.textContent = formatTime(diff);
    } else {
        // Событие закончилось
        timerElement.textContent = "00:00:00";
    }
}

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor(ms / 1000 / 60 / 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Вызываем проверку при загрузке страницы
checkAuth();