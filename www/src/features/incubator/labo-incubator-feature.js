import { createIncubator } from '../../vendor/inku-incubator/index.js';
import { t } from '../../i18n/i18n.js';
import { syncIncubatorLayout } from './incubator-layout-adapter.js';
import { createIncubatorSlimePreview } from './incubator-slime-preview.js';
import { createIncubatorCycleOrchestrator } from './incubator-cycle-orchestrator.js';
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { createStoragePanelController } from '../storage/storage-panel-controller.js';
import { INCUBATOR_EVENTS } from '../../vendor/inku-incubator/core/IncubatorEvents.js';
import { computeIncomeRate, computeAcquisitionCost } from '../economy/economy-calculator.js';
import { notifyRareCandidate } from '../economy/rarity-notification-service.js';
import { createExternalDisplayPanel } from './external-display-panel.js';

export function createLaboIncubatorFeature({ store } = {}) {
    let root = null;
    let stage = null;
    let frame = null;
    let mountTarget = null;
    let controller = null;
    let currentMount = null;
    let isSuspended = false;
    let isPrairiePreviewActive = false; // true quand la prairie affiche l'aperçu
    let preview = null;
    let orchestrator = null;
    let storageContext = null;
    let storagePanel = null;
    let controllerStateUnsubscribe = null;
    let externalPanel = null;   // display panel flottant hors du shadow DOM
    let externalPreviewListener = null; // listener pour inku:labo-preview-request depuis la prairie

    // Economy panel (prix + revenu/min + bouton acquérir)
    let storeUnsubscribe = null;
    let currentCandidatePrice = null;
    let currentCandidateIncomeRate = null;

    function buildShell() {
        const wrapper = document.createElement('section');
        wrapper.className = 'labo-incubator-feature';
        wrapper.dataset.laboIncubatorFeature = 'true';

        const stageNode = document.createElement('div');
        stageNode.className = 'labo-incubator-stage';

        const frameNode = document.createElement('div');
        frameNode.className = 'labo-incubator-frame';

        const targetNode = document.createElement('div');
        targetNode.className = 'labo-incubator-mount';
        targetNode.dataset.laboIncubatorMount = 'true';

        frameNode.appendChild(targetNode);
        stageNode.appendChild(frameNode);
        wrapper.appendChild(stageNode);

        root = wrapper;
        stage = stageNode;
        frame = frameNode;
        mountTarget = targetNode;
    }

    /** Met à jour l'état du bouton LED (vert/rouge) selon la balance courante. */
    function refreshAffordability() {
        if (currentCandidatePrice === null || !controller) {
            return;
        }

        const balance = Number(store?.getState?.()?.player?.currencies?.hexagon) || 0;
        const canAfford = balance >= currentCandidatePrice;
        controller.setAcquireState?.(canAfford ? 'allowed' : 'blocked');
    }

    /** Met à jour prix + revenu quand un candidat est staged. */
    function updateEconomyPanel(candidate) {
        if (!candidate) {
            currentCandidatePrice = null;
            currentCandidateIncomeRate = null;
            controller?.setAcquireState?.('blocked');
            return;
        }

        const price = computeAcquisitionCost(candidate);
        currentCandidatePrice = price;

        const blueprint = candidate.metadata?.previewBlueprint;
        currentCandidateIncomeRate = blueprint
            ? computeIncomeRate({ genome: blueprint.genome, stats: blueprint.stats })
            : 0;

        refreshAffordability();
    }

    function ensureShell(mount) {
        if (!root || !stage || !frame || !mountTarget) {
            buildShell();
        }

        currentMount = mount;
        if (!root.isConnected) {
            mount.appendChild(root);
        }

        mount.classList.add('content-mount--allow-overlap', 'content-mount--labo-incubator');
    }

    function ensureStorageContext() {
        if (!storageContext) {
            storageContext = getStorageRuntimeContext();
        }

        return storageContext;
    }

    function ensureStoragePanel() {
        if (!root) {
            return null;
        }

        if (!storagePanel) {
            storagePanel = createStoragePanelController({
                mountTarget: root,
                repository: ensureStorageContext().repository,
                store,
                floatingPanel: true,
                inspectionBridge: {
                    suspendSourceRuntime: () => preview?.suspendForExternalRuntime?.(),
                    resumeSourceRuntime: () => preview?.resumeAfterExternalRuntime?.(),
                },
                onVisibilityChange: (isVisible) => {
                    root.classList.toggle('labo-incubator-feature--storage-open', Boolean(isVisible));
                },
            });
            storagePanel.render();
        }

        return storagePanel;
    }

    function createRuntimeHelpers() {
        if (!preview) {
            preview = createIncubatorSlimePreview();
        }
        if (!controller) {
            controller = createIncubator({
                mountTarget,
                documentRef: document,
                config: {
                    ui: {
                        title: 'INKU INCUBATOR',
                        diagnosticLabel: '',
                        integrationHideActions: true,
                        integrationEmbedMode: true,
                        integrationAcquireState: 'blocked',
                    },
                    hooks: {
                        renderCandidate: (candidateBay, candidate) => {
                            preview.renderCandidate(candidateBay, candidate);
                        },
                        clearCandidate: () => {
                            preview.clear();
                        },
                        onStateChange: ({ state }) => {
                            if (state === 'purging') {
                                preview.beginAspiration();
                                // Hide economy panel as soon as purge starts
                                updateEconomyPanel(null);
                            }
                        },
                        resolvePurchase: async (candidatePayload) => {
                            // Safety check (the buy button already blocks this, but belt & suspenders)
                            const price = currentCandidatePrice ?? computeAcquisitionCost(candidatePayload);
                            const balance = Number(store?.getState?.()?.player?.currencies?.hexagon) || 0;

                            if (price > balance) {
                                const { showToast } = await import('../../utils/toast.js');
                                showToast(t('incubator.toast.insufficient_funds').replace('{price}', price.toLocaleString()), { type: 'error' });
                                // Return without throwing to avoid putting the controller in error state
                                return;
                            }

                            try {
                                await ensureStorageContext().acquisitionPipeline.acquireCurrentCandidate({
                                    candidate: candidatePayload,
                                    preview,
                                });
                                // Deduct the cost from the player's balance
                                store?.dispatch?.({
                                    type: 'ADD_CURRENCY',
                                    payload: { currency: 'hexagon', amount: -price },
                                });
                                // Hide economy panel after acquisition
                                updateEconomyPanel(null);
                            } catch (error) {
                                if (error?.message?.includes('No storage slot')) {
                                    const { showToast } = await import('../../utils/toast.js');
                                    showToast(t('incubator.toast.storage_full'), { type: 'warning' });
                                } else {
                                    throw error;
                                }
                            }
                        },
                        onOpenStorage: () => {
                            ensureStoragePanel()?.toggle();
                        },
                    },
                },
            }).mount();
        }
        if (!orchestrator && controller && preview) {
            orchestrator = createIncubatorCycleOrchestrator({
                controller,
                preview,
            });
        }

        // Subscribe to balance changes to keep LED button color in sync
        if (!storeUnsubscribe && store) {
            storeUnsubscribe = store.subscribe((state, previousState) => {
                if (state.player?.currencies?.hexagon !== previousState.player?.currencies?.hexagon) {
                    refreshAffordability();
                }
            });
        }

        // Listen to candidate events + state changes (one guard for both)
        if (!controllerStateUnsubscribe && controller) {
            controller.on(INCUBATOR_EVENTS.CANDIDATE_ATTACHED, ({ candidate }) => {
                updateEconomyPanel(candidate);

                // Mettre à jour le prix ET le revenu dans le display panel interne
                if (currentCandidatePrice !== null && controller?.view) {
                    controller.view.updatePrice(currentCandidatePrice, currentCandidateIncomeRate ?? 0);
                }

                // Mettre à jour le panel externe
                externalPanel?.updateCandidate(candidate);
                externalPanel?.updatePrice(currentCandidatePrice, currentCandidateIncomeRate ?? 0);

                // Trigger rare slime notification if player is on another section
                const rarityTier = candidate?.metadata?.previewBlueprint?.genome?.rarityTier || 'common';
                const activeSectionId = store?.getState?.()?.activeSectionId ?? 'labo';
                void notifyRareCandidate(rarityTier, store, activeSectionId);

                // Le getter passé à la prairie lors de l'ouverture appelle
                // preview.getSourceCanvas() à chaque frame — pas besoin de
                // renvoyer quoi que ce soit ici, le nouveau canvas est
                // automatiquement récupéré au prochain frame du miroir.
            });
            controllerStateUnsubscribe = controller.on(INCUBATOR_EVENTS.STATE_CHANGED, ({ state, previousState }) => {
                // Sync statut dans le panel externe
                const statusLabels = {
                    idle: t('incubator.status.idle'), staging: t('incubator.status.staging'),
                    intake: t('incubator.status.intake'), suspended: t('incubator.status.suspended'),
                    purchasePending: t('incubator.status.purchasePending'),
                    purchased: t('incubator.status.purchased'),
                    purging: t('incubator.status.purging'), purged: t('incubator.status.purged'),
                    error: t('incubator.status.error'),
                };
                externalPanel?.updateStatus(statusLabels[state] || state);

                // Vider le candidat quand on revient en idle après purge/achat
                if (state === 'idle' && (previousState === 'purged' || previousState === 'purchased')) {
                    externalPanel?.updateCandidate(null);
                }

                if (state !== 'idle') {
                    return;
                }
                if (previousState === 'purchased') {
                    window.setTimeout(() => {
                        if (!controller || !orchestrator) {
                            return;
                        }
                        if (controller.getState?.() !== 'idle') {
                            return;
                        }
                        orchestrator.queueNextCandidate?.(0);
                    }, 0);
                    return;
                }
                if (previousState === 'purged') {
                    orchestrator?.queueNextCandidate?.(320);
                }
            });
        }
    }

    function ensureRuntime() {
        createRuntimeHelpers();
        return controller;
    }

    function applyLayout() {
        if (!frame || !stage) {
            return;
        }
        syncIncubatorLayout({ frame, stage });
        preview?.syncLayout();
    }

    function showFeature() {
        if (!root) {
            return;
        }
        root.hidden = false;
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        root.style.pointerEvents = 'auto';
        root.style.position = 'relative';
        root.style.inset = '';
        root.setAttribute('aria-hidden', 'false');
    }

    function hideFeature() {
        if (!root) {
            return;
        }
        // Réinitialiser l'inline visibility du wrapper slime pour qu'il hérite
        // du root. Sans ça, un visibility:visible posé par reviveCandidate ou
        // le listener prairie passerait à travers le visibility:hidden du root.
        const w = wrapper_ref();
        if (w) w.style.visibility = '';
        root.hidden = false;
        root.style.visibility = 'hidden';
        root.style.opacity = '0';
        root.style.pointerEvents = 'none';
        root.style.position = 'absolute';
        root.style.inset = '0';
        root.setAttribute('aria-hidden', 'true');
    }

    function destroyRuntime() {
        storeUnsubscribe?.();
        storeUnsubscribe = null;
        controllerStateUnsubscribe?.();
        controllerStateUnsubscribe = null;
        orchestrator?.stop();
        orchestrator = null;
        preview?.clear();
        preview = null;
        controller?.destroy();
        controller = null;
        updateEconomyPanel(null);
    }

    function suspendRuntime() {
        orchestrator?.pause?.();
        preview?.suspendForExternalRuntime?.();
    }

    function bindExternalPreviewListener() {
        if (externalPreviewListener) return;
        externalPreviewListener = (event) => {
            const active = event?.detail?.active === true;
            isPrairiePreviewActive = active;
            if (active) {
                // Masquer le wrapper original pour éviter le doublon derrière la minimap
                const w = wrapper_ref();
                if (w) w.style.visibility = 'hidden';
                // Envoyer un GETTER de blueprint — la prairie crée son propre engine
                // avec le même genome, sans dépendre du canvas interne de l'incubateur
                window.dispatchEvent(new CustomEvent('inku:labo-source-canvas', {
                    detail: {
                        getBlueprint: () => controller?.getCandidate?.()?.metadata?.previewBlueprint ?? null,
                    },
                }));
            } else {
                // Révéler le wrapper original quand le panel aperçu se ferme
                const w = wrapper_ref();
                if (w) w.style.visibility = 'visible';
                window.dispatchEvent(new CustomEvent('inku:labo-source-canvas', {
                    detail: { getBlueprint: null },
                }));
            }
        };
        window.addEventListener('inku:labo-preview-request', externalPreviewListener);
    }

    function wrapper_ref() {
        const c = preview?.getSourceCanvas?.();
        return c ? c.parentElement : null;
    }

    function unbindExternalPreviewListener() {
        if (!externalPreviewListener) return;
        window.removeEventListener('inku:labo-preview-request', externalPreviewListener);
        externalPreviewListener = null;
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            // Device en arrière-plan : pauser même si on est dans la section bar/prairie
            orchestrator?.pause?.();
            preview?.suspendForExternalRuntime?.();
        } else {
            // Device revenu au premier plan — ne reprendre le preview que si le labo
            // est actif (pas suspendu). Si on est sur la prairie avec le bouton aperçu
            // actif, l'event inku:labo-preview-request gère ça indépendamment.
            if (!isSuspended) {
                preview?.resumeAfterExternalRuntime?.();
            }
            // Ne reprendre l'orchestrateur que s'il n'est pas en état d'arrêt complet
            if (!isSuspended || orchestrator) {
                orchestrator?.resume?.();
            }
        }
    }

    function reviveCandidatePreviewIfNeeded() {
        const existingCandidate = controller?.getCandidate?.();
        if (!existingCandidate || !preview) {
            return false;
        }

        // Quand on revient au labo, s'assurer que le wrapper est visible
        isPrairiePreviewActive = false;
        const w = wrapper_ref();
        if (w) w.style.visibility = 'visible';

        preview.resumeAfterExternalRuntime?.();
        preview.syncLayout?.();

        if (controller?.getState?.() === 'suspended' && orchestrator?.isCurrentCandidateOverdue?.()) {
            return false;
        }

        return true;
    }

    function startCycle() {
        const hasLiveCandidate = reviveCandidatePreviewIfNeeded();
        const state = controller?.getState?.();

        if (state === 'error') {
            controller?.resetRuntime?.();
        }

        if (!orchestrator) {
            return;
        }

        if (hasLiveCandidate || controller?.getState?.() === 'idle' || controller?.getState?.() === 'staging') {
            orchestrator.resume?.();
            return;
        }

        orchestrator.start?.();
    }

    return {
        id: 'labo-incubator',
        mount(context) {
            ensureShell(context.mount);
            ensureRuntime();
            ensureStoragePanel();
            isSuspended = false;
            document.addEventListener('visibilitychange', handleVisibilityChange);
            bindExternalPreviewListener();
            currentMount?.classList.add('content-mount--allow-overlap', 'content-mount--labo-incubator');
            if (!externalPanel) externalPanel = createExternalDisplayPanel();
            externalPanel.mount();
            showFeature();
            applyLayout();
            startCycle();
        },
        resume(context) {
            ensureShell(context.mount);
            ensureRuntime();
            ensureStoragePanel();
            isSuspended = false;
            document.addEventListener('visibilitychange', handleVisibilityChange);
            bindExternalPreviewListener();
            currentMount?.classList.add('content-mount--allow-overlap', 'content-mount--labo-incubator');
            if (!externalPanel) externalPanel = createExternalDisplayPanel();
            externalPanel.mount();
            showFeature();
            applyLayout();
            startCycle();
        },
        suspend() {
            if (!root) { return; }
            isSuspended = true;
            currentMount?.classList.remove('content-mount--allow-overlap', 'content-mount--labo-incubator');
            storagePanel?.close();
            suspendRuntime();
            hideFeature();
            externalPanel?.hide();
            // Garde le listener actif : la prairie peut demander l'aperçu via inku:labo-preview-request
        },
        syncLayout() {
            if (isSuspended) { return; }
            applyLayout();
        },
        unmount() {
            unbindExternalPreviewListener();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            destroyRuntime();
            if (currentMount) {
                currentMount.classList.remove('content-mount--allow-overlap', 'content-mount--labo-incubator');
            }
            root?.remove();
            root = null;
            stage = null;
            frame = null;
            mountTarget = null;
            storagePanel?.destroy();
            storagePanel = null;
            currentMount = null;
            isSuspended = false;
            externalPanel?.destroy();
            externalPanel = null;
        },
    };
}
