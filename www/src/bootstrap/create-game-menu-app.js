import { showToast } from '../utils/toast.js';
import { DEFAULT_ACTIVE_SECTION_ID, NAV_ITEMS } from '../core/constants.js';
import { getDomRefs } from '../core/dom-refs.js';
import { createStateStore } from '../core/state-store.js';
import { createNavigationController } from '../features/navigation/navigation-controller.js';
import { createProfileModalController } from '../features/modal/profile-modal-controller.js';
import { createDustBackgroundController } from '../features/particles/dust-background.js';
import { createContentMountController } from '../features/content/content-mount-controller.js';
import { createBlankSectionFeature } from '../features/content/blank-section-feature.js';
import { createPrairieFeature } from '../features/prairie/prairie-feature.js';
import { createLaboIncubatorFeature } from '../features/incubator/labo-incubator-feature.js';
import { createBarFeature } from '../features/bar/bar-feature.js';
import { createPotionFactoryFeature } from '../features/potion-factory/potion-factory-feature.js';
import { createHudController } from '../features/hud/hud-controller.js';
import { loadPlayerState, savePlayerState } from '../features/economy/player-persistence.js';
import { createPassiveIncomeEngine } from '../features/economy/passive-income-engine.js';
import { getStorageRuntimeContext } from '../features/storage/storage-runtime-context.js';
import { createNotificationSettingsController } from '../features/economy/notification-settings-controller.js';
import { createSettingsPanelController } from '../features/settings/settings-panel-controller.js';
import { mountDevConsole } from '../utils/dev-console.js';

export function createGameMenuApp(root = document) {
    const refs = getDomRefs(root);
    const store = createStateStore({
        activeSectionId: DEFAULT_ACTIVE_SECTION_ID,
        activeSectionIndex: NAV_ITEMS.findIndex((item) => item.id === DEFAULT_ACTIVE_SECTION_ID),
    });

    // Dev console — activée si localStorage 'inku.dev' === '1'
    mountDevConsole(store);

    const hudController = createHudController({ refs, store });
    const navigationController = createNavigationController({ refs, store });
    const settingsPanelController = createSettingsPanelController();
    const profileModalController = createProfileModalController({ refs, store, settingsPanelController });
    const dustBackgroundController = createDustBackgroundController({ refs });
    const contentMountController = createContentMountController({ refs, store });

    NAV_ITEMS.forEach((item) => {
        if (item.id === 'labo') {
            contentMountController.registerFeature(item.id, () => createLaboIncubatorFeature({ store }));
            return;
        }

        if (item.id === 'prairie') {
            contentMountController.registerFeature(item.id, () => createPrairieFeature());
            return;
        }

        if (item.id === 'bar') {
            contentMountController.registerFeature(item.id, () => createBarFeature({ store }));
            return;
        }

        if (item.id === 'potion-factory') {
            contentMountController.registerFeature(item.id, () => createPotionFactoryFeature({ store }));
            return;
        }

        contentMountController.registerFeature(item.id, () => createBlankSectionFeature(item.id));
    });

    let hasInitialized = false;
    let layoutSyncRaf = 0;

    // Restore persisted player state (currencies, preferences) from localStorage
    const savedPlayer = loadPlayerState();
    hudController.hydratePlayer(savedPlayer ?? {});

    // Auto-save whenever the player state changes
    store.subscribe((state, previousState) => {
        if (state.player !== previousState.player) {
            savePlayerState(state.player);
        }
    });

    // Passive income engine — only team slots generate income
    const storageRepository = getStorageRuntimeContext().repository;
    const passiveIncome = createPassiveIncomeEngine({
        store,
        repository: storageRepository,
    });

    // Refresh HUD income rate display whenever storage changes (team composition)
    storageRepository.subscribe(() => {
        hudController.updateIncomeRate(passiveIncome.getTotalIncomeRate());
    });

    // Notification settings UI in profile modal
    const notifSettingsController = createNotificationSettingsController({ store });

    contentMountController.renderCurrent();

    function requestLayoutSync() {
        if (layoutSyncRaf !== 0) {
            return;
        }

        layoutSyncRaf = window.requestAnimationFrame(() => {
            layoutSyncRaf = 0;
            dustBackgroundController.syncCanvasSize();
            navigationController.syncLayout();
            contentMountController.syncLayout();
        });
    }

    function initialize() {
        if (hasInitialized) {
            return;
        }

        hasInitialized = true;
        refs.shell.dataset.menuActive = 'true';
        store.dispatch({ type: 'SET_BOOTSTRAPPED', payload: { value: true } });
        dustBackgroundController.start();
        passiveIncome.start();

        // --- NOUVEAU : CALCUL DES REVENUS HORS-LIGNE ---
        // savedPlayer a été défini plus haut dans ce fichier lors du hydratePlayer
        if (savedPlayer && savedPlayer.lastSavedAt) {
            const now = Date.now();
            // Calculer les minutes écoulées
            const elapsedMinutes = (now - savedPlayer.lastSavedAt) / 60000;

            if (elapsedMinutes > 1) { // Ne s'active que si au moins 1 minute s'est écoulée
                const MAX_OFFLINE_HOURS = 7;
                // Limiter le temps maximum à 7 heures (7 * 60 minutes)
                const cappedMinutes = Math.min(elapsedMinutes, MAX_OFFLINE_HOURS * 60);

                // Récupérer le taux de l'équipe (ceux actifs au moment où le joueur relance)
                const rate = passiveIncome.getTotalIncomeRate(); 
                
                if (rate > 0) {
                    const earnedOffline = Math.round(cappedMinutes * rate * 10) / 10;
                    
                    if (earnedOffline > 0) {
                        // Ajouter l'argent calculé
                        store.dispatch({
                            type: 'ADD_CURRENCY',
                            payload: { currency: 'hexagon', amount: earnedOffline },
                        });

                        // Afficher un joli toast au bout de 1.5s pour que l'UI ait eu le temps d'apparaître
                        setTimeout(() => {
                            showToast(`Bon retour ! Vos slimes ont produit ${earnedOffline} inkübits pendant votre absence.`, { type: 'success', duration: 5000 });
                        }, 1500);
                    }
                }
            }
        }
        window.requestAnimationFrame(() => {
            navigationController.primeInitialLayout();
            requestLayoutSync();
        });
    }

    function activate() {
        refs.shell.dataset.menuActive = 'true';
        store.dispatch({ type: 'SET_SHELL_ACTIVE', payload: { value: true } });
        dustBackgroundController.start();
        passiveIncome.start();
        requestLayoutSync();
    }

    function deactivate() {
        refs.shell.dataset.menuActive = 'false';
        store.dispatch({ type: 'SET_SHELL_ACTIVE', payload: { value: false } });
        profileModalController.closeProfileModal();
        settingsPanelController.close();
        dustBackgroundController.stop();
        passiveIncome.stop();
    }

    function destroy() {
        passiveIncome.stop();
        notifSettingsController.destroy();
        dustBackgroundController.destroy();
        navigationController.destroy();
        profileModalController.destroy();
        settingsPanelController.destroy();
        contentMountController.destroy();
        hudController.destroy();
    }

    return {
        refs,
        store,
        navigationController,
        profileModalController,
        contentMountController,
        requestLayoutSync,
        initialize,
        activate,
        deactivate,
        destroy,
        get isActive() {
            return store.getState().isShellActive;
        },
    };
}
