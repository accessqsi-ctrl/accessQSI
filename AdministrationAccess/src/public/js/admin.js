(() => {
    const body = document.body;
    const openButton = document.querySelector('[data-open-menu]');
    const closeButton = document.querySelector('[data-close-menu]');
    const overlay = document.getElementById('mobile-overlay');
    const setMenu = (isOpen) => {
        body.classList.toggle('menu-open', isOpen);
        openButton?.setAttribute('aria-expanded', String(isOpen));
        overlay?.setAttribute('aria-hidden', String(!isOpen));
    };
    openButton?.addEventListener('click', () => setMenu(true));
    closeButton?.addEventListener('click', () => setMenu(false));
    overlay?.addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', (event) => event.key === 'Escape' && setMenu(false));

    document.querySelectorAll('[data-confirm]').forEach((button) => {
        button.addEventListener('click', (event) => {
            if (!window.confirm(button.dataset.confirm)) event.preventDefault();
        });
    });
})();
