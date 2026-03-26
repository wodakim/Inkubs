/**
 * storage-canonical-inspection-sandbox.js
 *
 * Isolated live viewer — owns its RAF loop.
 * 
 * SINGLETON SAFETY: Before every frame we read the current global runtimeState,
 * install our own canvas/ctx/viewport/slime, render, then RESTORE the previous
 * values. This means the incubator's SlimeEngine always finds its own context
 * intact when its gameLoop runs — no cross-corruption.
 */

import { t } from '../../i18n/i18n.js';
import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';
import { Slime }    from '../../vendor/inku-slime-v3/engine/entities/Slime.js';
import { Particle } from '../../vendor/inku-slime-v3/engine/entities/Particle.js';
import {
    canvas     as globalCanvas,
    ctx        as globalCtx,
    viewportWidth  as globalVW,
    viewportHeight as globalVH,
    worldWidth     as globalWW,
    worldHeight    as globalWH,
    currentSlime   as globalSlime,
    particles,
    setCanvas, setViewport, setWorldBounds, setCurrentSlime,
} from '../../vendor/inku-slime-v3/runtime/runtimeState.js';

const TAP_MAX_MS      = 220;
const TAP_MAX_MOVE    = 10;
const PINCH_SENS      = 0.04; // was 0.08 – halved to prevent over-aggressive pinch deformation

/* ─── blueprint builder ──────────────────────────────────────────────── */

export function buildCanonicalBlueprintFromRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const cs = record.canonicalSnapshot || {};
    const pc = deepClone(cs.proceduralCore || record.proceduralCore || {});
    const id = deepClone(record.identity || record.claimPayload?.identity || {});
    const ls = deepClone(record.livingState || cs.livingState || record.claimPayload?.livingState || null);
    if (!pc.type || !pc.baseRadius || !pc.genome || !pc.bodyProfile) return null;
    return {
        schemaVersion:  id.blueprintSchemaVersion || 1,
        proceduralSeed: id.proceduralSeed || cs.proceduralSeed || `canon_${record.canonicalId || 'specimen'}`,
        type: pc.type, baseRadius: pc.baseRadius,
        numNodes: pc.numNodes || pc.bodyProfile?.numNodes || 25,
        genome: pc.genome, stats: pc.stats || {}, bodyProfile: pc.bodyProfile,
        livingState: ls,
        identity: {
            runtimeId: record.runtimeId || id.runtimeId || null,
            schemaVersion: id.schemaVersion || 1, lifecycle: 'canonical',
            proceduralSeed: id.proceduralSeed || null,
            proceduralFingerprint: id.proceduralFingerprint || null,
            templateFingerprint:  id.templateFingerprint  || null,
            blueprintSchemaVersion: id.blueprintSchemaVersion || 1,
            genomeSchemaVersion: id.genomeSchemaVersion || null,
            statsSchemaVersion:  id.statsSchemaVersion  || null,
            canonical: {
                schemaVersion: id.canonical?.schemaVersion || 2, status: 'claimed',
                canonicalId: record.canonicalId || null, claimedAt: record.acquiredAt || null,
                ownerId: record.ownerId || null, source: record.source || 'inventory_claim',
            },
        },
    };
}

/* ─── sandbox factory ────────────────────────────────────────────────── */

