export function sortArchiveInSnapshot(snapshot, { sortKey = 'rarity' } = {}) {
    if (!snapshot || !snapshot.recordsById || !snapshot.pages) {
        return {
            didChange: false,
            reason: 'invalid_snapshot',
        };
    }

    const totalSlotsPerPage = Math.max(1, Number(snapshot.meta?.archiveSlotsPerPage) || 16);
    const pageNumbers = collectRelevantPageNumbers(snapshot);
    const archiveIds = [];

    for (const page of pageNumbers) {
        const pageKey = String(page);
        const slots = Array.isArray(snapshot.pages[pageKey]) ? snapshot.pages[pageKey] : [];
        for (let slotIndex = 0; slotIndex < totalSlotsPerPage; slotIndex += 1) {
            const canonicalId = typeof slots[slotIndex] === 'string' && slots[slotIndex] ? slots[slotIndex] : null;
            if (canonicalId) {
                archiveIds.push(canonicalId);
            }
        }
    }

    if (archiveIds.length <= 1) {
        return {
            didChange: false,
            reason: 'not_enough_records',
        };
    }

    const previousOrder = archiveIds.join('|');
    const sortedIds = [...archiveIds].sort((leftId, rightId) => compareCanonicalRecords(
        snapshot.recordsById[leftId],
        snapshot.recordsById[rightId],
        sortKey,
    ));

    if (sortedIds.join('|') === previousOrder) {
        return {
            didChange: false,
            reason: 'same_order',
        };
    }

    let cursor = 0;
    for (const page of pageNumbers) {
        const pageKey = String(page);
        snapshot.pages[pageKey] ||= Array.from({ length: totalSlotsPerPage }, () => null);
        for (let slotIndex = 0; slotIndex < totalSlotsPerPage; slotIndex += 1) {
            snapshot.pages[pageKey][slotIndex] = cursor < sortedIds.length ? sortedIds[cursor] : null;
            cursor += 1;
        }
    }

    snapshot.meta ||= {};
    snapshot.meta.lastArchiveSortKey = sortKey;
    snapshot.meta.lastArchiveSortAt = new Date().toISOString();

    return {
        didChange: true,
        sortKey,
        count: sortedIds.length,
    };
}

function collectRelevantPageNumbers(snapshot) {
    const pageKeys = Object.keys(snapshot.pages || {})
        .map((pageKey) => Number(pageKey))
        .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 1)
        .sort((a, b) => a - b);

    if (pageKeys.length === 0) {
        return [1];
    }

    return pageKeys;
}

function compareCanonicalRecords(leftRecord, rightRecord, sortKey) {
    const left = leftRecord || {};
    const right = rightRecord || {};

    if (sortKey === 'level') {
        return compareNumbers(
            deriveLevel(right),
            deriveLevel(left),
            left,
            right,
        );
    }

    if (sortKey === 'type') {
        return compareStrings(
            left.storageDisplay?.typeLabel || left.speciesKey || left.proceduralCore?.type || '',
            right.storageDisplay?.typeLabel || right.speciesKey || right.proceduralCore?.type || '',
            left,
            right,
        );
    }

    return compareNumbers(
        deriveRarityRank(right),
        deriveRarityRank(left),
        left,
        right,
    );
}

function compareNumbers(leftValue, rightValue, leftRecord, rightRecord) {
    const delta = leftValue - rightValue;
    if (delta !== 0) {
        return delta;
    }
    return compareFallback(leftRecord, rightRecord);
}

function compareStrings(leftValue, rightValue, leftRecord, rightRecord) {
    const delta = String(leftValue || '').localeCompare(String(rightValue || ''));
    if (delta !== 0) {
        return delta;
    }
    return compareFallback(leftRecord, rightRecord);
}

function compareFallback(leftRecord, rightRecord) {
    const nameDelta = String(leftRecord.displayName || '').localeCompare(String(rightRecord.displayName || ''));
    if (nameDelta !== 0) {
        return nameDelta;
    }
    return String(leftRecord.canonicalId || '').localeCompare(String(rightRecord.canonicalId || ''));
}

function deriveLevel(record) {
    return Number(record.storageDisplay?.level) || 0;
}

function deriveRarityRank(record) {
    const label = String(record.storageDisplay?.rarity || '').trim().toLowerCase();
    if (label === 'légendaire' || label === 'legendary') return 5;
    if (label === 'épique'     || label === 'epic')      return 4;
    if (label === 'rare')                                return 3;
    if (label === 'peu commun' || label === 'uncommon')  return 2;
    if (label === 'commun'     || label === 'common')    return 1;
    // Also accept numeric rarityScore (0-100) as a fine-grained fallback
    const score = Number(record.complexityMetrics?.rarityScore);
    if (Number.isFinite(score) && score > 0) return score / 20; // map 0-100 → 0-5
    return Number(record.complexityMetrics?.rarityIndex) || 0;
}
