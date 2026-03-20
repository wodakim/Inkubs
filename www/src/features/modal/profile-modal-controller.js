import { MODAL_IDS } from '../../core/constants.js';
import { createListenerRegistry } from '../../core/listener-registry.js';

function getFocusableElements(container) {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'));
}

export function createProfileModalController({ refs, store }) {
    const listeners = createListenerRegistry();
    const modalId = MODAL_IDS.PROFILE;
    let lastTrigger = null;

    function isOpen(state = store.getState()) {
        return state.openModalStack[state.openModalStack.length - 1] === modalId;
    }

    function openProfileModal(trigger = document.activeElement) {
        lastTrigger = trigger instanceof HTMLElement ? trigger : null;
        store.dispatch({ type: 'OPEN_MODAL', payload: { modalId } });
    }

    function closeProfileModal() {
        store.dispatch({ type: 'CLOSE_MODAL', payload: { modalId } });
    }

    function toggleProfileModal(event) {
        if (isOpen()) {
            closeProfileModal();
            return;
        }
        openProfileModal(event?.currentTarget ?? document.activeElement);
    }

    refs.profileToggleButtons.forEach((button) => {
        listeners.listen(button, 'click', toggleProfileModal);
    });

    refs.profileCloseButtons.forEach((button) => {
        listeners.listen(button, 'click', closeProfileModal);
    });

    listeners.listen(document, 'keydown', (event) => {
        if (!isOpen()) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeProfileModal();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusables = getFocusableElements(refs.profileCard);
        if (!focusables.length) {
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    });

    const unsubscribe = store.subscribe((state) => {
        const open = isOpen(state);
        refs.profileModal.classList.toggle('is-open', open);
        refs.profileModal.setAttribute('aria-hidden', String(!open));
        refs.profileToggleButtons.forEach((button) => {
            button.setAttribute('aria-expanded', String(open));
        });

        if (open) {
            const focusables = getFocusableElements(refs.profileCard);
            focusables[0]?.focus();
            return;
        }

        lastTrigger?.focus?.();
    });

    return {
        openProfileModal,
        closeProfileModal,
        toggleProfileModal,
        destroy() {
            listeners.disposeAll();
            unsubscribe();
        },
    };
}
