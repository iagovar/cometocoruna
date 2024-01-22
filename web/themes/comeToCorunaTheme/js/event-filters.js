function toggleFreeEvents() {
    // Words that define free events
    const freeWords = ['grat', 'free', 'balde', 'libre'];
    // Load all events
    const events = document.querySelectorAll('div.event');

    for (let event of events) {
        const thisEventPrice = event.getAttribute('data-price');
        const isThisEventFree = freeWords.some(word => thisEventPrice.toLowerCase().includes(word.toLowerCase()));
        const filters = JSON.parse(event.dataset.filters);

       if (!isThisEventFree && filters.free == "hide") {
            filters.free = "show";
       } else if (!isThisEventFree && filters.free == "show") {
            filters.free = "hide";
       } else if (!isThisEventFree && filters.free == undefined) {
            filters.free = "hide";
       }

       event.dataset.filters = JSON.stringify(filters);
    }

    toggleVisibleEvents();
}

function filterByCategories() {
    const categoriesList = Array.from(document.querySelectorAll('input:checked')).map(input => input.value);
    const events = document.querySelectorAll('div.event');

    for (let event of events) {
        const thisEventCategories = event.dataset.categories;
        const hasListedCategories = categoriesList.some(category => thisEventCategories.toLowerCase().includes(category.toLowerCase()));
        const filters = JSON.parse(event.dataset.filters);

        if (hasListedCategories || event.dataset.categories.length == 0) {
            filters.categories = "show";
        } else if (!hasListedCategories) {
            filters.categories = "hide";
        }

        event.dataset.filters = JSON.stringify(filters);

    }

    toggleVisibleEvents();
}

function filterByString(value) {
    const searchTerm = value.toLowerCase();
    const events = document.querySelectorAll('div.event');

    for (let event of events) {
        const eventText = event.textContent.toLowerCase();
        const filters = JSON.parse(event.dataset.filters);

        if (eventText.includes(searchTerm)) {
            filters.search = "show";
        } else if (!eventText.includes(searchTerm)) {
            filters.search = "hide";
        }

        event.dataset.filters = JSON.stringify(filters);
    }

    toggleVisibleEvents();
}

function toggleVisibleEvents() {
    const events = document.querySelectorAll('div.event');

    for (let event of events) {
        const filters = JSON.parse(event.dataset.filters);
        const hasAHidedFilter = Object.values(filters).some(filter => filter == "hide");

        if (hasAHidedFilter) {
            event.style.display = 'none';    
        } else {
            event.removeAttribute('style');
        }
    }
}