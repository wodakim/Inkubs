/**
 * notification-settings-controller.js
 * Gère l'UI des préférences de notifications dans le profil modal.
 * Synchronise avec le state store (HYDRATE_PLAYER).
 */

const TIER_ORDER = ['uncommon', 'rare', 'epic', 'legendary'];

export function createNotificationSettingsController({ store }) {
    const enabledToggle = document.getElementById('notif-enabled-toggle');
    const tiersSection  = document.getElementById('notif-tiers-section');
    const tierButtons   = Array.from(document.querySelectorAll('[data-notif-tier]'));

    if (!enabledToggle || !tiersSection || tierButtons.length === 0) {
        return { destroy() {} };
    }

    /** Lit les préférences courantes du state. */
    function getSettings() {
        return store.getState().player?.notificationSettings ?? {
            enabled: false,
            minRarityTier: 'rare',
        };
    }

    /** Sauvegarde les préférences dans le store. */
    function saveSettings(patch) {
        const current = getSettings();
        store.dispatch({
            type: 'HYDRATE_PLAYER',
            payload: {
                notificationSettings: { ...current, ...patch },
            },
        });
    }

    /** Met à jour l'UI pour refléter l'état courant. */
    function syncUi() {
        const settings = getSettings();
        enabledToggle.checked = Boolean(settings.enabled);
        tiersSection.classList.toggle('is-visible', Boolean(settings.enabled));

        const activeTier = settings.minRarityTier || 'rare';
        tierButtons.forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.notifTier === activeTier);
        });
    }

    // Event: toggle enabled
    enabledToggle.addEventListener('change', () => {
        saveSettings({ enabled: enabledToggle.checked });
        tiersSection.classList.toggle('is-visible', enabledToggle.checked);
    });

    // Event: tier selection
    tierButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.notifTier;
            if (!TIER_ORDER.includes(tier)) {
                return;
            }
            saveSettings({ minRarityTier: tier });
            tierButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        });
    });

    // Sync UI on store changes (e.g. loaded from localStorage)
    const unsubscribe = store.subscribe((state, previousState) => {
        if (state.player?.notificationSettings !== previousState.player?.notificationSettings) {
            syncUi();
        }
    });

    // Initial sync
    syncUi();

    return {
        destroy() {
            unsubscribe();
        },
    };
}
