import { ctx as canvasCtx, particles } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { getPerfSettings } from '../../utils/device-performance-profile.js';
import { ensureCanvasRuntime } from './prairie-shell.js';
import { resizeCanvas, computeWorld, clampCamera, syncSceneTransform, applyEdgeScroll, softlyKeepSlimeNearPrairie, isSlimeOutOfPrairieBounds, resolveSlimeCollisions } from './prairie-camera.js';
import { drawPrairieObjects, drawHouseGlass, drawSpeechBubbles, updatePrairieObjects, maybeSpawnBubble } from './prairie-objects.js';
import { getActiveEntries, wasRecentlyManipulated, respawnOutOfBounds } from './prairie-slime-runtime.js';
import { renderMinimap, applyPanelLayout } from './prairie-drone-panel.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';
import { OUT_OF_BOUNDS_FRAME_THRESHOLD } from './prairie-constants.js';

export function drawFrame(state) {
    if (!state.canvas || !canvasCtx) return;
    ensureCanvasRuntime(state);
    
    const zoom = Number.isFinite(state.camera.zoom) ? state.camera.zoom : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
    const effectiveZoom = zoom * dpr;
    const translateX = (state.canvas.width * 0.5) - (state.camera.x * effectiveZoom);
    const translateY = (state.canvas.height * 0.5) - (state.camera.y * effectiveZoom);
    
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    
    canvasCtx.setTransform(effectiveZoom, 0, 0, effectiveZoom, translateX, translateY);

    // 1. Fond et objets
    drawPrairieObjects(state);

    // 2. Slimes
    for (const entry of getActiveEntries(state)) {
        entry.slime.draw();
    }

    // 3. Particules
    for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.update();
        particle.draw();
        if (particle.life <= 0) particles.splice(i, 1);
    }

    // 4. Vitre de la maison
    drawHouseGlass(state);

    // 5. Bulles
    drawSpeechBubbles(state);

    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
}

export function step(state) {
    state.rafId = window.requestAnimationFrame(() => step(state));

    try {
        if (state.pointerMode === 'slime-drag' && state.edgeScrollPointer) {
            applyEdgeScroll(state, state.edgeScrollPointer.clientX, state.edgeScrollPointer.clientY);
        }

        const now = performance.now();
        for (const entry of getActiveEntries(state)) {
            entry.slime.update();
            state.interactionEngine.handleEnvironmentInteractions(entry.slime, state.prairieObjects, now);
            if (!entry.slime.draggedNode && !wasRecentlyManipulated(entry, now)) {
                softlyKeepSlimeNearPrairie(state, entry.slime);
            }
        }
        resolveSlimeCollisions(state);

        const engineEntries = state.activeCanonicalIds
            .map((id) => ({ id, slime: state.runtimeById.get(id)?.slime }))
            .filter((e) => e.slime && !e.slime.draggedNode);
        if (engineEntries.length >= 1) {
            state.interactionEngine.tick(engineEntries, state.world, state.prairieObjects);
        }

        for (const entry of getActiveEntries(state)) {
            const slime = entry.slime;
            if (slime.draggedNode || wasRecentlyManipulated(entry, now)) continue;
            const brain = slime._prairieBrain;
            if (brain && Math.abs(brain.intentDir) > 0.05) continue;
            const gr = slime.getGroundedRatio?.() ?? 0;
            if (gr < 0.15) continue;
            const avgV = slime.getAverageVelocity?.();
            if (!avgV || Math.abs(avgV.x) > 1.5) continue;
            if (slime.locomotionState !== 'idle' && slime.locomotionState !== 'land') continue;
            for (const node of slime.nodes || []) {
                if (node === slime.draggedNode) continue;
                const vx = node.x - node.oldX;
                if (Math.abs(vx) < 0.1) node.oldX = node.x;
                else if (Math.abs(vx) < 0.5) node.oldX = node.x - vx * 0.15;
            }
        }

        for (const canonicalId of [...state.activeCanonicalIds]) {
            const entry = state.runtimeById.get(canonicalId);
            if (!entry) continue;
            if (isSlimeOutOfPrairieBounds(state, entry.slime)) {
                if (entry.slime.draggedNode || wasRecentlyManipulated(entry, now)) {
                    entry.outOfBoundsFrames = 0;
                    continue;
                }
                entry.outOfBoundsFrames = (entry.outOfBoundsFrames || 0) + 1;
                if (entry.outOfBoundsFrames >= OUT_OF_BOUNDS_FRAME_THRESHOLD) {
                    respawnOutOfBounds(state, canonicalId);
                }
                continue;
            }
            entry.outOfBoundsFrames = 0;
        }

        syncSceneTransform(state);
        updatePrairieObjects(state);

        const bubbleNow = performance.now();
        for (const entry of getActiveEntries(state)) {
            if (!entry.slime.draggedNode) {
                maybeSpawnBubble(state, entry, bubbleNow);
            }
        }
    } catch (_stepErr) {}

    drawFrame(state);
    renderMinimap(state);
}

