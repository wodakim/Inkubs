/**
 * INKÜ — Quest Persistence
 * Sauvegarde / restauration de l'état des quêtes en localStorage.
 *
 * Schéma v1 :
 * {
 *   version: 1,
 *   daily: {
 *     date: 'YYYY-MM-DD',    // date ISO du jour courant
 *     activeIds: string[],   // 3 IDs piochés ce jour-là
 *     completedIds: string[],
 *     claimedIds: string[],
 *     earnedToday: number,   // ⬡ gagnés ce jour (hors récompenses quêtes)
 *     boughtToday: number,   // Inkübs achetés ce jour
 *     visitedToday: string[] // sections visitées ce jour
 *   },
 *   definitive: {
 *     completedIds: string[],
 *     claimedIds: string[]
 *   },
 *   stats: {
 *     totalEarned: number,   // ⬡ gagnés depuis toujours
 *     barTalked: boolean     // a parlé au moins une fois au barman
 *   }
 * }
 */

const STORAGE_KEY = 'inku.quests.v1';

export function loadQuestState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return buildDefaultState();
        const parsed = JSON.parse(raw);
        return migrateAndNormalize(parsed);
    } catch {
        return buildDefaultState();
    }
}

export function saveQuestState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Silently fail (storage quota)
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function todayISO() {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function buildDefaultState() {
    return {
        version: 1,
        daily: {
            date: '',
            activeIds: [],
            completedIds: [],
            claimedIds: [],
            earnedToday: 0,
            boughtToday: 0,
            visitedToday: [],
        },
        definitive: {
            completedIds: [],
            claimedIds: [],
        },
        stats: {
            totalEarned: 0,
            barTalked: false,
        },
    };
}

function migrateAndNormalize(raw) {
    const def = buildDefaultState();
    return {
        version: 1,
        daily: {
            date:          raw?.daily?.date         ?? def.daily.date,
            activeIds:     Array.isArray(raw?.daily?.activeIds)     ? raw.daily.activeIds     : [],
            completedIds:  Array.isArray(raw?.daily?.completedIds)  ? raw.daily.completedIds  : [],
            claimedIds:    Array.isArray(raw?.daily?.claimedIds)    ? raw.daily.claimedIds    : [],
            earnedToday:   Number(raw?.daily?.earnedToday)          || 0,
            boughtToday:   Number(raw?.daily?.boughtToday)          || 0,
            visitedToday:  Array.isArray(raw?.daily?.visitedToday)  ? raw.daily.visitedToday  : [],
        },
        definitive: {
            completedIds: Array.isArray(raw?.definitive?.completedIds) ? raw.definitive.completedIds : [],
            claimedIds:   Array.isArray(raw?.definitive?.claimedIds)   ? raw.definitive.claimedIds   : [],
        },
        stats: {
            totalEarned: Number(raw?.stats?.totalEarned) || 0,
            barTalked:   Boolean(raw?.stats?.barTalked),
        },
    };
}
