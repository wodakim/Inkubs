// www/src/features/potion-factory/potion-persistence.js

/**
 * ARCHITECTURE AAA - POTION PERSISTENCE
 * Couche de persistance dédiée à l'Usine à Potions.
 * Gère la sauvegarde et la restauration de l'état (fioles, minuteurs, boîte)
 * de manière sécurisée pour garantir aucune perte de données entre les sessions.
 */

const STORAGE_KEY = 'inku.factory.v1';

/**
 * Calcule la limite de gouttes (doses) qu'un slime peut fournir.
 * Basé sur la statistique de Vitalité du génome procédural.
 * * @param {Object} slime - Le record canonique du slime
 * @returns {number} La limite de gouttes (minimum 1)
 */
export function getPotionDropLimit(slime) {
    if (!slime || !slime.proceduralCore?.genome?.stats) {
        return 1;
    }

    const vitality = slime.proceduralCore.genome.stats.vitality || 0;

    // Règle de design : 1 goutte de base + 1 goutte tous les 50 points de vitalité
    return Math.max(1, Math.floor(vitality / 50));
}

export const PotionPersistence = {
    /**
     * Sauvegarde l'état courant de la machine à états de l'usine.
     * Sérialise uniquement les données nécessaires de manière stricte.
     * * @param {Object} state - L'état courant de l'usine
     * @returns {boolean} Statut de la sauvegarde
     */
    saveFactoryState(state) {
        if (!state) return false;

        try {
            // Création d'un Data Transfer Object (DTO) propre
            const snapshot = {
                timestamp: Date.now(),
                flasks: state.flasks.map(f => ({
                    id: f.id,
                    doses: [...f.doses]
                })),
                box: {
                    potions: state.box.potions.map(p => ({
                        doses: [...p.doses]
                    })),
                    status: state.box.status,
                    timerEnd: state.box.timerEnd,
                    rewardValue: state.box.rewardValue
                }
            };

            const serialized = JSON.stringify(snapshot);
            localStorage.setItem(STORAGE_KEY, serialized);

            return true;
        } catch (error) {
            console.error('[PotionPersistence] Erreur critique lors de la sérialisation :', error);
            return false;
        }
    },

    /**
     * Restaure l'état sauvegardé de l'usine.
     * Inclut une validation défensive pour empêcher un soft-lock du jeu via des données corrompues.
     * Gère également l'écoulement du temps "hors-ligne".
     * * @returns {Object|null} L'état restauré, ou null si inexistant/invalide
     */
    loadFactoryState() {
        try {
            const serialized = localStorage.getItem(STORAGE_KEY);
            if (!serialized) return null;

            const parsed = JSON.parse(serialized);

            // Validation de l'intégrité de la structure
            if (!parsed || !Array.isArray(parsed.flasks) || !parsed.box) {
                console.warn('[PotionPersistence] Données corrompues détectées. Purge en cours.');
                this.clearFactoryState();
                return null;
            }

            // Calcul du temps hors-ligne (Offline progression)
            if (parsed.box.status === 'packaging' && parsed.box.timerEnd) {
                if (Date.now() >= parsed.box.timerEnd) {
                    parsed.box.status = 'ready';
                }
            }

            return parsed;
        } catch (error) {
            console.error('[PotionPersistence] Erreur critique lors du parsing JSON :', error);
            this.clearFactoryState();
            return null;
        }
    },

    /**
     * Purge absolue de la mémoire locale de l'usine.
     */
    clearFactoryState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('[PotionPersistence] Échec du nettoyage mémoire :', error);
        }
    }
};