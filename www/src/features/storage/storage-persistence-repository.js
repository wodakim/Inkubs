import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';
import {
    normalizeStorageMeta,
    STORAGE_ARCHIVE_SLOTS_PER_PAGE,
    STORAGE_FREE_PAGES,
    STORAGE_MAX_PAGES,
    STORAGE_TEAM_SLOT_COUNT,
    canAccessStoragePage,
    resolveAccessiblePageCount,
} from './storage-pagination-service.js';

export const STORAGE_REPOSITORY_SCHEMA_VERSION = 1;

export function createStoragePersistenceRepository({ driver, initialMeta = {} }) {
    if (!driver || typeof driver.load !== 'function' || typeof driver.save !== 'function') {
        throw new Error('A storage persistence driver with load/save is required.');
    }

    const subscribers = new Set();
    let snapshot = hydrateRepositorySnapshot(driver.load(), initialMeta);

    function notify(nextSnapshot, previousSnapshot, meta = { type: 'storage:patch' }) {
        subscribers.forEach((subscriber) => subscriber(nextSnapshot, previousSnapshot, meta));
    }

    function persist(nextSnapshot, meta) {
        const previousSnapshot = snapshot;
        snapshot = hydrateRepositorySnapshot(driver.save(nextSnapshot), initialMeta);
        notify(snapshot, previousSnapshot, meta);
        return snapshot;
    }

    function transact(mutator, meta = { type: 'storage:transact' }) {
        const draft = deepClone(snapshot);
        const maybeNext = mutator(draft) || draft;
        return persist(maybeNext, meta);
    }

    function getSnapshot() {
        return snapshot;
    }

    function subscribe(subscriber) {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
    }

    function ensureArchivePage(pageNumber) {
        const pageKey = String(pageNumber);
        if (!snapshot.pages[pageKey]) {
            snapshot.pages[pageKey] = createEmptyArchivePage(snapshot.meta.archiveSlotsPerPage);
        }
        return snapshot.pages[pageKey];
    }

    function findFirstEmptyArchiveSlot(startPage = 1) {
        const accessiblePages = resolveAccessiblePageCount(snapshot.meta);
        for (let page = Math.max(1, startPage); page <= accessiblePages; page += 1) {
            if (!canAccessStoragePage(page, snapshot.meta)) {
                continue;
            }

            const slots = ensureArchivePage(page);
            const slotIndex = slots.findIndex((value) => !value);
            if (slotIndex >= 0) {
                return { page, slotIndex };
            }
        }

        return null;
    }

    return {
        getSnapshot,
        subscribe,
        transact,
        ensureArchivePage,
        findFirstEmptyArchiveSlot,
        refresh() {
            snapshot = hydrateRepositorySnapshot(driver.load(), initialMeta);
            return snapshot;
        },
    };
}

function hydrateRepositorySnapshot(rawSnapshot, initialMeta) {
    const normalizedMeta = normalizeStorageMeta({
        maxPages: STORAGE_MAX_PAGES,
        unlockedPages: STORAGE_FREE_PAGES,
        teamSlotCount: STORAGE_TEAM_SLOT_COUNT,
        archiveSlotsPerPage: STORAGE_ARCHIVE_SLOTS_PER_PAGE,
        visibleSlotsPerView: STORAGE_TEAM_SLOT_COUNT + STORAGE_ARCHIVE_SLOTS_PER_PAGE,
        ...initialMeta,
        ...(rawSnapshot?.meta ?? {}),
    });

    const snapshot = {
        schemaVersion: STORAGE_REPOSITORY_SCHEMA_VERSION,
        meta: normalizedMeta,
        teamSlots: normalizeSlotArray(rawSnapshot?.teamSlots, normalizedMeta.teamSlotCount),
        pages: {},
        recordsById: normalizeRecordMap(rawSnapshot?.recordsById),
        acquisitionLedger: normalizeAcquisitionLedger(rawSnapshot?.acquisitionLedger),
    };

    const rawPages = rawSnapshot?.pages && typeof rawSnapshot.pages === 'object' ? rawSnapshot.pages : {};
    for (let page = 1; page <= normalizedMeta.maxPages; page += 1) {
        const pageKey = String(page);
        if (rawPages[pageKey]) {
            snapshot.pages[pageKey] = normalizeSlotArray(rawPages[pageKey], normalizedMeta.archiveSlotsPerPage);
        }
    }

    if (!snapshot.pages['1']) {
        snapshot.pages['1'] = createEmptyArchivePage(normalizedMeta.archiveSlotsPerPage);
    }

    return snapshot;
}

function normalizeRecordMap(recordsById) {
    if (!recordsById || typeof recordsById !== 'object') {
        return {};
    }

    const normalized = {};
    Object.entries(recordsById).forEach(([canonicalId, record]) => {
        if (typeof canonicalId === 'string' && canonicalId && record && typeof record === 'object') {
            normalized[canonicalId] = deepClone(record);
        }
    });
    return normalized;
}

function normalizeAcquisitionLedger(ledger) {
    if (!ledger || typeof ledger !== 'object') {
        return {};
    }

    const normalized = {};
    Object.entries(ledger).forEach(([runtimeId, canonicalId]) => {
        if (typeof runtimeId === 'string' && runtimeId && typeof canonicalId === 'string' && canonicalId) {
            normalized[runtimeId] = canonicalId;
        }
    });
    return normalized;
}

function normalizeSlotArray(values, expectedLength) {
    const normalized = Array.from({ length: expectedLength }, () => null);
    if (!Array.isArray(values)) {
        return normalized;
    }

    for (let index = 0; index < expectedLength; index += 1) {
        normalized[index] = typeof values[index] === 'string' && values[index].trim() ? values[index] : null;
    }

    return normalized;
}

function createEmptyArchivePage(slotCount) {
    return Array.from({ length: slotCount }, () => null);
}
