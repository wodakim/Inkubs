import { createIncubator } from '../../vendor/inku-incubator/index.js';
import { syncIncubatorLayout } from './incubator-layout-adapter.js';
import { createIncubatorSlimePreview } from './incubator-slime-preview.js';
import { createIncubatorCycleOrchestrator } from './incubator-cycle-orchestrator.js';
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { createStoragePanelController } from '../storage/storage-panel-controller.js';
import { INCUBATOR_EVENTS } from '../../vendor/inku-incubator/core/IncubatorEvents.js';

export function createLaboIncubatorFeature() {
    let root = null;
    let stage = null;
    let frame = null;
    let mountTarget = null;
    let controller = null;
    let currentMount = null;
    let isSuspended = false;
    let preview = null;
    let orchestrator = null;
    let storageContext = null;
    let storagePanel = null;
    let controllerStateUnsubscribe = null;

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
                            }
                        },
                        resolvePurchase: async (candidatePayload) => {
                            await ensureStorageContext().acquisitionPipeline.acquireCurrentCandidate({
                                candidate: candidatePayload,
                                preview,
                            });
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
        if (!controllerStateUnsubscribe && controller) {
            controllerStateUnsubscribe = controller.on(INCUBATOR_EVENTS.STATE_CHANGED, ({ state, previousState }) => {
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
        root.hidden = false;
        root.style.visibility = 'hidden';
        root.style.opacity = '0';
        root.style.pointerEvents = 'none';
        root.style.position = 'absolute';
        root.style.inset = '0';
        root.setAttribute('aria-hidden', 'true');
    }

    function destroyRuntime() {
        controllerStateUnsubscribe?.();
        controllerStateUnsubscribe = null;
        orchestrator?.stop();
        orchestrator = null;
        preview?.clear();
        preview = null;
        controller?.destroy();
        controller = null;
    }

    function suspendRuntime() {
        orchestrator?.pause?.();
        preview?.suspendForExternalRuntime?.();
    }

    function reviveCandidatePreviewIfNeeded() {
        const existingCandidate = controller?.getCandidate?.();
        if (!existingCandidate || !preview) {
            return false;
        }

        // Always restore the visual slime first, regardless of dwell deadline.
        // The orchestrator will handle the state transition in startCycle().
        // Without this, navigating back to labo shows an empty incubator.
        if (!preview.resumeAfterExternalRuntime?.()) {
            preview.ensureRuntimeAvailable?.();
        }
        preview.syncLayout?.();

        // If the candidate's dwell time expired during navigation, signal that
        // startCycle() should advance the cycle — but the slime is already visible.
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
            currentMount?.classList.add('content-mount--allow-overlap', 'content-mount--labo-incubator');
            showFeature();
            applyLayout();
            startCycle();
        },
        resume(context) {
            ensureShell(context.mount);
            ensureRuntime();
            ensureStoragePanel();
            isSuspended = false;
            currentMount?.classList.add('content-mount--allow-overlap', 'content-mount--labo-incubator');
            showFeature();
            applyLayout();
            startCycle();
        },
        suspend() {
            if (!root) {
                return;
            }
            isSuspended = true;
            currentMount?.classList.remove('content-mount--allow-overlap', 'content-mount--labo-incubator');
            storagePanel?.close();
            suspendRuntime();
            hideFeature();
        },
        syncLayout() {
            if (isSuspended) {
                return;
            }
            applyLayout();
        },
        unmount() {
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
        },
    };
}
