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

    const raw = base * (1 + statBonus + elemBonusTotal) * moodMult;
    return Math.max(0.1, Math.round(raw * 10) / 10);
}

/**
 * Calcule le coût d'acquisition d'un candidat.
 * Utilise la même logique que PricingPolicy.js : rareté cumulée des éléments visuels.
 */
export function computeAcquisitionCost(candidate) {
  const cfg    = ACQUISITION_COST_CONFIG;
  const genome = candidate?.metadata?.previewBlueprint?.genome || {};
  const metrics = candidate?.complexityMetrics || {};

  // Scores éléments visuels
  const SHAPE_SCORE = {
    round:0,pear:2,dumpling:2,blob:2,teardrop:2,mochi:2,
    puff:5,wisp:6,jellybean:6,bell:6,comet:7,puddle:7,
    crystal:18,ribbon:22,lantern:22,crescent:22,
    star_body:38,diamond:42,twin_lobe:46,fractal:72,aurora_form:76,
  };
  const ACC_SCORE = {
    none:0,bow:2,flower:2,sprout:3,star_pin:3,halo:3,clover:3,leaf:2,mushroom:3,
    antenna:3,feather:3,shell_pin:3,horns:2,crown:3,spikes:3,bone_pin:3,broken_halo:3,
    ribbon_bow:10,mini_crown:12,candy_pin:12,cloud_puff:12,cherry_clip:14,
    twig:10,bandana:12,monocle_top:12,lantern_float:14,beret:14,
    thorn_ring:10,skull_pin:12,iron_mask:12,eye_crown:14,cursed_chain:14,
    crystal_tiara:30,rainbow_halo:34,petal_wreath:36,
    ancient_rune:30,gem_cluster:34,wind_streamer:36,
    demon_wings:30,void_crown:34,shadow_cloak:38,
    cat_ears:10,bunny_ears:10,dog_ears:10,fox_ears:12,
    ninja_headband:16,blindfold:16,katana:26,
    pizza_slice:12,witch_hat:14,oni_horns:18,dragon_wings:32,maid_headband:12,
    fairy_wings:52,starfall_crown:60,spirit_orbs:52,eldritch_eye:52,celestial_halo:90,
  };
  const EYE_SCORE = {
    dot:0,sparkle:2,big_round:2,sleepy:2,happy_arc:2,wide:2,slit:2,angry_arc:2,tired:2,
    heart:3,wink:3,half_lid:3,shiny_round:5,
    droplet:7,button:8,uneven:5,void:4,monocle:8,cat_slit:10,mascara:8,
    star_eye:10,twin_spark:10,square:14,cross:9,number_3:9,sus:16,
    X_eye:12,spiral:6,dollar:12,triangle_eye:14,pupil_star:14,
    abyss:17,flame_eye:20,tearful:20,glowing:20,omega:22,loading:22,
    rainbow_iris:32,crystal_eye:36,bleeding_eye:34,galaxy_eye:65,
  };
  const PAT_SCORE = {
    solid:0,radial_glow:6,
    gradient_v:16,gradient_h:16,gradient_diag:18,
    duo_tone:32,soft_spots:34,stripe_v:36,
    galaxy_swirl:60,aurora:64,crystal_facets:66,
    prismatic:82,void_rift:88,
  };
  const CUMULATION_BONUS = [0, 0, 1.08, 1.18, 1.32];

  const shapeScore   = SHAPE_SCORE[genome.bodyShape]    ?? 0;
  const accScore     = ACC_SCORE[genome.accessory]       ?? 0;
  const eyeScore     = EYE_SCORE[genome.eyeStyle]        ?? 0;
  const patScore     = PAT_SCORE[genome.colorPattern]    ?? 0;
  const elemTotal    = shapeScore + accScore + eyeScore + patScore;

  const rareCount = [shapeScore, accScore, eyeScore, patScore].filter(s => s > 20).length;
  const cumMult   = CUMULATION_BONUS[Math.min(rareCount, CUMULATION_BONUS.length - 1)] ?? 1;

  const complexity = Number.isFinite(metrics.complexityIndex) ? metrics.complexityIndex : 0;

  const raw = (cfg.basePrice + elemTotal * cfg.rarityWeight + complexity * cfg.complexityWeight) * cumMult;
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
