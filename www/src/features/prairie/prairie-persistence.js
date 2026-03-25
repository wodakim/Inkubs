import { saveSession } from './prairie-session.js';
import { getActiveEntries } from './prairie-slime-runtime.js';

export function upsertPrairieState(draft, canonicalId, updates = {}) {
    const record = draft.recordsById?.[canonicalId];
    if (!record) return;
    record.prairieState = {
        ...(record.prairieState || {}),
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    record.updatedAt = new Date().toISOString();
}

export function persistAllActiveRecords(ctx, reason = 'manual') {
    if (!ctx.activeCanonicalIds.length) return;

    const payloads = getActiveEntries(ctx).map((entry) => {
        const slime = entry.slime;
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        return {
            canonicalId: entry.canonicalId,
            snapshot: slime.exportCanonicalSnapshot?.() || null,
            livingState: slime.exportLivingStateSnapshot?.() || null,
            prairieState: {
                x: Number.isFinite(center?.x) ? center.x : entry.record?.prairieState?.x,
                y: Number.isFinite(center?.y) ? center.y : entry.record?.prairieState?.y,
                camera: { ...ctx.camera },
                deployed: true,
                reason,
            },
        };
    });

    ctx.storageContext.repository.transact((draft) => {
        const deployedSet = new Set(payloads.map((payload) => payload.canonicalId));
        Object.values(draft.recordsById || {}).forEach((record) => {
            if (!record?.canonicalId) return;
            if (!deployedSet.has(record.canonicalId) && record.prairieState?.deployed) {
                upsertPrairieState(draft, record.canonicalId, { deployed: false, camera: { ...ctx.camera }, reason });
            }
        });
        payloads.forEach((payload) => {
            const record = draft.recordsById?.[payload.canonicalId];
            if (!record) return;
            if (payload.snapshot) record.canonicalSnapshot = payload.snapshot;
            if (payload.livingState) record.livingState = payload.livingState;
            upsertPrairieState(draft, payload.canonicalId, payload.prairieState);
        });
        return draft;
    }, { type: 'prairie:persist_active_records', reason, canonicalIds: [...ctx.activeCanonicalIds] });
}

export function markRecordWithdrawn(ctx, canonicalId, reason = 'prairie_withdraw') {
    ctx.storageContext.repository.transact((draft) => {
        upsertPrairieState(draft, canonicalId, { deployed: false, camera: { ...ctx.camera }, reason });
        return draft;
    }, { type: 'prairie:withdraw_record', canonicalId, reason });
}

export function scheduleSessionSave(ctx, reason = 'session_save') {
    clearTimeout(ctx.saveTimeout);
    ctx.saveTimeout = window.setTimeout(() => {
        persistAllActiveRecords(ctx, reason);
        saveSession({ activeCanonicalIds: [...ctx.activeCanonicalIds], camera: { ...ctx.camera }, panel: ctx.panelLayout });
    }, 120);
}