// Глобальная переменная для хранения текущего поискового запроса
let currentSearchQuery = '';
// Таймер для debounce при автодополнении
let autocompleteTimer = null;

// Функция создания кнопки пагинации
function createPageBtn(page, classes = []) {
    let btn = document.createElement('button');
    classes.push('btn');
    for (let cls of classes) {
        btn.classList.add(cls);
    }
    btn.dataset.page = page;
    btn.innerHTML = page;
    return btn;
}

// Функция отрисовки элементов пагинации
function renderPaginationElement(info) {
    let btn;
    let paginationContainer = document.querySelector('.pagination');
    paginationContainer.innerHTML = '';

    // Кнопка "Первая страница"
    btn = createPageBtn(1, ['first-page-btn']);
    btn.innerHTML = 'Первая страница';
    if (info.current_page == 1) {
        btn.style.visibility = 'hidden';
    }
    paginationContainer.append(btn);

    // Контейнер с кнопками страниц
    let buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('pages-btns');
    paginationContainer.append(buttonsContainer);

    // Расчет диапазона отображаемых страниц
    let start = Math.max(info.current_page - 2, 1);
    let end = Math.min(info.current_page + 2, info.total_pages);

    // Создание кнопок страниц
    for (let i = start; i <= end; i++) {
        buttonsContainer.append(
            createPageBtn(i, i == info.current_page ? ['active'] : [])
        );
    }

    // Кнопка "Последняя страница"
    btn = createPageBtn(info.total_pages, ['last-page-btn']);
    btn.innerHTML = 'Последняя страница';
    if (info.current_page == info.total_pages) {
        btn.style.visibility = 'hidden';
    }
    paginationContainer.append(btn);
}

// Обработчик изменения количества записей на странице
function perPageBtnHandler(event) {
    downloadData(1);
}

// Функция установки информации о пагинации
function setPaginationInfo(info) {
    document.querySelector('.total-count').innerHTML = info.total_count || 0;
    let start = info.total_count > 0 ? (info.current_page - 1) * info.per_page + 1 : 0;
    document.querySelector('.current-interval-start').innerHTML = start;
    let end = Math.min(info.total_count, start + info.per_page - 1);
    document.querySelector('.current-interval-end').innerHTML = end;
}

