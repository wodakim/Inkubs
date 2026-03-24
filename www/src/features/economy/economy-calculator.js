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
    PRICE_RECOVERY_MINUTES,
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

    // Bonus éléments visuels rares : chaque élément rare au-dessus du seuil ajoute du revenu
    const ELEM_INCOME_BONUS = {
        shape:   { thresholds: [5, 18, 38, 72], bonuses: [0.02, 0.05, 0.10, 0.18] },
        acc:     { thresholds: [3, 10, 30, 52], bonuses: [0.01, 0.04, 0.09, 0.16] },
        eye:     { thresholds: [5, 10, 20, 35], bonuses: [0.01, 0.03, 0.07, 0.14] },
        pattern: { thresholds: [6, 16, 32, 60], bonuses: [0.01, 0.04, 0.08, 0.15] },
    };
    const SHAPE_SCORE  = { round:0,pear:2,dumpling:2,blob:2,teardrop:2,mochi:2,puff:5,wisp:6,jellybean:6,bell:6,comet:7,puddle:7,crystal:18,ribbon:22,lantern:22,crescent:22,star_body:38,diamond:42,twin_lobe:46,fractal:72,aurora_form:76 };
    const ACC_SCORE    = { none:0,bow:2,flower:2,sprout:3,halo:3,ribbon_bow:10,mini_crown:12,crystal_tiara:30,rainbow_halo:34,fairy_wings:52,starfall_crown:60,celestial_halo:90 };
    const EYE_SCORE    = { dot:0,sparkle:2,heart:3,droplet:7,star_eye:10,abyss:17,flame_eye:20,rainbow_iris:32,crystal_eye:36,galaxy_eye:65 };
    const PAT_SCORE    = { solid:0,radial_glow:6,gradient_v:16,duo_tone:32,galaxy_swirl:60,aurora:64,crystal_facets:66,prismatic:82,void_rift:88 };

    function elemBonus(score, def) {
        let bonus = 0;
        for (let i = def.thresholds.length - 1; i >= 0; i--) {
            if (score >= def.thresholds[i]) { bonus = def.bonuses[i]; break; }
        }
        return bonus;
    }

    const elemBonusTotal =
        elemBonus(SHAPE_SCORE[genome.bodyShape] ?? 0, ELEM_INCOME_BONUS.shape) +
        elemBonus((ACC_SCORE[genome.accessory] ?? ACC_SCORE[genome.accessory] ?? 0), ELEM_INCOME_BONUS.acc) +
        elemBonus(EYE_SCORE[genome.eyeStyle]    ?? 0, ELEM_INCOME_BONUS.eye) +
        elemBonus(PAT_SCORE[genome.colorPattern] ?? 0, ELEM_INCOME_BONUS.pattern);

    // Multiplicateur d'humeur
    const mood = genome.mood || '';
    const moodMult = MOOD_INCOME_MULTIPLIER[mood] ?? 1.0;

    // Instable slimes: income multiplied by mass-based market value
    const instableMult = genome.marketValueMultiplier ?? 1.0;
    const raw = base * (1 + statBonus + elemBonusTotal) * moodMult * instableMult;
    return Math.max(0.1, Math.round(raw * 10) / 10);
}

/**
 * Calcule le coût d'acquisition d'un candidat.
 * Le prix est dérivé directement du revenu du slime :
 *   price = incomeRate(base + elemBonus) × PRICE_RECOVERY_MINUTES
 * Cela garantit qu'un slime qui rapporte plus coûte toujours proportionnellement plus.
 */
export function computeAcquisitionCost(candidate) {
  const genome  = candidate?.metadata?.previewBlueprint?.genome || {};
  const roundTo = ACQUISITION_COST_CONFIG.roundTo;

  const rarityTier = genome.rarityTier || 'common';
  const baseIncome = RARITY_INCOME_BASE[rarityTier] ?? RARITY_INCOME_BASE.common;

  // Mêmes tables de bonus éléments que computeIncomeRate
  const ELEM_INCOME_BONUS = {
      shape:   { thresholds: [5, 18, 38, 72], bonuses: [0.02, 0.05, 0.10, 0.18] },
      acc:     { thresholds: [3, 10, 30, 52], bonuses: [0.01, 0.04, 0.09, 0.16] },
      eye:     { thresholds: [5, 10, 20, 35], bonuses: [0.01, 0.03, 0.07, 0.14] },
      pattern: { thresholds: [6, 16, 32, 60], bonuses: [0.01, 0.04, 0.08, 0.15] },
  };
  const SHAPE_SCORE  = { round:0,pear:2,dumpling:2,blob:2,teardrop:2,mochi:2,puff:5,wisp:6,jellybean:6,bell:6,comet:7,puddle:7,crystal:18,ribbon:22,lantern:22,crescent:22,star_body:38,diamond:42,twin_lobe:46,fractal:72,aurora_form:76 };
  const ACC_SCORE    = { none:0,bow:2,flower:2,sprout:3,halo:3,ribbon_bow:10,mini_crown:12,crystal_tiara:30,rainbow_halo:34,fairy_wings:52,starfall_crown:60,celestial_halo:90 };
  const EYE_SCORE    = { dot:0,sparkle:2,heart:3,droplet:7,star_eye:10,abyss:17,flame_eye:20,rainbow_iris:32,crystal_eye:36,galaxy_eye:65 };
  const PAT_SCORE    = { solid:0,radial_glow:6,gradient_v:16,duo_tone:32,galaxy_swirl:60,aurora:64,crystal_facets:66,prismatic:82,void_rift:88 };

  function elemBonus(score, def) {
      for (let i = def.thresholds.length - 1; i >= 0; i--) {
          if (score >= def.thresholds[i]) return def.bonuses[i];
      }
      return 0;
  }

  const elemBonusTotal =
      elemBonus(SHAPE_SCORE[genome.bodyShape]    ?? 0, ELEM_INCOME_BONUS.shape) +
      elemBonus(ACC_SCORE[genome.accessory]       ?? 0, ELEM_INCOME_BONUS.acc) +
      elemBonus(EYE_SCORE[genome.eyeStyle]        ?? 0, ELEM_INCOME_BONUS.eye) +
      elemBonus(PAT_SCORE[genome.colorPattern]    ?? 0, ELEM_INCOME_BONUS.pattern);

  const instableMult = genome.marketValueMultiplier ?? 1.0;
  const estimatedIncome = baseIncome * (1 + elemBonusTotal) * instableMult;
  const raw = estimatedIncome * PRICE_RECOVERY_MINUTES;
  return Math.max(roundTo, Math.round(raw / roundTo) * roundTo);
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
