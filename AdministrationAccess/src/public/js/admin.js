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

    const subscriptionDialog = document.querySelector('[data-subscription-dialog]');
    const planSelect = subscriptionDialog?.querySelector('[data-plan-select]');
    const intervalField = subscriptionDialog?.querySelector('[data-interval-field]');
    const syncIntervalField = () => {
        if (!planSelect || !intervalField) return;
        const isDiscovery = planSelect.value === 'DISCOVERY';
        intervalField.hidden = isDiscovery;
        intervalField.querySelector('select').disabled = isDiscovery;
    };
    document.querySelector('[data-open-subscription-dialog]')?.addEventListener('click', () => {
        syncIntervalField();
        subscriptionDialog?.showModal();
    });
    document.querySelectorAll('[data-close-subscription-dialog]').forEach((button) => {
        button.addEventListener('click', () => subscriptionDialog?.close());
    });
    planSelect?.addEventListener('change', syncIntervalField);

    const passwordDialog = document.querySelector('[data-password-dialog]');
    const passwordDialogForm = passwordDialog?.querySelector('[data-password-dialog-form]');
    const passwordInput = passwordDialog?.querySelector('[data-password-input]');
    const passwordError = passwordDialog?.querySelector('[data-password-error]');
    let pendingForm = null;

    document.querySelectorAll('form[data-password-confirm]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            if (form.dataset.passwordConfirmed === 'true') return;
            event.preventDefault();
            pendingForm = form;
            passwordDialog.querySelector('[data-password-dialog-title]').textContent = form.dataset.confirmTitle || 'Confirmer l’action';
            passwordDialog.querySelector('[data-password-dialog-message]').textContent = form.dataset.confirmMessage || 'Saisissez votre mot de passe pour continuer.';
            passwordInput.value = '';
            passwordError.hidden = true;
            passwordDialog.showModal();
            window.setTimeout(() => passwordInput.focus(), 0);
        });
    });

    passwordDialogForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!pendingForm || !passwordInput.value) {
            passwordError.hidden = false;
            passwordInput?.focus();
            return;
        }
        let hiddenPassword = pendingForm.querySelector('input[name="superAdminPassword"]');
        if (!hiddenPassword) {
            hiddenPassword = document.createElement('input');
            hiddenPassword.type = 'hidden';
            hiddenPassword.name = 'superAdminPassword';
            pendingForm.appendChild(hiddenPassword);
        }
        const formToSubmit = pendingForm;
        hiddenPassword.value = passwordInput.value;
        formToSubmit.dataset.passwordConfirmed = 'true';
        passwordDialog.close();
        passwordInput.value = '';
        pendingForm = null;
        formToSubmit.requestSubmit();
    });
    document.querySelectorAll('[data-close-password-dialog]').forEach((button) => {
        button.addEventListener('click', () => {
            passwordDialog?.close();
            pendingForm = null;
            if (passwordInput) passwordInput.value = '';
        });
    });
    [subscriptionDialog, passwordDialog].forEach((dialog) => dialog?.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    }));
    passwordDialog?.addEventListener('close', () => {
        if (passwordInput) passwordInput.value = '';
        passwordError.hidden = true;
        pendingForm = null;
    });
})();
