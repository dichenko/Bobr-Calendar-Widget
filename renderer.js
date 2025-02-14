document.addEventListener('DOMContentLoaded', () => {
    const authButton = document.getElementById('auth-button');
    
    const eventsContainer = document.querySelector('.events-container');
    const currentEventContainer = document.getElementById('current-event-container');
    const nextEventContainer = document.getElementById('next-event-container');

    let soundPlayed = new Set(); // Изменяем на Set для хранения всех сработавших уведомлений
    let isMenuOpen = false;
    let menuTimeout;
    const dropdownMenu = document.querySelector('.dropdown-menu');
    let notificationTimes = new Set([10]); // По умолчанию включено уведомление за 10 минут

    // Функция для форматирования времени
    function formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    // Функция для обрезки длинных названий
    function truncateTitle(title) {
        // Добавляем проверку на undefined/null
        if (!title) return 'Без названия';
        return title.length > 30 ? title.substring(0, 27) + '...' : title;
    }

    // Функция для обновления интерфейса с событиями
    function updateEventsDisplay(events) {
        if (!eventsContainer || !currentEventContainer || !nextEventContainer) {
            console.error('Контейнеры событий не найдены');
            return;
        }

        // Проверяем, что events является массивом
        if (!Array.isArray(events)) {
            console.error('Ожидался массив событий, получено:', events);
            currentEventContainer.innerHTML = '<div class="no-events">Ошибка: данные событий некорректны</div>';
            nextEventContainer.innerHTML = '';
            return;
        }

        if (events.length === 0) {
            eventsContainer.style.display = 'block';
            currentEventContainer.innerHTML = '<div class="no-events">Нет событий на сегодня</div>';
            nextEventContainer.innerHTML = '';
            return;
        }

        const now = new Date();
        const currentEvent = events.find(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            const endTime = new Date(event.end.dateTime || event.end.date);
            return now >= startTime && now <= endTime;
        });

        const nextEvent = events.find(event => {
            const startTime = new Date(event.start.dateTime || event.start.date);
            return startTime > now;
        });

        if (currentEvent) {
            const endTime = new Date(currentEvent.end.dateTime || currentEvent.end.date);
            const timeLeft = Math.floor((endTime - now + 1) / (1000 * 60));
            
            // Добавим отладочную информацию
           // console.log('Текущее время:', now);
            //console.log('Время окончания:', endTime);
            //console.log('Осталось минут:', timeLeft);
            
            // Проверяем все установленные времена для уведомлений
            notificationTimes.forEach(time => {
                if (timeLeft === time && !soundPlayed.has(time)) {
                    window.electronAPI.playNotification();
                    soundPlayed.add(time);
                }
            });
            
            // Сбрасываем флаги, когда событие закончилось
            if (timeLeft <= 0) {
                soundPlayed.clear();
            }

            currentEventContainer.innerHTML = `
                <div class="current-event-item">
                    <div class="current-event-status">СЕЙЧАС</div>
                    <div class="current-event-title">${truncateTitle(currentEvent.summary)}</div>
                    <div class="current-event-time-left">${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(Math.floor(timeLeft%60)).padStart(2,'0')}</div>
                </div>`;
                

            if (nextEvent) {
                nextEventContainer.innerHTML = `
                    <div class="next-event-compact">
                        Следующее: ${truncateTitle(nextEvent.summary)}, ${formatTime(nextEvent.start.dateTime || nextEvent.start.date)}
                    </div>`;
            } else {
                nextEventContainer.innerHTML = '';
            }
        } else if (nextEvent) {
            const startTime = new Date(nextEvent.start.dateTime || nextEvent.start.date);
            const timeUntil = Math.floor((startTime - now) / (1000 * 60)); // До начала минут

            currentEventContainer.innerHTML = `
                <div class="current-event-item">
                    <div class="current-event-status">ДО НАЧАЛА</div>
                    <div class="current-event-title">${truncateTitle(nextEvent.summary)}</div>
                    <div class="current-event-time-left"> ${String(Math.floor(timeUntil/60)).padStart(2,'0')}:${String(Math.floor(timeUntil%60)).padStart(2,'0')}</div>
                </div>`;
            nextEventContainer.innerHTML = '';
        } else {
            currentEventContainer.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
            nextEventContainer.innerHTML = '';
        }

        eventsContainer.style.display = 'block'; // Показываем контейнер событий
    }

    // Функция для загрузки событий
    async function loadEvents(token) {
        try {
            const events = await window.electronAPI.getEvents(token);
            console.log('События загружены:', events);
            updateEventsDisplay(events);
        } catch (error) {
            console.error('Ошибка при загрузке событий:', error);
            currentEventContainer.innerHTML = '<div class="no-events">Ошибка при загрузке событий</div>';
        }
    }

    // Функция для проверки авторизации
    async function checkAuth() {
        try {
            const token = await window.electronAPI.getToken();
            const authContainer = document.querySelector('.auth-container');
            const eventsContainer = document.querySelector('.events-container');
            
            if (token) {
                authContainer.style.display = 'none';
                eventsContainer.style.display = 'block';
                document.querySelector('.window-controls').style.display = 'flex';
                document.querySelector('.container').style.background = 'transparent';
                document.querySelector('.container').style.padding = '5px';
            } else {
                authContainer.style.display = 'flex';
                eventsContainer.style.display = 'none';
                document.querySelector('.window-controls').style.display = 'none';
                document.querySelector('.container').style.background = 'rgba(0, 0, 0, 0.5)';
                document.querySelector('.container').style.padding = '20px';
            }
        } catch (error) {
            console.error('Ошибка при проверке авторизации:', error);
        }
    }

    // Обработчик для кнопки авторизации
    authButton.addEventListener('click', async () => {
        try {
            const tokens = await window.electronAPI.googleAuth();
            const authContainer = document.querySelector('.auth-container');
            const eventsContainer = document.querySelector('.events-container');
            
            if (tokens) {
                authContainer.style.display = 'none';
                eventsContainer.style.display = 'block';
                document.querySelector('.window-controls').style.display = 'flex';
                document.querySelector('.container').style.background = 'transparent';
                document.querySelector('.container').style.padding = '5px';
                document.querySelector('.settings-wrapper').style.display = 'block';
                
                await loadEvents(tokens);
            }
        } catch (error) {
            console.error('Ошибка при авторизации:', error);
            // В случае ошибки показываем форму авторизации
            authContainer.style.display = 'flex';
            eventsContainer.style.display = 'none';
            document.querySelector('.window-controls').style.display = 'none';
            document.querySelector('.container').style.background = 'rgba(0, 0, 0, 0.5)';
            document.querySelector('.container').style.padding = '20px';
        }
    });

    // Добавим обработчик для выхода из аккаунта
    window.electronAPI.onClearEvents(() => {
        const authContainer = document.querySelector('.auth-container');
        const eventsContainer = document.querySelector('.events-container');
        
        authContainer.style.display = 'flex';
        eventsContainer.style.display = 'none';
        document.querySelector('.window-controls').style.display = 'none';
        document.querySelector('.container').style.background = 'rgba(0, 0, 0, 0.5)';
        document.querySelector('.container').style.padding = '20px';
        document.querySelector('.settings-wrapper').style.display = 'none';
    });

    // Инициализация слушателя событий
    window.electronAPI.onEventsUpdated((events) => {
        updateEventsDisplay(events);
        //console.log('События обновлены в фоне:', new Date().toLocaleTimeString());
    });

    // Обработчик фокуса окна
    window.addEventListener('focus', async () => {
        try {
            const token = await window.electronAPI.getToken();
            if (token) {
                console.log('Обновление событий при фокусе окна');
                await loadEvents(token);
            }
        } catch (error) {
            console.error('Ошибка при обновлении событий:', error);
        }
    });

    // Инициализация интерфейса
    async function initializeUI() {
        try {
            const settings = store.get('settings');
            
            // Устанавливаем значение слайдера
            const opacitySlider = document.getElementById('opacitySlider');
            const opacityValue = document.querySelector('.opacity-value');
            opacitySlider.value = settings.opacity || 100;
            opacityValue.textContent = `${settings.opacity || 100}%`;
            
            // Устанавливаем чекбоксы уведомлений
            const savedTimes = settings.notificationTimes || [10];
            const notificationCheckboxes = document.querySelectorAll('.notification-options input[type="checkbox"]');
            notificationCheckboxes.forEach(checkbox => {
                checkbox.checked = savedTimes.includes(parseInt(checkbox.value));
            });
            
            // Обновляем набор времен уведомлений
            notificationTimes = new Set(savedTimes);
        } catch (error) {
            console.error('Ошибка при загрузке настроек:', error);
        }
        
        document.getElementById('auth-button').style.display = 'none';
        document.querySelector('.events-container').style.display = 'block';
        document.querySelector('.window-controls').style.display = 'flex';
        document.querySelector('.dropdown-menu').style.display = 'none'; // Сначала скрываем меню
        document.querySelector('.settings-wrapper').style.display = 'block'; // Показываем обертку настроек
        console.log('UI initialized');
    }

    // Пример вызова инициализации после авторизации
    window.electronAPI.onAuthComplete(() => {
        initializeUI();
    });

    // Проверяем авторизацию при загрузке страницы
    checkAuth();

    // Обработчики для кнопок управления окном
    const minimizeButton = document.getElementById('minimizeButton');
    const closeButton = document.getElementById('closeButton');

    minimizeButton.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    closeButton.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Обработчик для кнопки настроек
    const settingsButton = document.getElementById('settingsButton');
    const dropdownItems = document.querySelectorAll('.dropdown-item');

    // Открытие меню по клику
    settingsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = 'block';
    });

    // Отслеживание мыши над меню
    dropdownMenu.addEventListener('mouseenter', () => {
        clearTimeout(menuTimeout);
    });

    // Отслеживание ухода мыши с меню
    dropdownMenu.addEventListener('mouseleave', () => {
        menuTimeout = setTimeout(() => {
            dropdownMenu.style.display = 'none';
        }, 2000); // 2 секунды
    });

    // Отслеживание мыши над кнопкой настроек
    settingsButton.addEventListener('mouseenter', () => {
        clearTimeout(menuTimeout);
    });

    // Отслеживание ухода мыши с кнопки настроек
    settingsButton.addEventListener('mouseleave', () => {
        menuTimeout = setTimeout(() => {
            dropdownMenu.style.display = 'none';
        }, 2000); // 2 секунды
    });

    // Обработка выбора пункта меню
    dropdownItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = 'none';
            const action = e.target.dataset.action;
            
            // Добавляем логирование
            console.log('Нажата кнопка:', action);
            
            if (action === 'logout') {
                try {
                    await window.electronAPI.logout();
                    const authContainer = document.querySelector('.auth-container');
                    const eventsContainer = document.querySelector('.events-container');
                    
                    // Показываем форму авторизации
                    authContainer.style.display = 'flex';
                    eventsContainer.style.display = 'none';
                    document.querySelector('.window-controls').style.display = 'none';
                    document.querySelector('.container').style.background = 'rgba(0, 0, 0, 0.5)';
                    document.querySelector('.container').style.padding = '20px';
                    document.querySelector('.settings-wrapper').style.display = 'none';
                    
                    // Очищаем контейнеры с событиями
                    document.getElementById('current-event-container').innerHTML = '';
                    document.getElementById('next-event-container').innerHTML = '';
                } catch (error) {
                    console.error('Ошибка при выходе из аккаунта:', error);
                }
            }
        });
    });

    // Добавляем после существующих обработчиков
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValue = document.querySelector('.opacity-value');

    opacitySlider.addEventListener('input', (e) => {
        e.stopPropagation(); // Предотвращаем закрытие меню
        const opacity = e.target.value;
        opacityValue.textContent = `${opacity}%`;
        window.electronAPI.setOpacity(opacity / 100);
    });

    // Предотвращаем закрытие меню при взаимодействии со слайдером
    opacitySlider.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Добавляем после инициализации DOM
    const notificationCheckboxes = document.querySelectorAll('.notification-options input[type="checkbox"]');

    notificationCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation(); // Предотвращаем закрытие меню
            const minutes = parseInt(checkbox.value);
            if (checkbox.checked) {
                notificationTimes.add(minutes);
            } else {
                notificationTimes.delete(minutes);
            }
            // Сохраняем настройки
            window.electronAPI.setNotificationTimes(Array.from(notificationTimes));
        });

        // Предотвращаем закрытие меню при клике на чекбокс
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
});