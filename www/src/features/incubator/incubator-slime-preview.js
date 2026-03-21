import { buildProceduralBlueprint } from '../../vendor/inku-slime-v3/engine/genetics/proceduralBlueprint.js';
import { createSeededRng } from '../../vendor/inku-slime-v3/shared/random.js';
import { SlimeEngine } from '../../vendor/inku-slime-v3/engine/SlimeEngine.js';

const INTAKE_ANIMATION_MS = 900;
const PURGE_ANIMATION_MS = 820;
const FLOAT_TARGET_RATIO = 0.58;
const FLOAT_BOTTOM_SPAWN_RATIO = 1.08;
const FLOAT_TOP_PADDING_RATIO = 0.07;
const FLOAT_SIDE_PADDING_RATIO = 0.08;
const FLOAT_BOTTOM_PADDING_RATIO = 0.015;
const EXTRUSION_START_RATIO = 1.08;
const SUCTION_TARGET_RATIO = -0.01;
const SUCTION_EDGE_RATIO = -0.032;
const POKE_DOUBLE_TAP_MS = 280;
const POKE_DISTANCE_THRESHOLD = 42;
const DISTURBANCE_BASE_MS = 760;

function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
}

function formatDisplayName(blueprint) {
    const seed = String(blueprint.proceduralSeed || '').slice(0, 6).toUpperCase();
    return `Specimen ${seed}`;
}

function deriveComplexityMetrics(blueprint) {
    const stats = blueprint.stats || {};
    const genome = blueprint.genome || {};

    const complexityIndex = Math.round(((stats.vitality || 0) + (stats.stability || 0) + (stats.agility || 0)) / 30);

    // Use the real rarityScore (0-100) from genome when available
    const rarityScore = Number.isFinite(genome.rarityScore) ? genome.rarityScore : null;
    let rarityIndex;
    if (rarityScore !== null) {
        if (rarityScore >= 90)      rarityIndex = 5; // legendary
        else if (rarityScore >= 75) rarityIndex = 4; // epic
        else if (rarityScore >= 55) rarityIndex = 3; // rare
        else if (rarityScore >= 30) rarityIndex = 2; // uncommon
        else                        rarityIndex = 1; // common
    } else {
        rarityIndex = Math.round(((stats.curiosity || 0) + (stats.ferocity || 0) + ((genome.accessory && genome.accessory !== 'none') ? 24 : 0)) / 40);
    }

    return {
        complexityIndex: Math.max(1, complexityIndex),
        rarityIndex: Math.max(1, rarityIndex),
        rarityScore: rarityScore ?? 0,
        rarityTier: genome.rarityTier || 'common',
    };
}

function buildPreviewBlueprint() {
    const proceduralSeed = `incu_${Math.random().toString(36).slice(2, 10)}`;
    const rng = createSeededRng(proceduralSeed);
    const baseRadius = 34 + rng() * 10;
    return buildProceduralBlueprint({
        proceduralSeed,
        baseRadius,
        numNodes: 25,
    });
}

function animateIn(wrapper) {
    wrapper.style.opacity = '1';
    wrapper.style.transform = 'translate3d(0,18px,0) scale(1.06,0.92)';
    wrapper.style.transition = `transform ${INTAKE_ANIMATION_MS}ms cubic-bezier(0.16, 0.9, 0.14, 1)`;
    requestAnimationFrame(() => {
        wrapper.style.transform = 'translate3d(0,0,0) scale(1,1)';
    });
}

