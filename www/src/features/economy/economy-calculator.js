/**
 * economy-calculator.js
 * Calcule le taux de revenu passif et le coût d'acquisition d'un slime.
 */

import {
    RARITY_INCOME_BASE,
    MOOD_INCOME_MULTIPLIER,
    INCOME_STAT_WEIGHTS,
    INCOME_STAT_BONUS_CAP,
    ACQUISITION_COST_CONFIG,
} from './economy-config.js';

/**
 * Calcule le revenu passif en inkübits/min d'un slime.
 * Formule : base(rareté) × (1 + bonusStat) × multiplicateurHumeur
 *
 * @param {object} proceduralCore - { genome, stats } du slime
 * @returns {number} inkübits par minute (arrondi à 1 décimale)
 */
export function computeIncomeRate(proceduralCore) {
    if (!proceduralCore) {
        return 0;
    }

    const genome = proceduralCore.genome || {};
    const stats  = proceduralCore.stats  || {};

    const rarityTier = genome.rarityTier || stats.rarityTier || 'common';
    const base = RARITY_INCOME_BASE[rarityTier] ?? RARITY_INCOME_BASE.common;

    // Bonus stat : moyenne pondérée des stats (0-100) → 0-1 → up to +60%
    let statSum   = 0;
    let weightSum = 0;
    for (const [key, weight] of Object.entries(INCOME_STAT_WEIGHTS)) {
        const val = Number(stats[key]);
        if (Number.isFinite(val)) {
            statSum   += val * weight;
            weightSum += weight;
        }
    }
    const normalizedStat = weightSum > 0 ? statSum / weightSum / 100 : 0;
    const statBonus = normalizedStat * INCOME_STAT_BONUS_CAP;

    // Multiplicateur d'humeur
    const mood = genome.mood || '';
    const moodMult = MOOD_INCOME_MULTIPLIER[mood] ?? 1.0;

    const raw = base * (1 + statBonus) * moodMult;
    return Math.max(0.1, Math.round(raw * 10) / 10);
}

/**
 * Calcule le coût d'acquisition en inkübits d'un candidat de l'incubateur.
 * Reprend la logique de PricingPolicy.js pour rester cohérent.
 *
 * @param {object} candidate - le payload candidat de l'incubateur
 * @returns {number} coût arrondi au multiple de roundTo
 */
export function computeAcquisitionCost(candidate) {
    const metrics = candidate?.complexityMetrics || {};
    const cfg     = ACQUISITION_COST_CONFIG;

    const complexity     = Number.isFinite(metrics.complexityIndex) ? metrics.complexityIndex : 0;
    const rarityScore    = Number.isFinite(metrics.rarityScore)     ? metrics.rarityScore     : 0;
    const attributeCount = Array.isArray(candidate?.attributes)     ? candidate.attributes.length : 0;

    // Courbe non-linéaire : met l'accent sur les hautes raretés
    const rarityValue = Math.pow(rarityScore / 100, 1.55) * 100;

    const raw = cfg.basePrice
        + complexity     * cfg.complexityWeight
        + rarityValue    * cfg.rarityWeight
        + attributeCount * cfg.attributeWeight;

    return Math.max(cfg.roundTo, Math.round(raw / cfg.roundTo) * cfg.roundTo);
}

/**
 * Calcule le total inkübits/min généré par une liste de records (équipe).
 *
 * @param {object[]} records - tableau de canonical storage records
 * @returns {number} total arrondi à 1 décimale
 */
export function computeTeamTotalIncomeRate(records) {
    if (!Array.isArray(records) || records.length === 0) {
        return 0;
    }
    const total = records.reduce((sum, record) => {
        const rate = Number(record?.storageDisplay?.incomeRate);
        return sum + (Number.isFinite(rate) ? rate : 0);
    }, 0);
    return Math.round(total * 10) / 10;
}
