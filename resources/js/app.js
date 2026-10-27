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
    const portalFrame = document.getElementById('portal-frame');
    const sidebarToggle = document.getElementById('portal-sidebar-toggle');
    const sidebarCollapsedKey = 'portal-sidebar-collapsed';
    if (portalFrame && sidebarToggle) {
        const setSidebarCollapsed = (collapsed) => {
            portalFrame.classList.toggle('sidebar-collapsed', collapsed);
            sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
            sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
            sidebarToggle.querySelector('svg')?.classList.toggle('rotate-180', collapsed);
            if (!collapsed) {
                document.querySelectorAll('#portal-sidebar-flyout-layer [data-subnav-list]').forEach((menu) => {
                    const owner = document.getElementById(menu.dataset.subnavOwnerId);
                    owner?.querySelector('[data-subnav-placeholder]')?.after(menu);
                    ['position', 'left', 'top', 'width'].forEach((property) => menu.style.removeProperty(property));
                });
            }
            localStorage.setItem(sidebarCollapsedKey, String(collapsed));
        };
        setSidebarCollapsed(localStorage.getItem(sidebarCollapsedKey) === 'true');
        sidebarToggle.addEventListener('click', () => {
            setSidebarCollapsed(!portalFrame.classList.contains('sidebar-collapsed'));
        });
    }

    const sidebarFlyoutLayer = document.getElementById('portal-sidebar-flyout-layer');
    const sidebarFrame = document.getElementById('portal-frame');
    const sidebarNav = document.getElementById('portal-sidebar-nav');
    let sidebarTooltip = null;
    const hideSidebarTooltip = () => {
        sidebarTooltip?.remove();
        sidebarTooltip = null;
    };
    const showSidebarTooltip = (trigger) => {
        hideSidebarTooltip();
        if (!sidebarFrame?.classList.contains('sidebar-collapsed')) return;

        sidebarTooltip = document.createElement('div');
        sidebarTooltip.className = 'portal-sidebar-tooltip';
        sidebarTooltip.textContent = trigger.dataset.sidebarTooltip;
        sidebarFlyoutLayer.append(sidebarTooltip);

        const frameRect = sidebarFrame.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        let left = triggerRect.right - frameRect.left + 10;
        const top = triggerRect.top - frameRect.top + triggerRect.height / 2;
        if (left + sidebarTooltip.offsetWidth > frameRect.width - 8) {
            left = triggerRect.left - frameRect.left - sidebarTooltip.offsetWidth - 10;
        }
        Object.assign(sidebarTooltip.style, { left: `${left}px`, top: `${top}px` });
    };
    document.querySelectorAll('#portal-sidebar [data-sidebar-tooltip]').forEach((trigger) => {
        trigger.addEventListener('mouseenter', () => showSidebarTooltip(trigger));
        trigger.addEventListener('mouseleave', hideSidebarTooltip);
        trigger.addEventListener('focus', () => showSidebarTooltip(trigger));
        trigger.addEventListener('blur', hideSidebarTooltip);
    });

    const getSubnav = (wrapper) => document.getElementById(wrapper.dataset.subnavMenu);
    const restoreSubnav = (wrapper, menu) => {
        wrapper.querySelector('[data-subnav-placeholder]')?.after(menu);
        ['position', 'left', 'top', 'width'].forEach((property) => menu.style.removeProperty(property));
    };
    const positionSubnav = (wrapper, menu) => {
        sidebarFlyoutLayer.append(menu);
        const frameRect = sidebarFrame.getBoundingClientRect();
        const ownerRect = wrapper.getBoundingClientRect();
        const maxTop = Math.max(frameRect.top + 8, frameRect.bottom - menu.offsetHeight - 8);
        const top = Math.max(frameRect.top + 8, Math.min(ownerRect.bottom - 6, maxTop));
        Object.assign(menu.style, {
            position: 'absolute',
            left: `${ownerRect.right - frameRect.left - 3}px`,
            top: `${top - frameRect.top}px`,
            width: '190px',
        });
    };
    const setSubnavOpen = (wrapper, open, pin = false) => {
        const menu = getSubnav(wrapper);
        const toggle = wrapper.querySelector('[data-subnav-toggle]');
        if (!menu || !toggle) return;

        if (pin) wrapper.dataset.pinned = String(open);
        menu.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.querySelector('svg')?.classList.toggle('rotate-90', open);

        if (open && sidebarFrame?.classList.contains('sidebar-collapsed')) {
            positionSubnav(wrapper, menu);
        } else if (!sidebarFrame?.classList.contains('sidebar-collapsed')) {
            restoreSubnav(wrapper, menu);
        } else if (!open) {
            restoreSubnav(wrapper, menu);
        }
    };

    const closeSubnavIfUnfocused = (wrapper) => {
        clearTimeout(wrapper._submenuCloseTimer);
        wrapper._submenuCloseTimer = setTimeout(() => {
            const menu = getSubnav(wrapper);
            if (!menu || wrapper.dataset.pinned === 'true') return;
            if (wrapper.matches(':hover') || menu.matches(':hover') || wrapper.contains(document.activeElement) || menu.contains(document.activeElement)) return;
            setSubnavOpen(wrapper, false);
        }, 220);
    };

    document.querySelectorAll('#portal-sidebar-nav [data-subnav-owner]').forEach((wrapper) => {
        const menu = getSubnav(wrapper);
        const toggle = wrapper.querySelector('[data-subnav-toggle]');
        if (!menu || !toggle) return;

        wrapper.addEventListener('mouseenter', () => {
            clearTimeout(wrapper._submenuCloseTimer);
            setSubnavOpen(wrapper, true);
        });
        wrapper.addEventListener('mouseleave', () => closeSubnavIfUnfocused(wrapper));
        wrapper.addEventListener('focusout', () => closeSubnavIfUnfocused(wrapper));
        menu.addEventListener('mouseenter', () => clearTimeout(wrapper._submenuCloseTimer));
        menu.addEventListener('mouseleave', () => closeSubnavIfUnfocused(wrapper));
        toggle.addEventListener('click', () => {
            const open = wrapper.dataset.pinned !== 'true';
            setSubnavOpen(wrapper, open, true);
        });

        if (wrapper.dataset.pinned === 'true' && sidebarFrame?.classList.contains('sidebar-collapsed')) {
            setSubnavOpen(wrapper, true);
        }
    });

    const mobileNavToggle = document.getElementById('portal-mobile-nav-toggle');
    const mobileNavPanel = document.getElementById('portal-mobile-nav-panel');
    const mobileNavHeader = mobileNavToggle?.closest('header');
    const closeMobileNav = () => {
        if (!mobileNavToggle || !mobileNavPanel) return;
        mobileNavPanel.classList.add('hidden');
        mobileNavHeader?.classList.remove('portal-mobile-nav-open');
        mobileNavToggle.setAttribute('aria-expanded', 'false');
        mobileNavToggle.querySelector('[data-mobile-nav-chevron]')?.classList.remove('rotate-180');
    };
    if (mobileNavToggle && mobileNavPanel) {
        mobileNavToggle.addEventListener('click', () => {
            const open = mobileNavPanel.classList.contains('hidden');
            mobileNavPanel.classList.toggle('hidden', !open);
            mobileNavHeader?.classList.toggle('portal-mobile-nav-open', open);
            mobileNavToggle.setAttribute('aria-expanded', String(open));
            mobileNavToggle.querySelector('[data-mobile-nav-chevron]')?.classList.toggle('rotate-180', open);
        });

        mobileNavPanel.querySelectorAll('[data-mobile-subnav-toggle]').forEach((button) => {
            const submenu = document.getElementById(button.getAttribute('aria-controls'));
            if (!submenu) return;
            button.addEventListener('click', () => {
                const open = submenu.classList.contains('hidden');
                submenu.classList.toggle('hidden', !open);
                button.setAttribute('aria-expanded', String(open));
                button.querySelector('[data-mobile-subnav-chevron]')?.classList.toggle('rotate-180', open);
            });
        });

        mobileNavPanel.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', closeMobileNav));
        document.addEventListener('click', (event) => {
            if (!event.target.closest('#portal-mobile-nav-panel, #portal-mobile-nav-toggle')) closeMobileNav();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMobileNav();
        });
    }

    sidebarNav?.addEventListener('scroll', () => {
        document.querySelectorAll('#portal-sidebar-flyout-layer [data-subnav-list]').forEach((menu) => {
            const wrapper = document.getElementById(menu.dataset.subnavOwnerId);
            if (wrapper && wrapper.dataset.pinned !== 'true') setSubnavOpen(wrapper, false);
        });
    });

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
        error.className = 'portal-field-error text-red-600';
        error.style.color = '#b91c1c';
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
