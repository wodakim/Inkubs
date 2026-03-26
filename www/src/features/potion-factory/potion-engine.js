// www/src/features/potion-factory/potion-engine.js

/**
 * ARCHITECTURE AAA - POTION ENGINE
 * Moteur logique décorrélé de l'interface (Pure Logic).
 * Gère les calculs complexes : colorimétrie circulaire, échelle de rareté
 * exponentielle, et équilibrage des récompenses.
 *
 * Échelle de rareté :
 *   common     (score 0–1.4)  →  1 min,   5–12 💎
 *   uncommon   (score 1.5–2.4)→  3 min,  18–40 💎
 *   rare       (score 2.5–3.4)→  7 min,  60–130 💎
 *   epic       (score 3.5–4.4)→ 15 min, 200–420 💎
 *   legendary  (score ≥ 4.5)  → 30 min, 700–1400 💎
 */

/** Table de rareté exponentielle — [durationSec, rewardMin, rewardMax, label] */
const RARITY_TABLE = {
    common:    [  60,    5,   12, 'Commun'     ],
    uncommon:  [ 180,   18,   40, 'Peu commun' ],
    rare:      [ 420,   60,  130, 'Rare'       ],
    epic:      [ 900,  200,  420, 'Épique'     ],
    legendary: [1800,  700, 1400, 'Légendaire' ],
};

/** Convertit un rarityScore numérique (0–5) en tier string */
function scoreToTier(score) {
    if (score >= 4.5) return 'legendary';
    if (score >= 3.5) return 'epic';
    if (score >= 2.5) return 'rare';
    if (score >= 1.5) return 'uncommon';
    return 'common';
}

export const PotionEngine = {

    /**
     * Mélange un tableau de teintes (hues) géométriquement sur un cercle 360°.
     * Gère correctement hue=0 (rouge pur), les valeurs négatives, et les tableaux vides.
     * @param {number[]} hues
     * @returns {number} Teinte résultante 0–360
     */
    mixColorsHSL(hues) {
        const valid = (hues || []).filter(h => typeof h === 'number' && isFinite(h));
        if (valid.length === 0) return 120; // vert neutre si aucune donnée valide
        if (valid.length === 1) return Math.round(((valid[0] % 360) + 360) % 360);

        let x = 0, y = 0;
        for (const h of valid) {
            const rad = h * (Math.PI / 180);
            x += Math.cos(rad);
            y += Math.sin(rad);
        }
        let avg = Math.atan2(y, x) * (180 / Math.PI);
        if (avg < 0) avg += 360;
        return Math.round(avg);
    },

    /**
     * Calcule la rareté moyenne d'un lot de potions (score moyen des doses).
     * @param {Array} potions
     * @returns {number} Score moyen (0–5)
     */
    calculateAverageRarity(potions) {
        if (!potions || potions.length === 0) return 0;
        let total = 0, count = 0;
        for (const p of potions) {
            if (!p.doses) continue;
            for (const d of p.doses) {
                total += typeof d.rarity === 'number' ? d.rarity : 0;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    },

    /**
     * Calcule le temps d'emballage (ms) depuis le score moyen de rareté.
     * Progressif et exponentiel : legendary = 30x le temps d'un common.
     * @param {number} avgRarity
     * @returns {number} Millisecondes
     */
    calculatePackagingDurationMs(avgRarity) {
        const [dSec] = RARITY_TABLE[scoreToTier(avgRarity)];
        return dSec * 1000;
    },

    /**
     * Calcule la récompense finale en inkübits.
     * Bonus de 30% si la boîte est pleine (4 potions).
     * @param {number} avgRarity   Score moyen des doses
     * @param {number} potionCount Nombre de potions (1–4)
     * @returns {number} Valeur arrondie en 💎
     */
    calculateRewardValue(avgRarity, potionCount) {
        const [, rMin, rMax] = RARITY_TABLE[scoreToTier(avgRarity)];
        const bonus = potionCount >= 4 ? 1.3 : (0.7 + potionCount * 0.1);
        return Math.round((rMin + Math.random() * (rMax - rMin)) * bonus);
    },

    /**
     * Retourne le label lisible de la rareté pour un score donné.
     * @param {number} score
     * @returns {string}
     */
    getRarityLabel(score) {
        return RARITY_TABLE[scoreToTier(score)]?.[3] ?? 'Commun';
    },
};