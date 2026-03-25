import { createPrairieContext } from './prairie-context.js';
import { ensureShell } from './prairie-shell.js';
import { bindInteractions } from './prairie-interactions.js';
import { renderDronePanel } from './prairie-drone-panel.js';
import { applyPanelLayout } from './prairie-drone-panel.js';
import { drawFrame, resize, startLoop, stopLoop, startBackgroundTick, stopBackgroundTick, teardownLoop } from './prairie-loop.js';
import { renderMinimap } from './prairie-drone-panel.js';
import { syncSceneTransform, clampCamera } from './prairie-camera.js';
import { findRecordById, createCanonicalRuntime, getSavedPrairiePlacement } from './prairie-slime-runtime.js';
import { persistAllActiveRecords } from './prairie-persistence.js';
import { saveSession } from './prairie-session.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';
import { MIN_ZOOM, MAX_ZOOM, MAX_ACTIVE_TRUE_ENGINE, clamp } from './prairie-constants.js';
import { clearParticles } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';

function showFeature(state) {
    if (!state.root) return;
    state.root.hidden = false;
    state.root.style.visibility = 'visible';
    state.root.style.opacity = '1';
    state.root.style.pointerEvents = 'auto';
    state.root.style.position = 'relative';
    state.root.style.inset = '';
}

function hideFeature(state) {
    if (!state.root) return;
    state.root.hidden = false;
    state.root.style.visibility = 'hidden';
    state.root.style.opacity = '0';
    state.root.style.pointerEvents = 'none';
    state.root.style.position = 'absolute';
    state.root.style.inset = '0';
}

function bindResize(state) {
    if (state.resizeObserver || !state.viewport) return;
    if (typeof ResizeObserver === 'function') {
        state.resizeObserver = new ResizeObserver(() => resize(state));
        state.resizeObserver.observe(state.viewport);
        return;
    }
    const onResize = () => resize(state);
    window.addEventListener('resize', onResize);
    state.resizeObserver = { disconnect: () => window.removeEventListener('resize', onResize) };
}

function subscribeRepository(state) {
    if (state.unsubscribeRepository) return;
    state.unsubscribeRepository = state.storageContext.repository.subscribe(() => {
        const latestActiveIds = [];
        for (const canonicalId of state.activeCanonicalIds) {
            const nextRecord = findRecordById(state, canonicalId);
            const entry = state.runtimeById.get(canonicalId);
            if (!nextRecord || !entry) {
                state.runtimeById.delete(canonicalId);
                continue;
            }
            entry.record = nextRecord;
            latestActiveIds.push(canonicalId);
        }
        state.activeCanonicalIds = latestActiveIds;
        renderDronePanel(state);
    });
}

function bootstrapPrairieRuntime(state) {
    resize(state);
    bindResize(state);
    subscribeRepository(state);
    bindInteractions(state);
    clearParticles();
    state.interactionEngine.reset();

    const savedIds = state.activeCanonicalIds.filter((canonicalId) => !!findRecordById(state, canonicalId)).slice(0, MAX_ACTIVE_TRUE_ENGINE);
    state.runtimeById.clear();
    state.activeCanonicalIds = [];

    savedIds.forEach((canonicalId, index) => {
        const record = findRecordById(state, canonicalId);
        if (!record) return;
        const slime = createCanonicalRuntime(state, record, index, getSavedPrairiePlacement(state, record, index), -1.2);
        if (!slime) return;
        state.runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
        state.activeCanonicalIds.push(canonicalId);
    });

    if (state.activeCanonicalIds.length) {
        const firstRecord = findRecordById(state, state.activeCanonicalIds[0]);
        const prairieCamera = firstRecord?.prairieState?.camera;
        if (prairieCamera && Number.isFinite(prairieCamera.x) && Number.isFinite(prairieCamera.y)) {
            state.camera = {
                x: prairieCamera.x,
                y: prairieCamera.y,
                zoom: clamp(Number.isFinite(prairieCamera.zoom) ? prairieCamera.zoom : state.camera.zoom, MIN_ZOOM, MAX_ZOOM),
            };
            clampCamera(state);
        }
    }

    renderDronePanel(state);
    applyPanelLayout(state);
    syncSceneTransform(state);
    drawFrame(state);
    renderMinimap(state);
    startLoop(state);
}

export function createPrairieFeature() {
    const state = createPrairieContext();

    return {
        id: 'prairie',
        mount(context) {
            ensureShell(state, context.mount);
            state.isSuspended = false;
            stopBackgroundTick(state);
            showFeature(state);
            bootstrapPrairieRuntime(state);
            SlimeSoundEngine.playBGM('./audio/ambiance.mp3');
        },
        resume(context) {
            ensureShell(state, context.mount);
            state.isSuspended = false;
            stopBackgroundTick(state);
            showFeature(state);
            bootstrapPrairieRuntime(state);
            SlimeSoundEngine.playBGM('./audio/ambiance.mp3');
        },
        suspend() {
            if (!state.root || state.isSuspended) return;
            state.isSuspended = true;
            SlimeSoundEngine.stopBGM();
            persistAllActiveRecords(state, 'prairie_suspend');
            saveSession({ activeCanonicalIds: [...state.activeCanonicalIds], camera: { ...state.camera }, panel: state.panelLayout });
            stopLoop(state);
            startBackgroundTick(state);
            clearTimeout(state.saveTimeout);
            window.clearTimeout(state.dronePanelCloseTimeout);
            clearInterval(state.obsUpdateInterval);
            clearParticles();
            hideFeature(state);
        },
        syncLayout() {
            if (state.isSuspended) return;
            resize(state);
        },
        unmount() {
            persistAllActiveRecords(state, 'prairie_unmount');
            saveSession({ activeCanonicalIds: [...state.activeCanonicalIds], camera: { ...state.camera }, panel: state.panelLayout });
            teardownLoop(state);
            SlimeSoundEngine.stopBGM();
            clearTimeout(state.saveTimeout);
            window.clearTimeout(state.dronePanelCloseTimeout);
            clearInterval(state.obsUpdateInterval);
            clearParticles();
            state.resizeObserver?.disconnect?.();
            state.resizeObserver = null;
            state.unsubscribeRepository?.();
            state.unsubscribeRepository = null;
            state.runtimeById.clear();
            state.activeCanonicalIds = [];
            state.interactionsBound = false;
            if (state.currentMount) {
                state.currentMount.classList.remove('content-mount--prairie');
            }
            state.root?.remove?.();
            
            // On vide les variables principales du state pour éviter les fuites de mémoire
            state.root = null;
            state.viewport = null;
            state.viewportEdgeRect = null;
            state.scene = null;
            state.canvas = null;
            state.minimapCanvas = null;
            state.droneToggle = null;
            state.dronePanel = null;
            state.droneClose = null;
            state.droneTeamGrid = null;
            state.droneArchiveGrid = null;
            state.currentMount = null;
        },
    };
}