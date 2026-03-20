/**
 * player-persistence.js
 * Persistance locale de l'état joueur (balance, préférences).
 * Seules les données volatiles (currencies, notificationSettings) sont sauvegardées.
 */

const PLAYER_STORAGE_KEY = 'inku.player.v1';

/**
 * Charge l'état joueur persisté depuis localStorage.
 * @returns {object|null}
 */
export function loadPlayerState() {
    try {
        const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Sauvegarde les données persistables du player state.
 * @param {object} player - player slice du state store
 */
export function savePlayerState(player) {
    try {
        const data = {
            currencies: {
                hexagon: Number(player.currencies?.hexagon) || 0,
                sketch:  Number(player.currencies?.sketch)  || 0,
            },
            notificationSettings: player.notificationSettings ?? null,
        };
        localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // localStorage peut être indisponible (private browsing strict)
    }
}
