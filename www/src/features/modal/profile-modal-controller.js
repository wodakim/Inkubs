import { MODAL_IDS } from '../../core/constants.js';
import { createListenerRegistry } from '../../core/listener-registry.js';
import { t } from '../../i18n/i18n.js';
import {
    getPerformanceTier,
    setPerformanceTier,
    detectAndApplyPerformanceProfile,
} from '../../utils/device-performance-profile.js';

function getFocusableElements(container) {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'));
}

export function createProfileModalController({ refs, store, settingsPanelController = null }) {
    const listeners = createListenerRegistry();
    const modalId = MODAL_IDS.PROFILE;
    let lastTrigger = null;

    // ── Settings panel elements ──────────────────────────────────────────────
    const settingsPanel    = document.getElementById('profile-settings-panel');
    const settingsTitle    = document.getElementById('profile-settings-title');
    const profileSection   = document.getElementById('settings-profile-section');
    const perfSection      = document.getElementById('settings-perf-section');
    const nameInput        = document.getElementById('profile-name-input');
    const avatarOptions    = settingsPanel?.querySelectorAll('[data-avatar]') ?? [];
    const perfButtons      = settingsPanel?.querySelectorAll('[data-perf-btn]') ?? [];

    // Pending avatar selection (not yet saved)
    let pendingAvatar = null;

    // ── Settings panel helpers ───────────────────────────────────────────────
    function openSettingsPanel(section) {
        if (!settingsPanel) return;
        profileSection?.toggleAttribute('hidden', section !== 'profile');
        perfSection?.toggleAttribute('hidden', section !== 'perf');

        if (section === 'profile') {
            settingsTitle.textContent = t('profile.my_profile_title');
            _initProfileSection();
        } else {
            settingsTitle.textContent = t('profile.performance_title');
            _initPerfSection();
        }

        settingsPanel.classList.add('is-open');
        settingsPanel.setAttribute('aria-hidden', 'false');
        nameInput?.focus?.();
    }

    function closeSettingsPanel() {
        if (!settingsPanel) return;
        settingsPanel.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
    }

    function _initProfileSection() {
        const player = store.getState().player;

        // Pre-fill name input
        if (nameInput) nameInput.value = player.displayName || '';

        // Pre-select current avatar
        pendingAvatar = player.avatarKey || 'user';
        avatarOptions.forEach((btn) => {
            btn.classList.toggle('is-selected', btn.dataset.avatar === pendingAvatar);
        });
    }

    function _initPerfSection() {
        const currentTier = getPerformanceTier();
        perfButtons.forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.perfBtn === currentTier);
        });
    }

    function _saveProfile() {
        const rawName = nameInput?.value?.trim() ?? '';
        const displayName = rawName.slice(0, 16).toUpperCase() || store.getState().player.displayName;
        const avatarKey   = pendingAvatar || store.getState().player.avatarKey;

        store.dispatch({
            type: 'UPDATE_PLAYER_PROFILE',
            payload: { displayName, avatarKey },
        });

        closeSettingsPanel();
    }

    // ── Event delegation on settings panel ──────────────────────────────────
    if (settingsPanel) {
        listeners.listen(settingsPanel, 'click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const avatarBtn = e.target.closest('[data-avatar]');
            const perfBtn   = e.target.closest('[data-perf-btn]');

            if (action === 'close-profile-settings') {
                closeSettingsPanel();
                return;
            }

            if (action === 'save-profile') {
                _saveProfile();
                return;
            }

            if (action === 'auto-detect-perf') {
                detectAndApplyPerformanceProfile().then(() => _initPerfSection()).catch(() => {});
                return;
            }

            if (avatarBtn) {
                pendingAvatar = avatarBtn.dataset.avatar;
                avatarOptions.forEach((btn) => {
                    btn.classList.toggle('is-selected', btn.dataset.avatar === pendingAvatar);
                });
                return;
            }

            if (perfBtn) {
                const tier = perfBtn.dataset.perfBtn;
                setPerformanceTier(tier);
                perfButtons.forEach((btn) => {
                    btn.classList.toggle('is-active', btn.dataset.perfBtn === tier);
                });
                return;
            }
        });
    }

    // ── Slot button clicks (open-profile-settings / open-perf-settings) ──────
    const profileCard = refs.profileCard;
    if (profileCard) {
        listeners.listen(profileCard, 'click', (e) => {
            e.stopPropagation();
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'open-profile-settings') openSettingsPanel('profile');
            if (action === 'open-perf-settings')    openSettingsPanel('perf');
            if (action === 'open-all-settings') {
                closeProfileModal();
                settingsPanelController?.open();
            }
        });
    }

    // ── Profile modal open/close ─────────────────────────────────────────────
    function isOpen(state = store.getState()) {
        return state.openModalStack[state.openModalStack.length - 1] === modalId;
    }

    function openProfileModal(trigger = document.activeElement) {
        lastTrigger = trigger instanceof HTMLElement ? trigger : null;
        store.dispatch({ type: 'OPEN_MODAL', payload: { modalId } });
    }

    function closeProfileModal() {
        closeSettingsPanel();
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
            if (settingsPanel?.classList.contains('is-open')) {
                closeSettingsPanel();
            } else {
                closeProfileModal();
            }
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
