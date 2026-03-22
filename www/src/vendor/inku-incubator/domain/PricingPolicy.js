/**
 * PricingPolicy.js — Politique de prix INKÜ
 * Le prix reflète la rareté CUMULÉE de chaque élément visuel du slime.
 * Un slime sans aura mais avec forme + accessoire + yeux + pattern rares
 * peut coûter plus cher qu'un slime commun avec aura.
 */

// ─── SCORES DE RARETÉ PAR ÉLÉMENT ────────────────────────────────────────────
const SHAPE_RARITY_SCORE = {
  round:0,pear:2,dumpling:2,blob:2,teardrop:2,mochi:2,
  puff:5,wisp:6,jellybean:6,bell:6,comet:7,puddle:7,
  crystal:18,ribbon:22,lantern:22,crescent:22,
  star_body:38,diamond:42,twin_lobe:46,
  fractal:72,aurora_form:76,
};

const ACCESSORY_RARITY_SCORE = {
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

const EYE_RARITY_SCORE = {
  dot:0,sparkle:2,big_round:2,sleepy:2,happy_arc:2,wide:2,slit:2,angry_arc:2,tired:2,
  heart:3,wink:3,half_lid:3,shiny_round:5,
  droplet:7,button:8,uneven:5,void:4,monocle:8,cat_slit:10,mascara:8,
  star_eye:10,twin_spark:10,square:14,cross:9,number_3:9,sus:16,
  X_eye:12,spiral:6,dollar:12,triangle_eye:14,pupil_star:14,
  abyss:17,flame_eye:20,tearful:20,glowing:20,omega:22,loading:22,
  rainbow_iris:32,crystal_eye:36,bleeding_eye:34,galaxy_eye:65,
};

const PATTERN_RARITY_SCORE = {
  solid:0,radial_glow:6,
  gradient_v:16,gradient_h:16,gradient_diag:18,
  duo_tone:32,soft_spots:34,stripe_v:36,
  galaxy_swirl:60,aurora:64,crystal_facets:66,
  prismatic:82,void_rift:88,
};

// Bonus de multiplicateur quand plusieurs éléments rares se cumulent
const CUMULATION_BONUS = [0, 0, 1.08, 1.18, 1.32]; // index = nb d'éléments rares (score>20)

function elementRarityScore(genome) {
  const shape   = SHAPE_RARITY_SCORE[genome.bodyShape]   ?? 0;
  const acc     = ACCESSORY_RARITY_SCORE[genome.accessory] ?? 0;
  const eye     = EYE_RARITY_SCORE[genome.eyeStyle]       ?? 0;
  const pattern = PATTERN_RARITY_SCORE[genome.colorPattern] ?? 0;
  return { shape, acc, eye, pattern, total: shape + acc + eye + pattern };
}

function cumulationMultiplier(genome) {
  const { shape, acc, eye, pattern } = elementRarityScore(genome);
  const rareCount = [shape, acc, eye, pattern].filter(s => s > 20).length;
  return CUMULATION_BONUS[Math.min(rareCount, CUMULATION_BONUS.length - 1)] ?? 1;
}

export function computeCanonicalPrice(candidate, pricingConfig) {
  const genome   = candidate?.metadata?.previewBlueprint?.genome || candidate?.genome || {};
  const metrics  = candidate.complexityMetrics || {};

  // Score de rareté global des éléments visuels
  const elemScores = elementRarityScore(genome);
  const elemTotal  = elemScores.total;

  // Cumulation bonus : plusieurs éléments rares = synergie de prix
  const cumMult = cumulationMultiplier(genome);

  // Complexité physique (stats globales)
  const complexity = Number.isFinite(metrics.complexityIndex) ? metrics.complexityIndex : 0;

  // Prix brut : base + éléments × poids + complexité × poids, le tout × bonus cumulation
  const rawPrice = (
    pricingConfig.basePrice
    + elemTotal      * (pricingConfig.rarityWeight ?? 5)
    + complexity     * (pricingConfig.complexityWeight ?? 75)
  ) * cumMult;

  const rounded = roundToStep(rawPrice, pricingConfig.roundTo);
  return Math.max(pricingConfig.roundTo, rounded);
}

export function roundToStep(value, step = 1) {
  if (!Number.isFinite(step) || step <= 1) {
    return Math.round(value);
  }
  return Math.round(value / step) * step;
}

// ─── Exposer les scores pour l'économie côté feature ────────────────────────
export { elementRarityScore, cumulationMultiplier };
