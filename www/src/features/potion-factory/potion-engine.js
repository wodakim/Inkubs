// www/src/features/potion-factory/potion-engine.js

/**
 * POTION ENGINE — Moteur logique pur (sans dépendances UI).
 *
 * Échelle de rareté équilibrée (valeurs calibrées pour une progression saine) :
 *   common     (score 0–1.4)  →  2 min,    8–18 💎 / boîte
 *   uncommon   (score 1.5–2.4)→  5 min,   40–90 💎 / boîte
 *   rare       (score 2.5–3.4)→ 12 min,  160–380 💎 / boîte
 *   epic       (score 3.5–4.4)→ 25 min,  600–1500 💎 / boîte
 *   legendary  (score ≥ 4.5)  → 50 min, 2500–6000 💎 / boîte
 *
 * Récompense max pour une boîte full legendary ≈ 7800 💎.
 * Revenu passif étant ~5–10 💎/min, une boîte legendary représente ~13–26h de passif,
 * ce qui est cohérent pour un objet rare à produire.
 */

/** [durationSec, rewardMin, rewardMax, label] */
const RARITY_TABLE = {
    common:     [  120,    8,   18, 'Commun'     ],
    uncommon:   [  300,   40,   90, 'Peu commun' ],
    rare:       [  720,  160,  380, 'Rare'       ],
    super_rare: [ 1500,  500, 1200, 'Super Rare' ],
    legend:     [ 3600, 1500, 4000, 'Légendaire' ],
    divin:      [ 7200, 4500, 9500, 'Divin'      ],
};

function scoreToTier(score) {
    if (score >= 95) return 'divin';
    if (score >= 80) return 'legend';
    if (score >= 60) return 'super_rare';
    if (score >= 40) return 'rare';
    if (score >= 20) return 'uncommon';
    return 'common';
}

export const PotionEngine = {

    /**
     * Mélange un tableau de teintes sur un cercle 360° (moyenne géométrique).
     */
    mixColorsHSL(hues) {
        const valid = (hues || []).filter(h => typeof h === 'number' && isFinite(h));
        if (valid.length === 0) return 120;
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
     * Rareté moyenne d'un lot de potions (moyenne des doses).
     * Le rarityScore des doses est normalisé sur 0–5.
     */
    calculateAverageRarity(potions) {
        if (!potions || potions.length === 0) return 0;
        let total = 0, count = 0;
        for (const p of potions) {
            if (!p.doses) continue;
            for (const d of p.doses) {
                const r = typeof d.rarity === 'number' ? Math.min(100, Math.max(0, d.rarity)) : 0;
                total += r;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    },

    calculatePackagingDurationMs(avgRarity) {
        const [dSec] = RARITY_TABLE[scoreToTier(avgRarity)];
        return dSec * 1000;
    },

    /**
     * Récompense : bonus de 20% si boîte pleine (4 potions).
     * La récompense de base est proportionnelle au nombre de potions.
     */
    calculateRewardValue(avgRarity, potionCount) {
        const [, rMin, rMax] = RARITY_TABLE[scoreToTier(avgRarity)];
        const ratio = Math.max(1, Math.min(potionCount, 4)) / 4;
        const fullBonus = potionCount >= 4 ? 1.2 : 1.0;
        const base = rMin + Math.random() * (rMax - rMin);
        return Math.max(1, Math.round(base * ratio * fullBonus));
    },

    getRarityLabel(score) {
        return RARITY_TABLE[scoreToTier(score)]?.[3] ?? 'Commun';
    },

    getRarityColor(score) {
        const tier = scoreToTier(score);
        return {
            common:     '#9e9e9e',
            uncommon:   '#4caf50',
            rare:       '#2196f3',
            super_rare: '#9c27b0',
            legend:     '#ff9800',
            divin:      '#ffeb3b',
        }[tier] ?? '#9e9e9e';
    },
};