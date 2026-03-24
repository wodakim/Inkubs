export function normalizePlacement(placement) {
    if (!placement || typeof placement !== 'object') {
        return null;
    }

    if (placement.kind === 'team') {
        const slotIndex = Number(placement.slotIndex);
        if (!Number.isInteger(slotIndex) || slotIndex < 0) {
            return null;
        }
        return {
            kind: 'team',
            slotIndex,
        };
    }

    if (placement.kind === 'archive') {
        const slotIndex = Number(placement.slotIndex);
        const page = Number(placement.page);
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || !Number.isInteger(page) || page < 1) {
            return null;
        }
        return {
            kind: 'archive',
            page,
            slotIndex,
        };
    }

    return null;
}

export function getCanonicalIdAtPlacement(snapshot, placement) {
    const normalized = normalizePlacement(placement);
    if (!normalized || !snapshot) {
        return null;
    }

    const slots = getSlotsForPlacement(snapshot, normalized, { createIfMissing: false });
    if (!slots) {
        return null;
    }

    return typeof slots[normalized.slotIndex] === 'string' && slots[normalized.slotIndex]
        ? slots[normalized.slotIndex]
        : null;
}

export function moveOrSwapCanonicalInSnapshot(snapshot, { from, to }) {
    const source = normalizePlacement(from);
    const target = normalizePlacement(to);

    if (!snapshot || !source || !target) {
        return {
            didChange: false,
            reason: 'invalid_placement',
        };
    }

    if (source.kind === target.kind && source.slotIndex === target.slotIndex && (source.page || null) === (target.page || null)) {
        return {
            didChange: false,
            reason: 'same_slot',
        };
    }

    const sourceSlots = getSlotsForPlacement(snapshot, source, { createIfMissing: true });
    const targetSlots = getSlotsForPlacement(snapshot, target, { createIfMissing: true });
    const sourceCanonicalId = sourceSlots?.[source.slotIndex] || null;
    const targetCanonicalId = targetSlots?.[target.slotIndex] || null;

    if (!sourceCanonicalId) {
        return {
            didChange: false,
            reason: 'source_empty',
        };
    }

    targetSlots[target.slotIndex] = sourceCanonicalId;
    sourceSlots[source.slotIndex] = targetCanonicalId || null;

    return {
        didChange: true,
        sourceCanonicalId,
        targetCanonicalId,
        from: source,
        to: target,
    };
}

export function renameCanonicalRecordInSnapshot(snapshot, { canonicalId, displayName }) {
    const normalizedName = String(displayName || '').trim();
    if (!snapshot || !canonicalId || !normalizedName) {
        return {
            didChange: false,
            reason: 'invalid_payload',
        };
    }

    const record = snapshot.recordsById?.[canonicalId];
    if (!record) {
        return {
            didChange: false,
            reason: 'record_not_found',
        };
    }

    if (record.displayName === normalizedName && record.storageDisplay?.label === normalizedName) {
        return {
            didChange: false,
            reason: 'same_name',
        };
    }

    record.displayName = normalizedName;
    record.storageDisplay ||= {};
    record.storageDisplay.label = normalizedName;
    record.updatedAt = new Date().toISOString();

    return {
        didChange: true,
        canonicalId,
        displayName: normalizedName,
    };
}

function getSlotsForPlacement(snapshot, placement, { createIfMissing = false } = {}) {
    if (!snapshot || !placement) {
        return null;
    }

    if (placement.kind === 'team') {
        snapshot.teamSlots ||= Array.from({ length: snapshot.meta?.teamSlotCount || 4 }, () => null);
        return snapshot.teamSlots;
    }

    if (placement.kind === 'archive') {
        snapshot.pages ||= {};
        const pageKey = String(placement.page);
        if (!snapshot.pages[pageKey] && createIfMissing) {
            snapshot.pages[pageKey] = Array.from({ length: snapshot.meta?.archiveSlotsPerPage || 16 }, () => null);
        }
        return snapshot.pages[pageKey] || null;
    }

    return null;
}


export function removeCanonicalRecordInSnapshot(snapshot, { canonicalId }) {
    if (!snapshot || !canonicalId || !snapshot.recordsById?.[canonicalId]) {
        return {
            didChange: false,
            reason: 'record_not_found',
        };
    }

    let didClearPlacement = false;

    if (Array.isArray(snapshot.teamSlots)) {
        snapshot.teamSlots = snapshot.teamSlots.map((value) => {
            if (value === canonicalId) {
                didClearPlacement = true;
                return null;
            }
            return value;
        });
    }

    if (snapshot.pages && typeof snapshot.pages === 'object') {
        Object.keys(snapshot.pages).forEach((pageKey) => {
            const slots = Array.isArray(snapshot.pages[pageKey]) ? snapshot.pages[pageKey] : null;
            if (!slots) {
                return;
            }
            snapshot.pages[pageKey] = slots.map((value) => {
                if (value === canonicalId) {
                    didClearPlacement = true;
                    return null;
                }
                return value;
            });
        });
    }

    const runtimeId = snapshot.recordsById[canonicalId]?.runtimeId || null;
    delete snapshot.recordsById[canonicalId];
    if (runtimeId && snapshot.acquisitionLedger?.[runtimeId] === canonicalId) {
        delete snapshot.acquisitionLedger[runtimeId];
    }

    return {
        didChange: true,
        canonicalId,
        runtimeId,
        didClearPlacement,
    };
}
