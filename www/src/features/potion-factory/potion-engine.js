// www/src/features/potion-factory/potion-engine.js

/**
 * ARCHITECTURE AAA - POTION ENGINE
 * Moteur logique décorrélé de l'interface (Pure Logic).
 * Gère les calculs complexes : colorimétrie circulaire, algorithmes de temps,
 * et équilibrage des récompenses.
 */
export const PotionEngine = {
    /**
     * Mélange un tableau de teintes (Hues) de manière géométrique sur un cercle de 360°.
     * Évite le bug classique où moyenner 350° (Rouge) et 10° (Rouge) donne 180° (Cyan).
     * * @param {number[]} hues - Tableau des teintes (0-360)
     * @returns {number} La teinte résultante (0-360)
     */
    mixColorsHSL(hues) {
        if (!hues || hues.length === 0) return 0;
        if (hues.length === 1) return Math.round(hues[0]);

        let x = 0;
        let y = 0;

        for (let i = 0; i < hues.length; i++) {
            const rad = hues[i] * (Math.PI / 180);
            x += Math.cos(rad);
            y += Math.sin(rad);
        }

        let avgHue = Math.atan2(y, x) * (180 / Math.PI);
        if (avgHue < 0) {
            avgHue += 360;
        }

        return Math.round(avgHue);
    },

    /**
     * Calcule la rareté moyenne globale d'un lot de potions (la boîte).
     * * @param {Array} potions - Tableau d'objets potions contenant des doses
     * @returns {number} La rareté moyenne (minimum 1)
     */
    calculateAverageRarity(potions) {
        if (!potions || potions.length === 0) return 1;

        let totalRarity = 0;
        let totalDoses = 0;

        for (const potion of potions) {
            if (!potion.doses) continue;
            for (const dose of potion.doses) {
                totalRarity += (dose.rarity || 1);
                totalDoses++;
            }
        }

        return totalDoses > 0 ? (totalRarity / totalDoses) : 1;
    },

    /**
     * Calcule le temps nécessaire pour l'emballage de la boîte.
     * Basé sur une courbe linéaire allant de 2 min (rareté 1) à 10 min (rareté 5).
     * * @param {number} avgRarity - La rareté moyenne du lot
     * @returns {number} Le temps requis en millisecondes
     */
    calculatePackagingDurationMs(avgRarity) {
        const MIN_TIME_SEC = 120; // 2 minutes
        const MAX_TIME_SEC = 600; // 10 minutes
        const MAX_RARITY = 5;

        // Clamper la rareté entre 1 et MAX_RARITY pour la sécurité
        const clampedRarity = Math.max(1, Math.min(avgRarity, MAX_RARITY));

        // Calcul du ratio d'interpolation (0.0 à 1.0)
        const ratio = (clampedRarity - 1) / (MAX_RARITY - 1);

        // Durée finale en secondes
        const durationSec = MIN_TIME_SEC + (ratio * (MAX_TIME_SEC - MIN_TIME_SEC));

        return Math.floor(durationSec * 1000);
    },

    /**
     * Calcule la récompense (monnaie) générée par la vente d'une boîte.
     * Modèle économique : (Rareté Moyenne * Multiplicateur de base) * Nombre de Potions.
     * * @param {number} avgRarity - Rareté moyenne
     * @param {number} potionCount - Nombre de potions dans la boîte
     * @returns {number} Le montant de la récompense
     */
    calculateRewardValue(avgRarity, potionCount) {
        const BASE_MULTIPLIER = 25; // Valeur AAA par point de rareté
        const reward = avgRarity * BASE_MULTIPLIER * potionCount;

        return Math.floor(reward);
    }
};