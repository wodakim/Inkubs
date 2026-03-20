/**
 * passive-income-engine.js
 * Gère la génération de revenus passifs en inkübits pour le joueur.
 *
 * RÈGLE : seuls les slimes dans l'équipe de 4 (teamSlots) génèrent du revenu.
 * Les slimes archivés ne rapportent rien.
 *
 * Tick toutes les TICK_INTERVAL_MS (10 secondes = 1/6 de minute).
 * À chaque tick, on additionne les incomeRate des slimes actifs et on
 * dispatche ADD_CURRENCY avec la fraction correspondante.
 */

import { computeTeamTotalIncomeRate } from './economy-calculator.js';

const TICK_INTERVAL_MS   = 10_000; // 10 secondes
const MINUTES_PER_TICK   = TICK_INTERVAL_MS / 60_000; // = 1/6

/**
 * Crée le moteur de revenus passifs.
 *
 * @param {{ store, repository }} params
 *   - store      : le state store (dispatch ADD_CURRENCY)
 *   - repository : le storage repository (lecture des teamSlots + recordsById)
 * @returns {{ start, stop, getTotalIncomeRate }}
 */
export function createPassiveIncomeEngine({ store, repository }) {
    let intervalId = null;
    let cachedTotalRate = 0;

    /** Résout les records des slimes actifs dans l'équipe. */
    function getTeamRecords() {
        const snapshot = repository?.getSnapshot?.();
        if (!snapshot) {
            return [];
        }

        const teamIds = (snapshot.teamSlots || []).filter(Boolean);
        return teamIds
            .map((id) => snapshot.recordsById?.[id])
            .filter(Boolean);
    }

    /** Calcule et met en cache le taux total inkübits/min de l'équipe. */
    function refreshCachedRate() {
        cachedTotalRate = computeTeamTotalIncomeRate(getTeamRecords());
        return cachedTotalRate;
    }

    /** Exécute un tick de revenus. */
    function tick() {
        const rate = refreshCachedRate();
        if (rate <= 0) {
            return;
        }

        const earned = Math.round(rate * MINUTES_PER_TICK * 10) / 10;
        if (earned < 0.01) {
            return;
        }

        store.dispatch({
            type: 'ADD_CURRENCY',
            payload: { currency: 'hexagon', amount: earned },
        });
    }

    return {
        /** Démarre le moteur (si pas déjà actif). */
        start() {
            if (intervalId !== null) {
                return;
            }
            refreshCachedRate();
            intervalId = globalThis.setInterval(tick, TICK_INTERVAL_MS);
        },

        /** Arrête le moteur. */
        stop() {
            if (intervalId !== null) {
                globalThis.clearInterval(intervalId);
                intervalId = null;
            }
        },

        /**
         * Retourne le taux total actuel inkübits/min (lecture fraîche).
         * Utile pour l'affichage dans le HUD.
         */
        getTotalIncomeRate() {
            return refreshCachedRate();
        },

        /** True si le moteur tourne. */
        get isRunning() {
            return intervalId !== null;
        },
    };
}
