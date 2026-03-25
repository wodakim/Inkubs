import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';
import { Slime } from '../../vendor/inku-slime-v3/engine/entities/Slime.js';
import { Particle } from '../../vendor/inku-slime-v3/engine/entities/Particle.js';
import { particles } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { buildCanonicalBlueprintFromRecord } from '../storage/storage-canonical-inspection-sandbox.js';
import { getOrderedCanonicalIds } from './prairie-session.js';
import { clamp, MAX_ACTIVE_TRUE_ENGINE, MANIPULATION_OUT_OF_BOUNDS_GRACE_MS } from './prairie-constants.js';
import { renderDronePanel } from './prairie-drone-panel.js';
import { scheduleSessionSave, upsertPrairieState } from './prairie-persistence.js';
import { clampCamera } from './prairie-camera.js';

export function listRecords(ctx) {
    const snapshot = ctx.storageContext.repository.getSnapshot();
    return getOrderedCanonicalIds(snapshot)
        .map((canonicalId) => snapshot.recordsById[canonicalId])
        .filter(Boolean);
}

export function findRecordById(ctx, canonicalId) {
    const snapshot = ctx.storageContext.repository.getSnapshot();
    return snapshot.recordsById?.[canonicalId] || null;
}

export function getActiveEntries(ctx) {
    return ctx.activeCanonicalIds
        .map((canonicalId) => ctx.runtimeById.get(canonicalId))
        .filter(Boolean);
}

export function getDefaultDeploymentPlacement(ctx, slotIndex = 0) {
    const patterns = [
        { x: 0.38, y: 0.64 }, { x: 0.62, y: 0.64 },
        { x: 0.46, y: 0.54 }, { x: 0.54, y: 0.54 },
    ];
    const pattern = patterns[slotIndex] || patterns[0];
    return {
        x: clamp(ctx.world.width * pattern.x, ctx.world.left + 90, ctx.world.right - 90),
        y: clamp(ctx.world.height * pattern.y, ctx.world.top + 90, ctx.world.bottom - 20),
    };
}

export function getPrairieRespawnCenter(ctx, slotIndex = 0) {
    const placement = getDefaultDeploymentPlacement(ctx, slotIndex);
    return {
        x: placement.x,
        y: clamp(ctx.world.groundY - 96, ctx.world.top + 72, ctx.world.bottom - 18),
    };
}

export function getSavedPrairiePlacement(ctx, record, slotIndex = 0) {
    const prairieState = record?.prairieState && typeof record.prairieState === 'object' ? record.prairieState : null;
    if (Number.isFinite(prairieState?.x) && Number.isFinite(prairieState?.y)) {
        return {
            x: clamp(prairieState.x, ctx.world.left + 40, ctx.world.right - 40),
            y: clamp(prairieState.y, ctx.world.top + 40, ctx.world.bottom - 20),
        };
    }
    return getDefaultDeploymentPlacement(ctx, slotIndex);
}

export function createCanonicalRuntime(ctx, record, slotIndex = 0, placement = null, impulseY = -1.8) {
    const blueprint = buildCanonicalBlueprintFromRecord(record);
    if (!blueprint) return null;
    const spawnAt = placement || getSavedPrairiePlacement(ctx, record, slotIndex);
    const slime = new Slime({
        blueprint: deepClone(blueprint),
        spawnX: spawnAt.x,
        spawnY: spawnAt.y,
        spawnImpulseY: impulseY,
        spawnImpulseX: 0,
        boxPadding: 0,
        worldBounds: { left: ctx.world.left, top: ctx.world.top, right: ctx.world.right, bottom: ctx.world.bottom },
        surfaceIntegrityExplosionEnabled: false,
    });
    const runtimePose = record.canonicalSnapshot?.runtimePose || {};
    if (runtimePose.facing === -1 || runtimePose.facing === 1) slime.facing = runtimePose.facing;
    slime.explode = function prairieSuppressedExplosion() {
        this.restoreSurfaceIntegrity?.({ preserveVelocity: false });
    };
    for (let i = 0; i < 8; i += 1) slime.update();
    slime._canonicalName = record?.identity?.name || record?.canonicalSnapshot?.identity?.name || record?.displayName || 'Inkübus';
    return slime;
}

