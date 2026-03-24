/**
 * INKÜ — Quest Engine
 * Suivi de progression, évaluation des conditions, attribution des récompenses.
 *
 * L'engine :
 *  - souscrit au store pour tracker les gains/achats/navigation
 *  - souscrit au repository pour tracker la collection
 *  - évalue l'état de chaque quête via snapshot
 *  - expose une API pour le panneau UI
 */

import { DAILY_POOL, DEFINITIVE_LIST, getDailyById, getDefinitiveById } from './quest-catalogue.js';
import { loadQuestState, saveQuestState, todayISO } from './quest-persistence.js';
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';

const DAILY_COUNT = 3; // quêtes journalières actives par jour

// ── Sélection déterministe des quêtes du jour via seed date ───────────────
function pickDailyQuests(dateStr) {
    // Simple LCG seed based on date string
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
        seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    }

    const pool = [...DAILY_POOL];
    const picked = [];
    while (picked.length < DAILY_COUNT && pool.length > 0) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const idx = seed % pool.length;
        picked.push(pool.splice(idx, 1)[0]);
    }
    return picked.map((q) => q.id);
}

// ── Snapshot queries (ne dépendent pas du tracking journalier) ─────────────
function querySlimeCount(snapshot) {
    return Object.keys(snapshot.recordsById || {}).length;
}

function queryTeamSize(snapshot) {
    return (snapshot.teamSlots || []).filter(Boolean).length;
}

function queryMaxLevel(snapshot) {
    let max = 0;
    for (const record of Object.values(snapshot.recordsById || {})) {
        const lvl = Number(record?.storageDisplay?.level) || 0;
        if (lvl > max) max = lvl;
    }
    return max;
}