export function backgroundTick(state) {
    const now = performance.now();
    for (const entry of getActiveEntries(state)) {
        entry.slime.update();
    }
    resolveSlimeCollisions(state);
    const engineEntries = state.activeCanonicalIds
        .map((id) => ({ id, slime: state.runtimeById.get(id)?.slime }))
        .filter((e) => e.slime && !e.slime.draggedNode);
    if (engineEntries.length >= 1) {
        state.interactionEngine.tick(engineEntries, state.world, state.prairieObjects);
    }
}

export function startBackgroundTick(state) {
    if (state.backgroundTickId) return;
    state.backgroundTickId = window.setInterval(() => backgroundTick(state), 250);
}

export function stopBackgroundTick(state) {
    if (state.backgroundTickId) {
        window.clearInterval(state.backgroundTickId);
        state.backgroundTickId = 0;
    }
}

export function handleVisibilityChange(state) {
    if (document.hidden) {
        stopLoop(state);
        stopBackgroundTick(state);
        SlimeSoundEngine.stopBGM();
    } else if (!state.isSuspended) {
        resize(state);
        startLoop(state);
        SlimeSoundEngine.playBGM('./audio/ambiance.mp3');
    } else {
        startBackgroundTick(state);
    }
}

export function handlePageShow(state) {
    if (!state.isSuspended && !state.rafId) {
        resize(state);
        startLoop(state);
    }
}

export function startLoop(state) {
    if (state.rafId) window.cancelAnimationFrame(state.rafId);
    
    // Garder une référence aux handlers liés au contexte actuel pour les cleanup plus tard
    if (!state._visibilityHandler) state._visibilityHandler = () => handleVisibilityChange(state);
    if (!state._pageShowHandler) state._pageShowHandler = () => handlePageShow(state);
    if (!state._perfHandler) state._perfHandler = () => handlePerfTierChanged(state);
    
    document.addEventListener('visibilitychange', state._visibilityHandler);
    window.addEventListener('pageshow', state._pageShowHandler);
    window.addEventListener('inku:perf-tier-changed', state._perfHandler);
    state.rafId = window.requestAnimationFrame(() => step(state));
}

export function stopLoop(state) {
    if (state.rafId) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;
    }
    if (state._perfHandler) {
        window.removeEventListener('inku:perf-tier-changed', state._perfHandler);
    }
}

export function teardownLoop(state) {
    stopLoop(state);
    stopBackgroundTick(state);
    if (state._visibilityHandler) document.removeEventListener('visibilitychange', state._visibilityHandler);
    if (state._pageShowHandler) window.removeEventListener('pageshow', state._pageShowHandler);
}

export function handlePerfTierChanged(state) {
    resizeCanvas(state);
    computeWorld(state);
    syncSceneTransform(state);
}

export function resize(state) {
    resizeCanvas(state);
    computeWorld(state);
    clampCamera(state);
    state.viewportEdgeRect = state.viewport ? state.viewport.getBoundingClientRect() : null;
    syncSceneTransform(state);
    applyPanelLayout(state);
    renderMinimap(state);
    drawFrame(state);
}