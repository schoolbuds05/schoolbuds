import './bootstrap';

import Alpine from 'alpinejs';

window.Alpine = Alpine;

Alpine.start();

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = document.getElementById(button.getAttribute('aria-controls'));

    if (!input) return;

    button.addEventListener('click', () => {
        const showPassword = input.type === 'password';
        input.type = showPassword ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(showPassword));
        button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
    });
});

const portalSidebarScrollKey = 'portal-sidebar-scroll';

if (document.body.classList.contains('portal-shell')) {
    const validationStateElement = document.getElementById('portal-validation-state');
    const validationState = validationStateElement ? JSON.parse(validationStateElement.textContent) : {};
    const forms = [...document.forms];
    const normalizeFieldName = (name) => name.replace(/\[\]/g, '').replace(/\[([^\]]+)\]/g, '.$1');
    const clearFieldError = (field) => {
        const error = field.parentElement.querySelector('[data-portal-field-error]');
        if (error) {
            error.remove();
            const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id !== error.id);
            if (describedBy.length) {
                field.setAttribute('aria-describedby', describedBy.join(' '));
            } else {
                field.removeAttribute('aria-describedby');
            }
        }

        field.removeAttribute('aria-invalid');
        field.classList.remove('portal-validation-invalid');
    };
    const showFieldError = (field, message) => {
        clearFieldError(field);

        const error = document.createElement('p');
        error.id = `portal-field-error-${forms.indexOf(field.form)}-${[...field.form.elements].indexOf(field)}`;
        error.dataset.portalFieldError = '';
        error.className = 'portal-field-error';
        error.setAttribute('role', 'alert');
        error.textContent = message;
        field.insertAdjacentElement('afterend', error);
        field.setAttribute('aria-invalid', 'true');
        const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (!describedBy.includes(error.id)) {
            describedBy.push(error.id);
            field.setAttribute('aria-describedby', describedBy.join(' '));
        }
        field.classList.add('portal-validation-invalid');
    };
    const validationMessage = (field) => {
        const validity = field.validity;
        if (validity.valueMissing) return 'This field is required.';
        if (validity.typeMismatch) return field.type === 'email' ? 'Enter a valid email address.' : 'Enter a valid value.';
        if (validity.badInput) return 'Enter a valid value.';
        if (validity.rangeUnderflow) return `Enter a value of at least ${field.min}.`;
        if (validity.rangeOverflow) return `Enter a value no greater than ${field.max}.`;
        if (validity.tooShort) return `Enter at least ${field.minLength} characters.`;
        if (validity.tooLong) return `Enter no more than ${field.maxLength} characters.`;
        if (validity.patternMismatch) return 'Enter a value in the required format.';
        return 'Enter a valid value.';
    };
    const showModal = (modal, trigger = null) => {
        if (!modal) return;

        modal._modalTrigger = trigger || modal._modalTrigger;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.setAttribute('aria-hidden', 'false');
        (modal.querySelector('[data-modal-autofocus]') || modal).focus({ preventScroll: true });
    };
    const hideModal = (modal) => {
        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.setAttribute('aria-hidden', 'true');
        modal._modalTrigger?.focus({ preventScroll: true });
    };

    document.querySelectorAll('[data-modal-open]').forEach((button) => {
        button.addEventListener('click', () => {
            showModal(document.getElementById(button.dataset.modalOpen), button);
        });
    });
    document.querySelectorAll('[data-modal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            hideModal(document.getElementById(button.dataset.modalClose));
        });
    });
    document.querySelectorAll('[data-filter-toggle]').forEach((button) => {
        const menuId = button.dataset.filterToggle;
        const menu = menuId ? document.getElementById(menuId) : button.closest('.mb-4')?.querySelector('[data-filter-menu]');
        if (!menu) return;

        button.addEventListener('click', () => {
            const isHidden = menu.classList.toggle('hidden');
            button.setAttribute('aria-expanded', String(!isHidden));
        });
    });
    document.querySelectorAll('[data-modal]').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) hideModal(modal);
        });
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideModal(document.querySelector('[data-modal]:not(.hidden)'));
        }
    });

    forms.forEach((form, index) => {
        form.noValidate = true;
        form.dataset.portalValidationKey = `${form.action}#${index}`;

        form.addEventListener('submit', (event) => {
            if (form.method.toLowerCase() !== 'get') {
                const formKey = form.querySelector('input[name="_portal_form_key"]') || document.createElement('input');
                formKey.type = 'hidden';
                formKey.name = '_portal_form_key';
                formKey.value = form.dataset.portalValidationKey;
                if (!formKey.isConnected) {
                    form.append(formKey);
                }
            }

            if (event.submitter?.formNoValidate) return;

            const invalidFields = [...form.elements].filter((field) => field.matches('input, select, textarea') && field.willValidate && !field.validity.valid);
            if (invalidFields.length) {
                event.preventDefault();
                invalidFields.forEach((field) => showFieldError(field, validationMessage(field)));
                invalidFields[0].focus();
            }
        });

        form.addEventListener('input', (event) => {
            if (event.target.matches('input, select, textarea')) clearFieldError(event.target);
        });
        form.addEventListener('change', (event) => {
            if (event.target.matches('input, select, textarea')) clearFieldError(event.target);
        });
    });

    const remainingErrors = new Map(Object.entries(validationState.messages || {}).map(([name, messages]) => [name, Array.isArray(messages) ? messages.join(' ') : String(messages)]));
    const submittedForm = forms.find((form) => form.dataset.portalValidationKey === validationState.form_key);
    if (submittedForm) {
        const submittedModal = submittedForm.closest('[data-modal]');
        if (submittedModal) {
            const trigger = [...document.querySelectorAll('[data-modal-open]')]
                .find((button) => button.dataset.modalOpen === submittedModal.id);
            showModal(submittedModal, trigger);
        }

        const fields = [...submittedForm.elements].filter((field) => field.matches('input, select, textarea') && field.name);
        fields.forEach((field) => {
            const fieldName = normalizeFieldName(field.name);
            const matchedError = [...remainingErrors.entries()].find(([name]) => {
                const errorName = normalizeFieldName(name);
                return errorName === fieldName || errorName.startsWith(`${fieldName}.`);
            });
            if (matchedError) {
                showFieldError(field, matchedError[1]);
                remainingErrors.delete(matchedError[0]);
            }
        });
    }

    const validationSummary = document.querySelector('[data-portal-validation-summary]');
    if (validationSummary) {
        const firstUnmatchedError = remainingErrors.values().next().value;
        validationSummary.textContent = firstUnmatchedError || '';
        validationSummary.hidden = !firstUnmatchedError;
    }

    const sidebarNav = document.getElementById('portal-sidebar-nav');
    const savedSidebarY = sessionStorage.getItem(portalSidebarScrollKey);
    if (sidebarNav && savedSidebarY !== null) {
        sidebarNav.scrollTop = Number(savedSidebarY);
    }

    const saveScroll = () => {
        if (sidebarNav) {
            sessionStorage.setItem(portalSidebarScrollKey, String(sidebarNav.scrollTop));
        }
    };

    window.addEventListener('beforeunload', saveScroll);
    window.addEventListener('pagehide', saveScroll);

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const url = new URL(link.href, window.location.href);
        const isSamePage = url.pathname === window.location.pathname && url.search === window.location.search;

        if (url.origin !== window.location.origin || link.target || link.hasAttribute('download') || isSamePage) {
            return;
        }

        const isSidebarLink = link.closest('#portal-sidebar-nav');
        if (!isSidebarLink && event.defaultPrevented) {
            return;
        }

        saveScroll();

        const bar = document.getElementById('portal-loading-bar');
        if (bar) {
            bar.style.opacity = '1';
            bar.style.width = '72%';
        }

        if (isSidebarLink) {
            event.preventDefault();
            event.stopImmediatePropagation();
            window.location.assign(url.href);
        }
    }, true);
}