// ── Évaluation d'une quête ─────────────────────────────────────────────────
function evaluateQuest(quest, state, repoSnapshot) {
    switch (quest.type) {
        case 'bar_talk':
            return { value: state.stats.barTalked ? 1 : 0, target: 1 };

        case 'visit_section':
            return {
                value: state.daily.visitedToday.includes(quest.section) ? 1 : 0,
                target: 1,
            };

        case 'earn':
            return { value: state.daily.earnedToday, target: quest.target };

        case 'buy':
            return { value: state.daily.boughtToday, target: quest.target };

        case 'collection':
            return { value: querySlimeCount(repoSnapshot), target: quest.target };

        case 'team_size':
            return { value: queryTeamSize(repoSnapshot), target: quest.target };

        case 'max_level':
            return { value: queryMaxLevel(repoSnapshot), target: quest.target };

        case 'total_earned':
            return { value: state.stats.totalEarned, target: quest.target };

        default:
            return { value: 0, target: 1 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export function createQuestEngine({ store }) {
    let questState = loadQuestState();
    let unsubscribeStore = null;
    let unsubscribeRepo = null;
    let prevSlimeCount = 0;
    const subscribers = new Set();

    function notify() {
        subscribers.forEach((fn) => fn(questState));
    }

    function persist() {
        saveQuestState(questState);
    }

    function mutate(fn) {
        fn(questState);
        persist();
        notify();
    }

    // ── Reset journalier si nécessaire ────────────────────────────────────
    function checkDailyReset() {
        const today = todayISO();
        if (questState.daily.date === today) return;

        mutate((s) => {
            s.daily.date         = today;
            s.daily.activeIds    = pickDailyQuests(today);
            s.daily.completedIds = [];
            s.daily.claimedIds   = [];
            s.daily.earnedToday  = 0;
            s.daily.boughtToday  = 0;
            s.daily.visitedToday = [];
        });
    }

    // ── Auto-complétion des quêtes ─────────────────────────────────────────
    function autoComplete() {
        const { repository } = getStorageRuntimeContext();
        const snap = repository.getSnapshot();

        // Journalières actives non encore complétées
        for (const id of questState.daily.activeIds) {
            if (questState.daily.completedIds.includes(id)) continue;
            const quest = getDailyById(id);
            if (!quest) continue;
            const { value, target } = evaluateQuest(quest, questState, snap);
            if (value >= target) {
                mutate((s) => {
                    if (!s.daily.completedIds.includes(id)) {
                        s.daily.completedIds.push(id);
                    }
                });
            }
        }

        // Définitives non encore complétées
        for (const quest of DEFINITIVE_LIST) {
            if (questState.definitive.completedIds.includes(quest.id)) continue;
            const { value, target } = evaluateQuest(quest, questState, snap);
            if (value >= target) {
                mutate((s) => {
                    if (!s.definitive.completedIds.includes(quest.id)) {
                        s.definitive.completedIds.push(quest.id);
                    }
                });
            }
        }
    }

    // ── Abonnement au store ────────────────────────────────────────────────
    function onStoreChange(state, prevState, action) {
        let changed = false;

        // Tracking des gains / achats
        if (action?.type === 'ADD_CURRENCY' && action?.payload?.currency === 'hexagon') {
            const amount = Number(action.payload.amount);
            if (amount > 0) {
                mutate((s) => {
                    s.daily.earnedToday  += amount;
                    s.stats.totalEarned  += amount;
                });
                changed = true;
            } else if (amount < 0) {
                // Achat (coût négatif)
                mutate((s) => {
                    s.daily.boughtToday += 1;
                });
                changed = true;
            }
        }

        // Tracking des sections visitées
        if (
            action?.type === 'NAVIGATE_TO_SECTION' &&
            state.activeSectionId !== prevState.activeSectionId
        ) {
            const sectionId = state.activeSectionId;
            if (!questState.daily.visitedToday.includes(sectionId)) {
                mutate((s) => {
                    s.daily.visitedToday.push(sectionId);
                });
                changed = true;
            }
        }

        if (changed) autoComplete();
    }

    // ── Abonnement au repository (suivi collection) ────────────────────────
    function onRepoChange(snapshot) {
        const count = querySlimeCount(snapshot);
        if (count !== prevSlimeCount) {
            prevSlimeCount = count;
            autoComplete();
        }
    }

    // ── API publique ───────────────────────────────────────────────────────
    function getQuestProgress(quest) {
        const { repository } = getStorageRuntimeContext();
        return evaluateQuest(quest, questState, repository.getSnapshot());
    }

    function claimDaily(id) {
        if (!questState.daily.completedIds.includes(id)) return false;
        if (questState.daily.claimedIds.includes(id)) return false;
        const quest = getDailyById(id);
        if (!quest) return false;

        mutate((s) => {
            s.daily.claimedIds.push(id);
        });

        store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: quest.reward } });
        return true;
    }

    function claimDefinitive(id) {
        if (!questState.definitive.completedIds.includes(id)) return false;
        if (questState.definitive.claimedIds.includes(id)) return false;
        const quest = getDefinitiveById(id);
        if (!quest) return false;

        mutate((s) => {
            s.definitive.claimedIds.push(id);
        });

        store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: quest.reward } });
        return true;
    }

    function markBarTalked() {
        if (questState.stats.barTalked) return;
        mutate((s) => {
            s.stats.barTalked = true;
        });
        autoComplete();
    }

    function subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
    }

    function mount() {
        const { repository } = getStorageRuntimeContext();
        prevSlimeCount = querySlimeCount(repository.getSnapshot());

        checkDailyReset();
        autoComplete();

        unsubscribeStore = store.subscribe(onStoreChange);
        unsubscribeRepo  = repository.subscribe(onRepoChange);
    }

    function destroy() {
        unsubscribeStore?.();
        unsubscribeRepo?.();
        unsubscribeStore = null;
        unsubscribeRepo  = null;
        subscribers.clear();
    }

    return {
        mount,
        destroy,
        subscribe,
        checkDailyReset,
        autoComplete,
        getQuestProgress,
        claimDaily,
        claimDefinitive,
        markBarTalked,
        getState: () => questState,
    };
}