function distanceBetween(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

export function createIncubatorSlimePreview() {
    let wrapper = null;
    let canvas = null;
    let engine = null;
    let currentBlueprint = null;
    let glassContainer = null;
    let frontGlass = null;
    let frontGlassRipple = null;
    let suctionPort = null;
    let inletPort = null;
    let motionRaf = 0;
    let motionMode = 'idle';
    let motionStartedAt = 0;
    let cleanupInteraction = null;
    let lastTapAt = 0;
    let lastTapPoint = null;
    let fluidDisturbance = null;
    let lastContainer = null;
    let lastCandidate = null;
    let isExternallySuspended = false;
    let suspendedSlime = null;   // local ref to incubator slime, saved at suspend time

    function createCandidatePayload() {
        const blueprint = buildPreviewBlueprint();
        return {
            id: blueprint.identity.runtimeId,
            speciesKey: blueprint.type,
            displayName: formatDisplayName(blueprint),
            complexityMetrics: deriveComplexityMetrics(blueprint),
            attributes: [
                blueprint.genome?.bodyShape,
                blueprint.genome?.mood,
                blueprint.genome?.accessory,
            ].filter(Boolean),
            metadata: {
                source: 'incubator_runtime_preview',
                proceduralSeed: blueprint.proceduralSeed,
                previewBlueprint: blueprint,
            },
        };
    }

    function cancelMotionLoop() {
        if (motionRaf) {
            cancelAnimationFrame(motionRaf);
            motionRaf = 0;
        }
    }

    function getGlassContainer(container) {
        return container?.closest?.('.glass-column') || container;
    }

    function ensureFrontLayers() {
        if (!glassContainer) return;
        frontGlass = glassContainer.querySelector('.tube-front-glass');
        if (frontGlass) {
            frontGlassRipple = frontGlass.querySelector('.tube-front-glass__tap-ripple');
            if (!frontGlassRipple) {
                frontGlassRipple = document.createElement('div');
                frontGlassRipple.className = 'tube-front-glass__tap-ripple';
                frontGlassRipple.setAttribute('aria-hidden', 'true');
                frontGlass.appendChild(frontGlassRipple);
            }
        }
        suctionPort = glassContainer.querySelector('.incubator-suction-port');
        if (!suctionPort) {
            suctionPort = document.createElement('div');
            suctionPort.className = 'incubator-suction-port';
            suctionPort.setAttribute('aria-hidden', 'true');
            glassContainer.appendChild(suctionPort);
        }
        inletPort = glassContainer.querySelector('.incubator-inlet-port');
        if (!inletPort) {
            inletPort = document.createElement('div');
            inletPort.className = 'incubator-inlet-port';
            inletPort.setAttribute('aria-hidden', 'true');
            glassContainer.appendChild(inletPort);
        }
    }

    function applyVectorImpulseToSlime(slime, impulseX = 0, impulseY = 0, radialBoost = 0) {
        if (!slime) return;
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!center) return;
        for (const node of slime.nodes || []) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
            const distance = Math.max(18, Math.hypot(dx, dy));
            const radial = radialBoost > 0 ? (1 - Math.min(1, distance / 120)) * radialBoost : 0;
            node.oldX = node.x - impulseX - (dx / distance) * radial;
            node.oldY = node.y - impulseY - (dy / distance) * radial;
        }
    }

    function queueFluidDisturbance(canvasPoint, center, isDoubleTap = false) {
        if (!canvasPoint || !center || !canvas) return;
        const rect = canvas.getBoundingClientRect?.();
        if (!rect) return;
        const normX = (center.x - canvasPoint.x) / Math.max(rect.width * 0.5, 1);
        const normY = (center.y - canvasPoint.y) / Math.max(rect.height * 0.5, 1);
        const amplitude = isDoubleTap ? 2.5 : 1.28;
        fluidDisturbance = {
            startedAt: performance.now(),
            duration: (isDoubleTap ? 1.55 : 1) * DISTURBANCE_BASE_MS,
            vx: normX * amplitude,
            vy: normY * (isDoubleTap ? 1.9 : 1.12),
            swirl: (canvasPoint.x <= center.x ? 1 : -1) * (isDoubleTap ? 1.1 : 0.52),
            buoyancy: isDoubleTap ? 0.9 : 0.42,
        };
    }

    function applyFluidDisturbance(now, slime, rect) {
        if (!fluidDisturbance || !slime || !rect || slime.draggedNode) return;
        const elapsed = now - fluidDisturbance.startedAt;
        const progress = Math.min(1, elapsed / fluidDisturbance.duration);
        if (progress >= 1) {
            fluidDisturbance = null;
            return;
        }
        const decay = Math.pow(1 - progress, 2);
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!center) return;
        const wobblePhase = elapsed * 0.012;
        for (const node of slime.nodes || []) {
            const relX = (node.x - center.x) / Math.max(rect.width * 0.42, 1);
            const relY = (node.y - center.y) / Math.max(rect.height * 0.42, 1);
            const radialFalloff = Math.max(0.12, 1 - Math.hypot(relX, relY) * 0.58);
            const swirlX = -relY * fluidDisturbance.swirl * 0.34 * decay;
            const swirlY = relX * fluidDisturbance.swirl * 0.28 * decay;
            const waveX = Math.sin(wobblePhase + relY * 3.1) * 0.05 * decay;
            const waveY = Math.cos(wobblePhase * 0.86 + relX * 2.8) * 0.04 * decay;
            const impulseX = (fluidDisturbance.vx * radialFalloff + swirlX + waveX) * decay;
            const impulseY = (fluidDisturbance.vy * radialFalloff + swirlY + waveY - fluidDisturbance.buoyancy * 0.04 * decay) * decay;
            node.oldX = node.x - impulseX;
            node.oldY = node.y - impulseY;
        }
    }

    function playGlassTapRipple(point, isDoubleTap = false) {
        if (!frontGlassRipple || !point) return;
        frontGlassRipple.classList.remove('is-active');
        void frontGlassRipple.offsetWidth;
        const size = isDoubleTap ? 30 : 20;
        frontGlassRipple.style.width = `${size}px`;
        frontGlassRipple.style.height = `${size}px`;
        // Center the ripple exactly on the touch point (negative margin trick avoids
        // conflicting with any CSS transform used by the scale-out animation).
        frontGlassRipple.style.left = `${point.x}px`;
        frontGlassRipple.style.top = `${point.y}px`;
        frontGlassRipple.style.marginLeft = `${-size / 2}px`;
        frontGlassRipple.style.marginTop = `${-size / 2}px`;
        frontGlassRipple.classList.add('is-active');
    }

    function joltPreviewWrapper(deltaX, deltaY, isDoubleTap = false) {
        if (!wrapper || typeof wrapper.animate !== 'function') return;
        wrapper.animate([
            { transform: 'translate3d(0, 0, 0) scale(1, 1)' },
            { transform: `translate3d(${deltaX * 0.45}px, ${deltaY * 0.45}px, 0) scale(${isDoubleTap ? 1.04 : 1.018}, ${isDoubleTap ? 0.96 : 0.987})` },
            { transform: 'translate3d(0, 0, 0) scale(1, 1)' },
        ], {
            duration: isDoubleTap ? 360 : 240,
            easing: isDoubleTap ? 'cubic-bezier(0.14, 0.82, 0.16, 1)' : 'cubic-bezier(0.18, 0.7, 0.2, 1)',
        });
    }

    function getPointerPoint(event) {
        const rect = frontGlass?.getBoundingClientRect?.();
        if (!rect) return null;
        const source = event.touches?.[0] || event.changedTouches?.[0] || event;
        return {
            x: source.clientX - rect.left,
            y: source.clientY - rect.top,
        };
    }

    function mapGlassPointToCanvas(point) {
        const glassRect = frontGlass?.getBoundingClientRect?.();
        const canvasRect = canvas?.getBoundingClientRect?.();
        if (!point || !glassRect || !canvasRect || !canvas) return null;
        // Convert glass-relative point → absolute client coords → canvas-pixel coords.
        // This correctly handles the canvas being inset inside the glass (wrapper padding)
        // as well as DPR scaling (canvas.width may differ from canvasRect.width).
        const clientX = point.x + glassRect.left;
        const clientY = point.y + glassRect.top;
        return {
            x: ((clientX - canvasRect.left) / Math.max(canvasRect.width, 1)) * (canvas.width || canvasRect.width),
            y: ((clientY - canvasRect.top) / Math.max(canvasRect.height, 1)) * (canvas.height || canvasRect.height),
        };
    }

    function clientToSlimeCoords(clientX, clientY) {
        const rect = canvas?.getBoundingClientRect?.();
        if (!rect || !canvas) return null;
        return {
            x: ((clientX - rect.left) / Math.max(rect.width, 1)) * (canvas.width || rect.width),
            y: ((clientY - rect.top) / Math.max(rect.height, 1)) * (canvas.height || rect.height),
        };
    }

    function isClientOutsideFrontGlass(clientX, clientY) {
        const rect = frontGlass?.getBoundingClientRect?.();
        if (!rect) return true;
        const margin = 24; // px tolerance so finger can graze the edge
        return clientX < rect.left - margin || clientX > rect.right + margin ||
               clientY < rect.top - margin || clientY > rect.bottom + margin;
    }

    function applyShockToSlime(point, strength = 1, isDoubleTap = false) {
        const slime = engine?.getCurrentSlime?.();
        if (!slime || !point || !canvas) return;
        const rect = canvas.getBoundingClientRect?.();
        if (!rect) return;

        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!center) return;

        const canvasPoint = mapGlassPointToCanvas(point);
        if (!canvasPoint) return;

        const normalizedPoint = {
            x: point.x / Math.max(1, frontGlass?.getBoundingClientRect?.().width || rect.width),
            y: point.y / Math.max(1, frontGlass?.getBoundingClientRect?.().height || rect.height),
        };
        const toCenterX = center.x - canvasPoint.x;
        const toCenterY = center.y - canvasPoint.y;
        const rawDistance = Math.hypot(toCenterX, toCenterY);
        const distance = Math.max(1, rawDistance);
        const awayX = toCenterX / distance;
        const awayY = toCenterY / distance;
        const impulseMagnitude = (isDoubleTap ? 2.15 : 1.14) * strength;
        const impulseX = awayX * impulseMagnitude;
        const impulseY = awayY * impulseMagnitude;

        applyVectorImpulseToSlime(slime, impulseX, impulseY, isDoubleTap ? 0.6 : 0.18);
        queueFluidDisturbance(canvasPoint, center, isDoubleTap);
        slime.triggerAction?.(isDoubleTap ? 'flee' : 'observe', isDoubleTap ? 1480 : 720, isDoubleTap ? 1.22 : 0.82);
        playGlassTapRipple(point, isDoubleTap);
        joltPreviewWrapper((normalizedPoint.x - 0.5) * (isDoubleTap ? 20 : 10), (normalizedPoint.y - 0.5) * (isDoubleTap ? 16 : 8), isDoubleTap);
    }

    function bindGlassInteractions() {
        cleanupInteraction?.();
        if (!frontGlass) return;

        // Prevent the browser from stealing the gesture for scroll/pan.
        // Without this, the browser fires pointercancel the moment it
        // detects a drag, immediately dropping the slime grab.
        const prevTouchAction = frontGlass.style.touchAction;
        frontGlass.style.touchAction = 'none';

        let dragPointerId = null;

        const onPointerDown = (event) => {
            const point = getPointerPoint(event);
            if (!point) return;

            // Try to grab the slime for dragging first.
            if (dragPointerId === null) {
                const slime = engine?.getCurrentSlime?.();
                const cp = clientToSlimeCoords(event.clientX, event.clientY);
                if (slime && cp) {
                    slime.checkGrab?.(cp.x, cp.y);
                    if (slime.draggedNode) {
                        dragPointerId = event.pointerId;
                        frontGlass.setPointerCapture?.(event.pointerId);
                        return; // Grabbed – skip shock interaction.
                    }
                }
            }

            // Not close enough to grab: fall back to tap/shock interaction.
            const now = performance.now();
            const isDoubleTap = (now - lastTapAt) <= POKE_DOUBLE_TAP_MS &&
                distanceBetween(point, lastTapPoint) <= POKE_DISTANCE_THRESHOLD;
            applyShockToSlime(point, isDoubleTap ? 1.2 : 1, isDoubleTap);
            lastTapAt = now;
            lastTapPoint = point;
        };

        const onPointerMove = (event) => {
            if (event.pointerId !== dragPointerId) return;
            const slime = engine?.getCurrentSlime?.();
            if (!slime?.draggedNode) {
                dragPointerId = null;
                return;
            }
            // Natural detach: release when finger strays outside the incubator glass.
            if (isClientOutsideFrontGlass(event.clientX, event.clientY)) {
                slime.releaseGrab?.();
                dragPointerId = null;
                frontGlass.releasePointerCapture?.(event.pointerId);
                return;
            }
            const cp = clientToSlimeCoords(event.clientX, event.clientY);
            if (cp) slime.updateGrab?.(cp.x, cp.y);
        };

        const onPointerUp = (event) => {
            if (event.pointerId !== dragPointerId) return;
            engine?.getCurrentSlime?.()?.releaseGrab?.();
            dragPointerId = null;
            frontGlass.releasePointerCapture?.(event.pointerId);
        };

        const onPointerCancel = () => {
            engine?.getCurrentSlime?.()?.releaseGrab?.();
            dragPointerId = null;
        };

        frontGlass.addEventListener('pointerdown',       onPointerDown,   { passive: true });
        frontGlass.addEventListener('pointermove',       onPointerMove,   { passive: true });
        frontGlass.addEventListener('pointerup',         onPointerUp,     { passive: true });
        frontGlass.addEventListener('pointercancel',     onPointerCancel, { passive: true });
        frontGlass.addEventListener('lostpointercapture', onPointerCancel, { passive: true });

        cleanupInteraction = () => {
            frontGlass?.removeEventListener('pointerdown',       onPointerDown);
            frontGlass?.removeEventListener('pointermove',       onPointerMove);
            frontGlass?.removeEventListener('pointerup',         onPointerUp);
            frontGlass?.removeEventListener('pointercancel',     onPointerCancel);
            frontGlass?.removeEventListener('lostpointercapture', onPointerCancel);
            // Restore touch-action to what it was before we set it.
            if (frontGlass) frontGlass.style.touchAction = prevTouchAction;
            dragPointerId = null;
            cleanupInteraction = null;
        };
    }

    function mountCanvas(container) {
        glassContainer = getGlassContainer(container);
        ensureFrontLayers();

        wrapper = document.createElement('div');
        wrapper.dataset.incubatorRenderedCandidate = 'true';
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${FLOAT_SIDE_PADDING_RATIO * 100}%`;
        wrapper.style.right = `${FLOAT_SIDE_PADDING_RATIO * 100}%`;
        wrapper.style.top = `${FLOAT_TOP_PADDING_RATIO * 100}%`;
        wrapper.style.bottom = `${FLOAT_BOTTOM_PADDING_RATIO * 100}%`;
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'stretch';
        wrapper.style.justifyContent = 'center';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.willChange = 'transform, opacity';
        wrapper.style.zIndex = '2';

        canvas = document.createElement('canvas');
        canvas.dataset.incubatorSlimeCanvas = 'true';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.pointerEvents = 'none';
        canvas.style.background = 'transparent';
        canvas.style.filter = 'saturate(1.04)';

        wrapper.appendChild(canvas);
        glassContainer.appendChild(wrapper);
        animateIn(wrapper);
        bindGlassInteractions();
    }

    function computeTargetY(rect, progress) {
        const startY = rect.height * EXTRUSION_START_RATIO;
        const endY = rect.height * FLOAT_TARGET_RATIO;
        return startY + (endY - startY) * easeOutCubic(progress);
    }

    function setAspirationVisualState(active) {
        if (!glassContainer) return;
        glassContainer.dataset.aspirating = active ? 'true' : 'false';
        if (suctionPort) suctionPort.style.opacity = active ? '1' : '0';
    }

    function setExtrusionVisualState(active) {
        if (!glassContainer) return;
        glassContainer.dataset.extruding = active ? 'true' : 'false';
        if (inletPort) inletPort.style.opacity = active ? '1' : '0';
    }

    function startMotionLoop(initialMode = 'extruding') {
        cancelMotionLoop();
        motionMode = initialMode;
        motionStartedAt = performance.now();
        setAspirationVisualState(false);
        setExtrusionVisualState(initialMode === 'extruding');

        const tick = (now) => {
            if (!engine || !canvas) {
                motionRaf = 0;
                return;
            }

            const slime = engine.getCurrentSlime?.();
            const rect = canvas.getBoundingClientRect?.();
            if (!slime || !rect) {
                motionRaf = requestAnimationFrame(tick);
                return;
            }

            const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
            if (!center) {
                motionRaf = requestAnimationFrame(tick);
                return;
            }

            if (motionMode === 'extruding') {
                setExtrusionVisualState(true);
                const progress = Math.min(1, (now - motionStartedAt) / INTAKE_ANIMATION_MS);
                const targetY = computeTargetY(rect, progress);
                const deltaY = center.y - targetY;
                if (deltaY > 0.5) {
                    engine.applyVerticalImpulse(-Math.min(1.46 + deltaY * 0.052, 2.7));
                }
                if (wrapper) {
                    const squash = 1 - (1 - progress) * 0.16;
                    const stretch = 0.78 + progress * 0.22;
                    wrapper.style.opacity = '1';
                    wrapper.style.transform = `translate3d(0, ${18 * (1 - progress)}px, 0) scale(${1 / squash}, ${stretch})`;
                }
                if (progress >= 1) {
                    motionMode = 'floating';
                    motionStartedAt = now;
                    setExtrusionVisualState(false);
                }
            } else if (motionMode === 'floating') {
                setExtrusionVisualState(false);
                const targetY = rect.height * FLOAT_TARGET_RATIO;
                const deltaY = center.y - targetY;
                // Pause auto-float targeting while the player is manually dragging the slime.
                if (!slime.draggedNode) {
                    if (deltaY > 5) {
                        engine.applyVerticalImpulse(-Math.min(0.22 + deltaY * 0.012, 0.88));
                    } else if (deltaY < -12) {
                        engine.applyVerticalImpulse(Math.min(0.08 + Math.abs(deltaY) * 0.004, 0.24));
                    }
                }
                if (wrapper) {
                    wrapper.style.opacity = '1';
                    // Freeze the drift while the player is dragging – the canvas must
                    // stay still so getBoundingClientRect() stays stable for coordinate
                    // mapping.  Resume drift animation on the next frame after release.
                    if (!slime.draggedNode) {
                        const t = (now - motionStartedAt) / 1000;
                        const driftX = Math.sin(t * 1.1) * 2.2;
                        const driftY = Math.cos(t * 1.7) * 1.4;
                        wrapper.style.transform = `translate3d(${driftX}px, ${driftY}px, 0) scale(1,1)`;
                    }
                }
            } else if (motionMode === 'aspirating') {
                setAspirationVisualState(true);
                setExtrusionVisualState(false);
                const progress = Math.min(1, (now - motionStartedAt) / PURGE_ANIMATION_MS);
                const targetY = rect.height * (progress > 0.64 ? SUCTION_EDGE_RATIO : SUCTION_TARGET_RATIO);
                const deltaY = center.y - targetY;
                if (deltaY > -10) {
                    engine.applyVerticalImpulse(-Math.min(1.62 + Math.max(deltaY, 0) * 0.05, 3.25));
                }
                if (wrapper) {
                    const rise = 48 * progress;
                    const squeezeX = 1 - Math.max(0, progress - 0.42) * 0.34;
                    const stretchY = 1 + Math.max(0, progress - 0.24) * 0.48;
                    const fade = progress < 0.9 ? 1 : Math.max(0, 1 - ((progress - 0.9) / 0.1));
                    wrapper.style.opacity = String(fade);
                    wrapper.style.transform = `translate3d(0, ${-rise}px, 0) scale(${squeezeX}, ${stretchY})`;
                }
            }

            applyFluidDisturbance(now, slime, rect);
            motionRaf = requestAnimationFrame(tick);
        };

        motionRaf = requestAnimationFrame(tick);
    }

    function mountPreviewRuntime({ startMotion = 'extruding', spawnImpulseY = -16.4 } = {}) {
        if (!canvas || !currentBlueprint) {
            return;
        }

        engine?.destroy();
        engine = new SlimeEngine({
            canvas,
            interactive: false,
            showContainmentBox: false,
            autoExposeDebugBridge: false,
        });
        engine.resize();

        const rect = canvas.getBoundingClientRect();
        const boxPadding = Math.max(6, Math.min(rect.width, rect.height) * 0.028);
        const spawnX = rect.width * 0.5;
        const spawnY = rect.height * FLOAT_BOTTOM_SPAWN_RATIO;
        const slime = engine.spawnSlime({
            blueprint: currentBlueprint,
            spawnX,
            spawnY,
            spawnImpulseY,
            boxPadding,
        });
        const originalDraw = slime.draw.bind(slime);
        slime.draw = function patchedDraw(...args) {
            if (this.renderPose) {
                this.renderPose.shadowAlphaBoost = -4;
            }
            return originalDraw(...args);
        };
        slime.boxPadding = boxPadding;
        engine.start();
        startMotionLoop(startMotion);
    }

    function renderCandidate(container, candidate) {
        clear();
        lastContainer = container || null;
        lastCandidate = candidate || null;
        currentBlueprint = candidate?.metadata?.previewBlueprint || buildPreviewBlueprint();
        isExternallySuspended = false;
        mountCanvas(container);
        mountPreviewRuntime({ startMotion: 'extruding', spawnImpulseY: -16.4 });
    }

    function beginAspiration() {
        motionMode = 'aspirating';
        motionStartedAt = performance.now();
        setAspirationVisualState(true);
        setExtrusionVisualState(false);
        if (engine) {
            engine.applyVerticalImpulse(-13.8);
        }
        if (wrapper) {
            wrapper.style.transition = `transform ${PURGE_ANIMATION_MS}ms cubic-bezier(0.22, 0.82, 0.18, 1), opacity ${PURGE_ANIMATION_MS}ms linear`;
        }
    }

    function syncLayout() {
        engine?.resize();
        const slime = engine?.getCurrentSlime?.();
        if (slime && canvas) {
            slime.boxPadding = Math.max(6, Math.min(canvas.width, canvas.height) * 0.028);
        }
    }

    function ensureRuntimeAvailable() {
        if (engine?.getCurrentSlime?.()) {
            return true;
        }

        if (!currentBlueprint) {
            return false;
        }

        if (!canvas && lastContainer) {
            mountCanvas(lastContainer);
        }

        if (!canvas) {
            return false;
        }

        mountPreviewRuntime({ startMotion: 'extruding', spawnImpulseY: -13.2 });
        return Boolean(engine?.getCurrentSlime?.());
    }

    function clear() {
        cancelMotionLoop();
        cleanupInteraction?.();
        setAspirationVisualState(false);
        setExtrusionVisualState(false);
        engine?.destroy();
        engine = null;
        canvas = null;
        currentBlueprint = null;
        lastContainer = null;
        lastCandidate = null;
        isExternallySuspended = false;
        glassContainer = null;
        frontGlassRipple?.remove();
        frontGlassRipple = null;
        frontGlass = null;
        suctionPort?.remove();
        suctionPort = null;
        inletPort?.remove();
        inletPort = null;
        wrapper?.remove();
        wrapper = null;
        motionMode = 'idle';
        motionStartedAt = 0;
        lastTapAt = 0;
        lastTapPoint = null;
        suspendedSlime = null;
        isExternallySuspended = false;
    }

    function exportCanonicalClaimPayload(options = {}) {
        ensureRuntimeAvailable();
        return engine?.getCurrentSlime?.()?.exportCanonicalClaimPayload?.(options) || null;
    }

    function exportCanonicalSnapshot() {
        ensureRuntimeAvailable();
        return engine?.getCurrentSlime?.()?.exportCanonicalSnapshot?.() || null;
    }

    function bindCanonicalClaim(canonicalRecord) {
        ensureRuntimeAvailable();
        return engine?.getCurrentSlime?.()?.bindCanonicalClaim?.(canonicalRecord) || null;
    }

    function suspendForExternalRuntime() {
        if (!engine) {
            return false;
        }
        cancelMotionLoop();
        cleanupInteraction?.();
        cleanupInteraction = null;
        fluidDisturbance = null;
        engine.stop();
        isExternallySuspended = true;
        suspendedSlime = null;
        return true;
    }

    function resumeAfterExternalRuntime() {
        if (!isExternallySuspended || !canvas || !currentBlueprint) {
            return false;
        }
        isExternallySuspended = false;
        suspendedSlime = null;

        // Defer the spawn by one RAF frame so the browser has completed layout
        // and canvas.getBoundingClientRect() returns correct non-zero dimensions.
        engine?.destroy?.();
        engine = null;
        requestAnimationFrame(() => {
            if (!canvas || !currentBlueprint) return;
            // Verify canvas has real dimensions before spawning
            const rect = canvas.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) {
                // Still no layout — wait one more frame
                requestAnimationFrame(() => {
                    if (canvas && currentBlueprint) {
                        ensureFrontLayers();
                        bindGlassInteractions();
                        mountPreviewRuntime({ startMotion: 'extruding', spawnImpulseY: -13.2 });
                    }
                });
                return;
            }
            ensureFrontLayers();
            bindGlassInteractions();
            mountPreviewRuntime({ startMotion: 'idle', spawnImpulseY: -6.8 });
        });
        return true;
    }

    return {
        createCandidatePayload,
        renderCandidate,
        beginAspiration,
        syncLayout,
        clear,
        ensureRuntimeAvailable,
        exportCanonicalClaimPayload,
        exportCanonicalSnapshot,
        bindCanonicalClaim,
        suspendForExternalRuntime,
        resumeAfterExternalRuntime,
    };
}