// Обработчик клика по кнопкам пагинации
function pageBtnHandler(event) {
    if (event.target.dataset.page) {
        downloadData(event.target.dataset.page);
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// Создание элемента с автором
function createAuthorElement(record) {
    let user = record.user || { 'name': { 'first': '', 'last': '' } };
    let authorElement = document.createElement('div');
    authorElement.classList.add('author-name');
    authorElement.innerHTML = user.name.first + ' ' + user.name.last;
    return authorElement;
}

// Создание элемента с количеством голосов
function createUpvotesElement(record) {
    let upvotesElement = document.createElement('div');
    upvotesElement.classList.add('upvotes');
    upvotesElement.innerHTML = record.upvotes;
    return upvotesElement;
}

// Создание подвала элемента
function createFooterElement(record) {
    let footerElement = document.createElement('div');
    footerElement.classList.add('item-footer');
    footerElement.append(createAuthorElement(record));
    footerElement.append(createUpvotesElement(record));
    return footerElement;
}

// Создание контента элемента
function createContentElement(record) {
    let contentElement = document.createElement('div');
    contentElement.classList.add('item-content');
    contentElement.innerHTML = record.text;
    return contentElement;
}

// Создание элемента списка фактов
function createListItemElement(record) {
    let itemElement = document.createElement('div');
    itemElement.classList.add('facts-list-item');
    itemElement.append(createContentElement(record));
    itemElement.append(createFooterElement(record));
    return itemElement;
}

// Отрисовка записей
function renderRecords(records) {
    let factsList = document.querySelector('.facts-list');
    factsList.innerHTML = '';

    if (records.length === 0) {
        // Показываем сообщение об отсутствии результатов
        let noResults = document.createElement('div');
        noResults.classList.add('no-results');
        noResults.innerHTML = 'По вашему запросу ничего не найдено';
        factsList.append(noResults);
        return;
    }

    for (let i = 0; i < records.length; i++) {
        factsList.append(createListItemElement(records[i]));
    }
}

// Функция создания выпадающего списка автодополнения
function createAutocompleteDropdown() {
    let dropdown = document.querySelector('.autocomplete-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.classList.add('autocomplete-dropdown');

        // Находим форму поиска и делаем её позиционированной
        let searchForm = document.querySelector('.search-form');
        searchForm.style.position = 'relative';
        searchForm.appendChild(dropdown);
    }
    return dropdown;
}

// Функция получения вариантов автодополнения
function fetchAutocompleteSuggestions(query) {
    // Не отправляем запрос, если запрос пустой или слишком короткий
    if (!query || query.length < 1) {
        hideAutocompleteDropdown();
        return;
    }

    let url = new URL('http://cat-facts-api.std-900.ist.mospolytech.ru/autocomplete');
    url.searchParams.append('q', query);

    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'json';

    xhr.onload = function () {
        if (this.status === 200 && this.response && this.response.length > 0) {
            showAutocompleteSuggestions(this.response);
        } else {
            hideAutocompleteDropdown();
        }
    };

    xhr.onerror = function () {
        console.error('Ошибка при получении подсказок');
        hideAutocompleteDropdown();
    };

    xhr.send();
}

// Функция отображения вариантов автодополнения
function showAutocompleteSuggestions(suggestions) {
    let dropdown = createAutocompleteDropdown();
    dropdown.innerHTML = '';

    suggestions.forEach(suggestion => {
        let item = document.createElement('div');
        item.classList.add('autocomplete-item');

        // Выделяем совпадающую часть текста
        let searchField = document.querySelector('.search-field');
        let query = searchField.value;
        let regex = new RegExp(`(${query})`, 'gi');
        let highlightedText = suggestion.replace(regex, '<strong>$1</strong>');
        item.innerHTML = highlightedText;

        // Обработчик клика по варианту
        item.addEventListener('click', function () {
            searchField.value = suggestion;
            hideAutocompleteDropdown();
            // Автоматически выполняем поиск при выборе варианта
            currentSearchQuery = suggestion;
            downloadData(1);
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

// Функция скрытия выпадающего списка
function hideAutocompleteDropdown() {
    let dropdown = document.querySelector('.autocomplete-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// Обработчик поиска
function searchHandler(event) {
    event.preventDefault();
    let searchField = document.querySelector('.search-field');
    currentSearchQuery = searchField.value.trim();
    downloadData(1);
    hideAutocompleteDropdown();
}

// Обработчик ввода в поле поиска (для автодополнения)
function searchInputHandler(event) {
    let query = event.target.value.trim();

    // Очищаем предыдущий таймер
    if (autocompleteTimer) {
        clearTimeout(autocompleteTimer);
    }

    // Устанавливаем новый таймер (debounce)
    autocompleteTimer = setTimeout(() => {
        fetchAutocompleteSuggestions(query);
    }, 300);
}

// Обработчик клика вне выпадающего списка
function handleClickOutside(event) {
    let searchForm = document.querySelector('.search-form');
    let dropdown = document.querySelector('.autocomplete-dropdown');

    if (dropdown && !searchForm.contains(event.target)) {
        hideAutocompleteDropdown();
    }
}

// Основная функция загрузки данных
function downloadData(page = 1) {
    let factsList = document.querySelector('.facts-list');
    let url = new URL(factsList.dataset.url);
    let perPage = document.querySelector('.per-page-btn').value;

    // Добавляем параметры запроса
    url.searchParams.append('page', page);
    url.searchParams.append('per-page', perPage);

    // Добавляем поисковый запрос, если он есть
    if (currentSearchQuery) {
        url.searchParams.append('q', currentSearchQuery);
    }

    // Показываем индикатор загрузки
    factsList.innerHTML = '<div class="no-results">Загрузка...</div>';

    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'json';

    xhr.onload = function () {
        if (this.status === 200 && this.response) {
            if (this.response.records) {
                renderRecords(this.response.records);
            }
            if (this.response['_pagination']) {
                setPaginationInfo(this.response['_pagination']);
                renderPaginationElement(this.response['_pagination']);
            }
        } else {
            factsList.innerHTML = '<div class="no-results">Ошибка загрузки данных</div>';
        }
    };

    xhr.onerror = function () {
        factsList.innerHTML = '<div class="no-results">Ошибка соединения с сервером</div>';
    };

    xhr.send();
}

// Инициализация при загрузке страницы
window.onload = function () {
    // Загружаем начальные данные
    downloadData();

    // Назначаем обработчики событий
    document.querySelector('.pagination').addEventListener('click', pageBtnHandler);
    document.querySelector('.per-page-btn').addEventListener('change', perPageBtnHandler);

    // Обработчики для поиска
    let searchBtn = document.querySelector('.search-btn');
    let searchField = document.querySelector('.search-field');

    searchBtn.addEventListener('click', searchHandler);

    // Обработчик клавиши Enter в поле поиска
    searchField.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchHandler(event);
        }
    });

    // Обработчик для автодополнения
    searchField.addEventListener('input', searchInputHandler);

    // Закрытие выпадающего списка при клике вне его
    document.addEventListener('click', handleClickOutside);

    // Очистка таймера при уходе со страницы
    window.addEventListener('beforeunload', function () {
        if (autocompleteTimer) {
            clearTimeout(autocompleteTimer);
        }
    });
};