export function deployCanonicalSlime(ctx, canonicalId, { preserveCamera = false, placement = null, impulseY = -1.8 } = {}) {
    if (ctx.runtimeById.has(canonicalId) || ctx.activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE) return false;
    const record = findRecordById(ctx, canonicalId);
    if (!record) return false;
    const slotIndex = ctx.activeCanonicalIds.length;
    const slime = createCanonicalRuntime(ctx, record, slotIndex, placement, impulseY);
    if (!slime) return false;
    
    ctx.runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
    ctx.activeCanonicalIds = [...ctx.activeCanonicalIds, canonicalId];
    
    if (!preserveCamera) {
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.() || getSavedPrairiePlacement(ctx, record, slotIndex);
        ctx.camera.x = center.x;
        ctx.camera.y = clamp(center.y - 120, ctx.world.height * 0.28, ctx.world.height * 0.7);
        clampCamera(ctx);
    }
    renderDronePanel(ctx);
    scheduleSessionSave(ctx, 'prairie_deploy');
    return true;
}

export function withdrawCanonicalSlime(ctx, canonicalId) {
    const entry = ctx.runtimeById.get(canonicalId);
    if (!entry) return;
    entry.slime.releaseGrab?.();
    
    // Clean up bench sitter registration
    for (const obj of ctx.prairieObjects) {
        if (obj.type === 'bench' && obj._sitters) {
            obj._sitters.delete(canonicalId);
            obj._sitterCount = obj._sitters.size;
        }
    }
    
    const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
    ctx.storageContext.repository.transact((draft) => {
        const record = draft.recordsById?.[canonicalId];
        if (!record) return draft;
        record.canonicalSnapshot = entry.slime.exportCanonicalSnapshot?.() || record.canonicalSnapshot;
        record.livingState = entry.slime.exportLivingStateSnapshot?.() || record.livingState;
        upsertPrairieState(draft, canonicalId, {
            x: Number.isFinite(center?.x) ? center.x : record.prairieState?.x,
            y: Number.isFinite(center?.y) ? center.y : record.prairieState?.y,
            camera: { ...ctx.camera },
            deployed: false,
            reason: 'prairie_withdraw',
        });
        return draft;
    }, { type: 'prairie:withdraw_record', canonicalId });
    
    ctx.runtimeById.delete(canonicalId);
    ctx.interactionEngine.removeSlime(canonicalId);
    ctx.activeCanonicalIds = ctx.activeCanonicalIds.filter((value) => value !== canonicalId);
    
    renderDronePanel(ctx);
    scheduleSessionSave(ctx, 'prairie_withdraw');
}

export function respawnOutOfBounds(ctx, canonicalId) {
    const existing = ctx.runtimeById.get(canonicalId);
    const slotIndex = ctx.activeCanonicalIds.indexOf(canonicalId);
    if (!existing || slotIndex < 0) return;
    existing.slime.releaseGrab?.();
    for (let i = 0; i < 18; i += 1) {
        const sourceNode = existing.slime.nodes?.[Math.floor(Math.random() * existing.slime.nodes.length)] || null;
        if (sourceNode) particles.push(new Particle(sourceNode.x, sourceNode.y, existing.slime.color));
    }
    const record = findRecordById(ctx, canonicalId) || existing.record;
    if (!record) {
        ctx.runtimeById.delete(canonicalId);
        ctx.activeCanonicalIds = ctx.activeCanonicalIds.filter((value) => value !== canonicalId);
        renderDronePanel(ctx);
        return;
    }
    const slime = createCanonicalRuntime(ctx, record, slotIndex, getPrairieRespawnCenter(ctx, slotIndex), -2.1);
    if (!slime) return;
    
    ctx.runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
    ctx.storageContext.repository.transact((draft) => {
        upsertPrairieState(draft, canonicalId, {
            x: getPrairieRespawnCenter(ctx, slotIndex).x,
            y: getPrairieRespawnCenter(ctx, slotIndex).y,
            camera: { ...ctx.camera },
            deployed: true,
            reason: 'prairie_out_of_bounds_respawn',
        });
        return draft;
    }, { type: 'prairie:out_of_bounds_respawn', canonicalId });
    renderDronePanel(ctx);
}

export function getSlimeRadius(slime, center = null) {
    if (!slime) return 0;
    const pivot = center || slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
    let radius = Math.max(18, slime.baseRadius * 0.8);
    for (const node of slime.nodes || []) {
        radius = Math.max(radius, Math.hypot(node.x - pivot.x, node.y - pivot.y));
    }
    return radius;
}

export function markEntryManipulated(entry) {
    if (!entry) return;
    entry.lastManipulatedAt = performance.now();
    entry.outOfBoundsFrames = 0;
}

export function wasRecentlyManipulated(entry, now = performance.now()) {
    return Boolean(entry && Number.isFinite(entry.lastManipulatedAt) && (now - entry.lastManipulatedAt) <= MANIPULATION_OUT_OF_BOUNDS_GRACE_MS);
}