export function createCanonicalInspectionSandbox() {
    let mountTarget = null, root = null, canvas = null, localCtx = null;
    let slime = null, localParticles = [], rafId = 0;
    let currentBlueprint = null, currentRecord = null, resizeObserver = null;
    let activeSinglePointer = null, pinchState = null;
    const activePointers = new Map(), cleanupCallbacks = [];

    /* ── mount ── */
    function mount(target, record) {
        destroy();
        currentBlueprint = buildCanonicalBlueprintFromRecord(record);
        currentRecord    = record;
        mountTarget      = target;
        if (!mountTarget) return;

        if (!currentBlueprint) {
            mountTarget.innerHTML = `<div class="storage-live-sandbox storage-live-sandbox--fallback"><p>${t('sandbox.unavailable')}</p></div>`;
            return;
        }

        root = document.createElement('div');
        root.className = 'storage-live-sandbox';
        root.innerHTML = `<div class="storage-live-sandbox__viewport">
            <canvas class="storage-live-sandbox__canvas" aria-label="${t('sandbox.canvas_aria')}"></canvas>
            <span class="storage-live-sandbox__live-dot" aria-hidden="true"></span>
        </div>`;
        mountTarget.replaceChildren(root);

        canvas   = root.querySelector('.storage-live-sandbox__canvas');
        localCtx = canvas?.getContext('2d', { alpha: true });
        if (!canvas || !localCtx) return;

        sizeCanvas();
        doSpawn();
        bindInteractions(record);
        bindResize();
        startLoop();
    }

    /* ── canvas sizing ── */
    function sizeCanvas() {
        if (!canvas) return;
        const vp = canvas.parentElement || root;
        const w  = Math.max(1, Math.round(vp.clientWidth  || 200));
        const h  = Math.max(1, Math.round(vp.clientHeight || 190));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
        }
    }

    function getBounds() {
        const pad = Math.max(8, Math.min(canvas.width, canvas.height) * 0.07);
        return { left: pad, top: pad, right: canvas.width - pad, bottom: canvas.height - pad };
    }

    /* ── spawn ── */
    function doSpawn() {
        if (!canvas || !currentBlueprint) return;

        // Install our context so Slime constructor picks up our dimensions
        withOwnContext(() => {
            const b = getBounds();
            slime = new Slime({
                blueprint:     deepClone(currentBlueprint),
                spawnX:        canvas.width  * 0.5,
                spawnY:        canvas.height * 0.58,
                spawnImpulseY: -2.5,
                spawnImpulseX: 0,
                boxPadding:    b.left,
            });
            if (!slime) return;
            slime.worldBounds = b;

            const rp = currentRecord?.canonicalSnapshot?.runtimePose || {};
            if (rp.facing === -1 || rp.facing === 1) slime.facing = rp.facing;

            // Ensure rarity-related genome fields reach the live slime for aura rendering
            const genome = currentBlueprint?.genome || {};
            if (genome.rarityTier)   slime.rarityTier   = genome.rarityTier;
            if (genome.rarityScore !== undefined) slime.rarityScore = genome.rarityScore;
            if (genome.colorPattern) slime.colorPattern = genome.colorPattern;

            slime.explode = function sandboxRespawn() {
                for (let i = 0; i < 20; i++) {
                    const src = this.nodes?.[Math.floor(Math.random() * (this.nodes?.length || 1))];
                    if (src) localParticles.push(new Particle(src.x, src.y, this.color));
                }
                doSpawn();
            };

            for (let i = 0; i < 14; i++) slime.update();
        });
    }

    /* ── RAF loop ── */
    function startLoop() { stopLoop(); rafId = requestAnimationFrame(tick); }
    function stopLoop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

    function tick() {
        if (!canvas || !localCtx || !slime) { rafId = requestAnimationFrame(tick); return; }

        // Re-pin local bounds every frame (defensive)
        slime.worldBounds = getBounds();

        withOwnContext(() => {
            // Update physics + particles
            slime.update();
            for (let i = localParticles.length - 1; i >= 0; i--) {
                localParticles[i].update();
                if (localParticles[i].life <= 0) localParticles.splice(i, 1);
            }

            // Draw
            localCtx.setTransform(1, 0, 0, 1, 0, 0);
            localCtx.clearRect(0, 0, canvas.width, canvas.height);
            slime.draw();
            for (const p of localParticles) p.draw();
            localCtx.setTransform(1, 0, 0, 1, 0, 0);
        });

        rafId = requestAnimationFrame(tick);
    }

    /**
     * withOwnContext — saves the FULL global singleton state, installs ours,
     * runs fn, then RESTORES everything. This is the key to co-existing safely
     * with SlimeEngine (incubator/prairie) without a full engine refactor.
     */
    function withOwnContext(fn) {
        if (!canvas || !localCtx) { fn(); return; }

        // ── Save current global state (live bindings — read their current values)
        const savedCanvas  = globalCanvas;
        const savedCtx     = globalCtx;
        const savedVW      = globalVW;
        const savedVH      = globalVH;
        const savedWW      = globalWW;
        const savedWH      = globalWH;
        const savedSlime   = globalSlime;

        // ── Install our own context
        setCanvas(canvas, localCtx);
        setViewport(canvas.width, canvas.height);
        setWorldBounds(canvas.width, canvas.height);
        setCurrentSlime(slime);

        // ── Swap particles array
        const externalParticles = particles.splice(0);
        particles.push(...localParticles);

        try {
            fn();
        } finally {
            // ── Harvest any new local particles
            localParticles = [...particles];
            particles.splice(0);

            // ── Restore external particles
            particles.push(...externalParticles);

            // ── Restore global singleton state EXACTLY as it was
            if (savedCanvas && savedCtx) {
                setCanvas(savedCanvas, savedCtx);
            }
            setViewport(savedVW, savedVH);
            setWorldBounds(savedWW, savedWH);
            setCurrentSlime(savedSlime);
        }
    }

    /* ── resize ── */
    function bindResize() {
        if (typeof ResizeObserver !== 'function' || !root) return;
        resizeObserver = new ResizeObserver(() => {
            sizeCanvas();
            if (slime && canvas) slime.worldBounds = getBounds();
        });
        resizeObserver.observe(root);
    }

    /* ── interactions ── */
    function bindInteractions(record) {
        if (!canvas) return;

        const onDown = (e) => {
            const pt = toXY(e);
            if (!pt) return;
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            canvas.setPointerCapture?.(e.pointerId);
            if (activePointers.size === 1) {
                withOwnContext(() => slime?.checkGrab?.(pt.x, pt.y));
                activeSinglePointer = { pointerId: e.pointerId, startedAt: performance.now(), startClientX: e.clientX, startClientY: e.clientY, startPoint: pt };
            } else if (activePointers.size === 2) {
                withOwnContext(() => slime?.releaseGrab?.());
                activeSinglePointer = null;
                const [a, b] = [...activePointers.values()];
                pinchState = { distance: pdist(a, b), center: midXY(a, b) };
            }
        };

        const onMove = (e) => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            if (activePointers.size === 2) {
                const [a, b] = [...activePointers.values()];
                const nd = pdist(a, b), nc = midXY(a, b);
                if (pinchState && nc) {
                    withOwnContext(() => applyPinch(nc, (nd - pinchState.distance) * PINCH_SENS));
                    pinchState = { distance: nd, center: nc };
                }
                return;
            }
            if (!activeSinglePointer || activeSinglePointer.pointerId !== e.pointerId) return;

            // Let setPointerCapture handle the drag out of bounds natively, 
            // so we can drag the slime firmly without it dropping abruptly.

            const pt = toXY(e);
            if (pt) withOwnContext(() => slime?.updateGrab?.(pt.x, pt.y));
        };

        const onUp = (e) => {
            activePointers.delete(e.pointerId);
            canvas.releasePointerCapture?.(e.pointerId);
            if (activePointers.size < 2) pinchState = null;
            if (!activeSinglePointer || activeSinglePointer.pointerId !== e.pointerId) {
                withOwnContext(() => slime?.releaseGrab?.()); return;
            }
            const dur = performance.now() - activeSinglePointer.startedAt;
            const mov = Math.hypot(e.clientX - activeSinglePointer.startClientX, e.clientY - activeSinglePointer.startClientY);
            const pt  = toXY(e) || activeSinglePointer.startPoint;
            withOwnContext(() => slime?.releaseGrab?.());
            if (dur <= TAP_MAX_MS && mov <= TAP_MAX_MOVE && pt) withOwnContext(() => applyTap(pt, record));
            activeSinglePointer = null;
        };

        const onCancel = () => {
            activePointers.clear(); activeSinglePointer = null; pinchState = null;
            withOwnContext(() => slime?.releaseGrab?.());
        };

        canvas.addEventListener('pointerdown',       onDown,   { passive: true });
        canvas.addEventListener('pointermove',       onMove,   { passive: true });
        canvas.addEventListener('pointerup',         onUp,     { passive: true });
        canvas.addEventListener('pointercancel',     onCancel, { passive: true });
        canvas.addEventListener('lostpointercapture', onCancel, { passive: true });

        cleanupCallbacks.push(() => {
            canvas.removeEventListener('pointerdown',       onDown);
            canvas.removeEventListener('pointermove',       onMove);
            canvas.removeEventListener('pointerup',         onUp);
            canvas.removeEventListener('pointercancel',     onCancel);
            canvas.removeEventListener('lostpointercapture', onCancel);
        });
    }

    function applyTap(pt, record) {
        if (!slime || !pt) return;
        const c = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!c) return;
        const dx = c.x - pt.x, dy = c.y - pt.y;
        const d  = Math.max(10, Math.hypot(dx, dy));
        const ix = (dx / d) * 1.8, iy = (dy / d) * 1.6 - 1.2;
        const reach = Math.max(slime.baseRadius * 1.75, 48);
        for (const n of slime.nodes || []) {
            const f = Math.max(0, 1 - Math.hypot(n.x - pt.x, n.y - pt.y) / reach);
            if (f > 0) { n.oldX = n.x - ix * f; n.oldY = n.y - iy * f; }
        }
        const arch = record?.livingState?.cognition?.archetype || '';
        slime.triggerAction?.(/shy|scary|timid/i.test(arch) ? 'question' : 'observe', 440, 0.6);
    }

    function applyPinch(center, delta) {
        if (!slime || !center || !Number.isFinite(delta) || Math.abs(delta) < 0.02) return;
        const s   = Math.max(-1.0, Math.min(1.0, delta)); // was ±1.8 – clamped tighter to prevent explosive deformation
        const dir = s < 0 ? -1 : 1;
        for (const n of slime.nodes || []) {
            const dx = n.x - center.x, dy = n.y - center.y;
            const d  = Math.max(12, Math.hypot(dx, dy));
            const mag = Math.abs(s) * Math.max(0.24, 1 - Math.min(1, d / (slime.baseRadius * 2.2)));
            n.oldX = n.x - (dx / d) * mag * dir;
            n.oldY = n.y - (dy / d) * mag * dir;
        }
        slime.triggerAction?.(s < 0 ? 'hurt' : 'study', 320, Math.min(0.72, Math.abs(s) * 0.6));
    }

    /* ── helpers ── */
    function toXY(e) {
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect?.();
        if (!r?.width || !r?.height) return null;
        return {
            x: ((e.clientX - r.left) / r.width)  * canvas.width,
            y: ((e.clientY - r.top)  / r.height) * canvas.height,
        };
    }
    function pdist(a, b) { return Math.hypot((a?.clientX || 0) - (b?.clientX || 0), (a?.clientY || 0) - (b?.clientY || 0)); }
    function midXY(a, b) {
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect?.();
        if (!r?.width || !r?.height) return null;
        const cx = (a.clientX + b.clientX) * 0.5;
        const cy = (a.clientY + b.clientY) * 0.5;
        return { x: ((cx - r.left) / r.width) * canvas.width, y: ((cy - r.top) / r.height) * canvas.height };
    }

    /* ── destroy ── */
    function destroy() {
        stopLoop();
        resizeObserver?.disconnect?.();
        resizeObserver = null;
        cleanupCallbacks.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
        activePointers.clear();
        activeSinglePointer = null; pinchState = null;
        localParticles = []; slime = null;
        canvas = null; localCtx = null;
        root?.remove?.(); root = null;
        mountTarget = null; currentBlueprint = null; currentRecord = null;
    }

    return { mount, destroy };
}
