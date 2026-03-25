import { getPerfSettings } from '../../utils/device-performance-profile.js';
import { setViewport, setWorldBounds } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { clamp, DEFAULT_WORLD_SCALE_X, DEFAULT_WORLD_SCALE_Y, MIN_ZOOM, MAX_ZOOM, EDGE_SCROLL_ZONE, EDGE_SCROLL_SPEED, OUT_OF_BOUNDS_SOFT_TOLERANCE, OUT_OF_BOUNDS_HARD_TOLERANCE } from './prairie-constants.js';
import { buildPrairieObjects } from './prairie-objects.js'; // Sera créé à la prochaine étape
import { getActiveEntries, getSlimeRadius } from './prairie-slime-runtime.js';

export function resizeCanvas(ctx) {
    if (!ctx.canvas || !ctx.viewport) {
        return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
    const cssWidth = Math.max(1, Math.round(ctx.viewport.clientWidth || ctx.canvas.clientWidth || 390));
    const cssHeight = Math.max(1, Math.round(ctx.viewport.clientHeight || ctx.canvas.clientHeight || 720));
    const nextWidth = Math.round(cssWidth * dpr);
    const nextHeight = Math.round(cssHeight * dpr);
    ctx.canvas.width = nextWidth;
    ctx.canvas.height = nextHeight;
    ctx.canvas.style.width = cssWidth + 'px';
    ctx.canvas.style.height = cssHeight + 'px';
    setViewport(nextWidth, nextHeight);
}

export function computeWorld(ctx) {
    const width = Math.max(1, Math.round(ctx.viewport?.clientWidth || ctx.canvas?.clientWidth || 390));
    const height = Math.max(1, Math.round(ctx.viewport?.clientHeight || ctx.canvas?.clientHeight || 720));
    const nextWorldWidth = Math.max(2400, Math.round(width * DEFAULT_WORLD_SCALE_X));
    const nextWorldHeight = Math.max(1600, Math.round(height * DEFAULT_WORLD_SCALE_Y));
    const groundY = Math.round(nextWorldHeight * 0.74);
    ctx.world = {
        width: nextWorldWidth,
        height: nextWorldHeight,
        groundY,
        left: 42,
        top: 76,
        right: nextWorldWidth - 42,
        bottom: groundY,
    };
    ctx.scene?.style.setProperty('--prairie-world-width', `${ctx.world.width}px`);
    ctx.scene?.style.setProperty('--prairie-world-height', `${ctx.world.height}px`);
    ctx.scene?.style.setProperty('--prairie-ground-y', `${ctx.world.groundY}px`);
    setWorldBounds(ctx.world.width, ctx.world.height);
    for (const entry of ctx.runtimeById.values()) {
        entry.slime.worldBounds = { left: ctx.world.left, top: ctx.world.top, right: ctx.world.right, bottom: ctx.world.bottom };
    }
    buildPrairieObjects(ctx);
    clampCamera(ctx);
}

export function screenToWorld(ctx, clientX, clientY) {
    const rect = ctx.canvas?.getBoundingClientRect?.();
    if (!rect || !rect.width || !rect.height || !ctx.canvas) {
        return null;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
    const effectiveZoom = ctx.camera.zoom * dpr;
    const localX = ((clientX - rect.left) / rect.width) * ctx.canvas.width;
    const localY = ((clientY - rect.top) / rect.height) * ctx.canvas.height;
    return {
        x: ctx.camera.x + (localX - ctx.canvas.width * 0.5) / effectiveZoom,
        y: ctx.camera.y + (localY - ctx.canvas.height * 0.5) / effectiveZoom,
    };
}

export function worldToScreen(ctx, worldX, worldY) {
    const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
    const effectiveZoom = ctx.camera.zoom * dpr;
    return {
        x: ((worldX - ctx.camera.x) * effectiveZoom) + (ctx.canvas?.width || 1) * 0.5,
        y: ((worldY - ctx.camera.y) * effectiveZoom) + (ctx.canvas?.height || 1) * 0.5,
    };
}

export function clampCamera(ctx) {
    const viewWidth = Math.max(1, ctx.viewport?.clientWidth || ctx.canvas?.clientWidth || 1);
    const viewHeight = Math.max(1, ctx.viewport?.clientHeight || ctx.canvas?.clientHeight || 1);
    const halfViewWidth = viewWidth * 0.5 / Math.max(ctx.camera.zoom, 0.1);
    const halfViewHeight = viewHeight * 0.5 / Math.max(ctx.camera.zoom, 0.1);
    ctx.camera.x = clamp(Number.isFinite(ctx.camera.x) ? ctx.camera.x : ctx.world.width * 0.5, halfViewWidth, Math.max(halfViewWidth, ctx.world.width - halfViewWidth));
    ctx.camera.y = clamp(Number.isFinite(ctx.camera.y) ? ctx.camera.y : ctx.world.height * 0.5, halfViewHeight, Math.max(halfViewHeight, ctx.world.height - halfViewHeight));
    ctx.camera.zoom = clamp(Number.isFinite(ctx.camera.zoom) ? ctx.camera.zoom : 1, MIN_ZOOM, MAX_ZOOM);
}

export function syncSceneTransform(ctx) {
    if (!ctx.scene || !ctx.viewport) {
        return;
    }
    const translateX = (ctx.viewport.clientWidth * 0.5) - (ctx.camera.x * ctx.camera.zoom);
    const translateY = (ctx.viewport.clientHeight * 0.5) - (ctx.camera.y * ctx.camera.zoom);
    ctx.scene.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${ctx.camera.zoom})`;

    const screenGroundY = translateY + ctx.world.groundY * ctx.camera.zoom;
    ctx.viewport.style.setProperty('--prairie-screen-ground-y', `${Math.round(screenGroundY)}px`);
}

export function applyEdgeScroll(ctx, clientX, clientY) {
    if (!ctx.viewport) return;
    const rect = ctx.viewportEdgeRect || ctx.viewport.getBoundingClientRect();
    let deltaX = 0, deltaY = 0;
    if (clientX < rect.left + EDGE_SCROLL_ZONE) {
        deltaX = -((rect.left + EDGE_SCROLL_ZONE - clientX) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
    } else if (clientX > rect.right - EDGE_SCROLL_ZONE) {
        deltaX = ((clientX - (rect.right - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
    }
    if (clientY < rect.top + EDGE_SCROLL_ZONE) {
        deltaY = -((rect.top + EDGE_SCROLL_ZONE - clientY) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
    } else if (clientY > rect.bottom - EDGE_SCROLL_ZONE) {
        deltaY = ((clientY - (rect.bottom - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
    }
    if (deltaX || deltaY) {
        ctx.camera.x += deltaX / ctx.camera.zoom;
        ctx.camera.y += deltaY / ctx.camera.zoom;
        clampCamera(ctx);
    }
}

export function updateZoom(ctx, nextZoom, anchorClientX, anchorClientY) {
    if (!ctx.viewport || !ctx.canvas) return;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const before = screenToWorld(ctx, anchorClientX, anchorClientY);
    ctx.camera.zoom = zoom;
    clampCamera(ctx);
    const after = screenToWorld(ctx, anchorClientX, anchorClientY);
    if (before && after) {
        ctx.camera.x += before.x - after.x;
        ctx.camera.y += before.y - after.y;
        clampCamera(ctx);
    }
}

export function softlyKeepSlimeNearPrairie(ctx, slime) {
    if (!slime) return;
    const looseLeft = ctx.world.left - OUT_OF_BOUNDS_SOFT_TOLERANCE;
    const looseRight = ctx.world.right + OUT_OF_BOUNDS_SOFT_TOLERANCE;
    const looseTop = ctx.world.top - OUT_OF_BOUNDS_SOFT_TOLERANCE;
    const looseBottom = ctx.world.bottom + OUT_OF_BOUNDS_SOFT_TOLERANCE;
    for (const node of slime.nodes || []) {
        if (node.x < looseLeft) {
            node.x = looseLeft;
            node.oldX = Math.min(node.oldX, node.x);
        } else if (node.x > looseRight) {
            node.x = looseRight;
            node.oldX = Math.max(node.oldX, node.x);
        }
        if (node.y < looseTop) {
            node.y = looseTop;
            node.oldY = Math.min(node.oldY, node.y);
        } else if (node.y > looseBottom) {
            node.y = looseBottom;
            node.oldY = Math.max(node.oldY, node.y);
        }
    }
}

export function isSlimeOutOfPrairieBounds(ctx, slime) {
    if (!slime || slime.draggedNode) return false;
    const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
    if (!center) return false;
    const radius = Math.max(28, getSlimeRadius(slime, center));
    const hardMargin = Math.max(OUT_OF_BOUNDS_HARD_TOLERANCE, radius * 2.1);
    const centerFarOutside = (
        center.x < ctx.world.left - hardMargin || center.x > ctx.world.right + hardMargin ||
        center.y < ctx.world.top - hardMargin || center.y > ctx.world.bottom + hardMargin
    );
    if (!centerFarOutside) return false;
    const nodes = Array.isArray(slime.nodes) ? slime.nodes : [];
    if (!nodes.length) return false;
    const escapeMargin = Math.max(OUT_OF_BOUNDS_SOFT_TOLERANCE * 1.5, radius * 0.9);
    const allOutsideExpandedBounds = nodes.every((node) => (
        node.x < ctx.world.left - escapeMargin || node.x > ctx.world.right + escapeMargin ||
        node.y < ctx.world.top - escapeMargin || node.y > ctx.world.bottom + escapeMargin
    ));
    const invalidNodeDetected = nodes.some((node) => !Number.isFinite(node.x) || !Number.isFinite(node.y));
    return allOutsideExpandedBounds || invalidNodeDetected;
}

export function recoverSlimeIntoPrairie(ctx, entry) {
    const slime = entry?.slime;
    if (!slime) return;
    const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
    if (!center) return;
    const radius = Math.max(28, getSlimeRadius(slime, center));
    const safeMargin = Math.max(34, radius * 0.82);
    const targetX = clamp(center.x, ctx.world.left + safeMargin, ctx.world.right - safeMargin);
    const targetY = clamp(center.y, ctx.world.top + safeMargin, ctx.world.bottom - safeMargin);
    const shiftX = targetX - center.x;
    const shiftY = targetY - center.y;
    if (Math.abs(shiftX) > 0.001 || Math.abs(shiftY) > 0.001) {
        for (const node of slime.nodes || []) {
            node.x += shiftX;
            node.y += shiftY;
            node.oldX += shiftX;
            node.oldY += shiftY;
        }
    }
    slime.restoreSurfaceIntegrity?.({ preserveVelocity: false });
}

export function resolveSlimeCollisions(ctx) {
    const entries = getActiveEntries(ctx);
    for (let iteration = 0; iteration < 2; iteration += 1) {
        for (let i = 0; i < entries.length; i += 1) {
            for (let j = i + 1; j < entries.length; j += 1) {
                const first = entries[i].slime;
                const second = entries[j].slime;
                const centerA = first.getRawVisualCenter?.() || first.getVisualCenter?.();
                const centerB = second.getRawVisualCenter?.() || second.getVisualCenter?.();
                const dx = centerB.x - centerA.x;
                const dy = centerB.y - centerA.y;
                const distance = Math.hypot(dx, dy) || 0.0001;
                const minDistance = getSlimeRadius(first, centerA) + getSlimeRadius(second, centerB) - 10;
                if (distance >= minDistance) continue;
                const overlap = minDistance - distance;
                const nx = dx / distance;
                const ny = dy / distance;
                const firstWeight = first.draggedNode ? 0.2 : 0.5;
                const secondWeight = second.draggedNode ? 0.2 : 0.5;
                const totalWeight = firstWeight + secondWeight || 1;
                const firstPush = overlap * (firstWeight / totalWeight);
                const secondPush = overlap * (secondWeight / totalWeight);
                for (const node of first.nodes || []) {
                    if (node === first.draggedNode) continue;
                    node.x -= nx * firstPush; node.y -= ny * firstPush;
                    node.oldX -= nx * firstPush; node.oldY -= ny * firstPush;
                }
                for (const node of second.nodes || []) {
                    if (node === second.draggedNode) continue;
                    node.x += nx * secondPush; node.y += ny * secondPush;
                    node.oldX += nx * secondPush; node.oldY += ny * secondPush;
                }
            }
        }
    }
}