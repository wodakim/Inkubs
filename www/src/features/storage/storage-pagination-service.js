export const STORAGE_MAX_PAGES = 99;
export const STORAGE_FREE_PAGES = 1;
export const STORAGE_TEAM_SLOT_COUNT = 4;
export const STORAGE_VISIBLE_SLOTS_PER_VIEW = 20;
export const STORAGE_ARCHIVE_SLOTS_PER_PAGE = 16;

export function normalizeStorageMeta(meta = {}) {
    const maxPages = clampInteger(meta.maxPages, STORAGE_MAX_PAGES, 1, STORAGE_MAX_PAGES);
    const unlockedPages = clampInteger(meta.unlockedPages, STORAGE_FREE_PAGES, STORAGE_FREE_PAGES, maxPages);

    return {
        maxPages,
        unlockedPages,
        devUnlockAllPages: Boolean(meta.devUnlockAllPages),
        teamSlotCount: clampInteger(meta.teamSlotCount, STORAGE_TEAM_SLOT_COUNT, 1, STORAGE_TEAM_SLOT_COUNT),
        archiveSlotsPerPage: clampInteger(meta.archiveSlotsPerPage, STORAGE_ARCHIVE_SLOTS_PER_PAGE, 1, STORAGE_ARCHIVE_SLOTS_PER_PAGE),
        visibleSlotsPerView: clampInteger(meta.visibleSlotsPerView, STORAGE_VISIBLE_SLOTS_PER_VIEW, STORAGE_VISIBLE_SLOTS_PER_VIEW, STORAGE_VISIBLE_SLOTS_PER_VIEW),
    };
}

export function clampPageNumber(page, meta = {}) {
    const normalizedMeta = normalizeStorageMeta(meta);
    return clampInteger(page, 1, 1, normalizedMeta.maxPages);
}

export function canAccessStoragePage(page, meta = {}) {
    const normalizedMeta = normalizeStorageMeta(meta);
    const normalizedPage = clampPageNumber(page, normalizedMeta);

    if (normalizedMeta.devUnlockAllPages) {
        return true;
    }

    return normalizedPage <= normalizedMeta.unlockedPages;
}

export function resolveAccessiblePageCount(meta = {}) {
    const normalizedMeta = normalizeStorageMeta(meta);
    return normalizedMeta.devUnlockAllPages ? normalizedMeta.maxPages : normalizedMeta.unlockedPages;
}

function clampInteger(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.floor(numeric)));
}
