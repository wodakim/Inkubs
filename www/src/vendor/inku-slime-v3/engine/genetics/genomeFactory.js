import { ACCESSORY_POOLS, BODY_SHAPES, BODY_SHAPE_WEIGHTS, COLOR_PATTERNS, DETAIL_TRAITS, EYE_POOLS, MOODS, MOUTH_POOLS, RARITY_TIERS } from '../config/catalog.js';

export const GENOME_SCHEMA_VERSION = 2;

// ─── WEIGHTED PICK ──────────────────────────────────────────────────────────
function pickWeighted(pool, rng) {
  // pool is array of {id, w} or plain strings (legacy)
  if (!pool || pool.length === 0) return null;
  if (typeof pool[0] === 'string') return pool[Math.floor(rng() * pool.length)];
  const total = pool.reduce((s, e) => s + e.w, 0);
  let roll = rng() * total;
  for (const entry of pool) {
    roll -= entry.w;
    if (roll <= 0) return entry.id;
  }
  return pool[pool.length - 1].id;
}

function pickWeightedShape(rng) {
  const entries = Object.entries(BODY_SHAPE_WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [shape, w] of entries) {
    roll -= w;
    if (roll <= 0) return shape;
  }
  return 'round';
}

// ─── RARITY SCORE ────────────────────────────────────────────────────────────
// Returns 0–100. Higher = rarer. Based on inverse probability of each gene rolled.
const SHAPE_RARITY = {
  round:0,pear:1,dumpling:1,blob:2,teardrop:2,mochi:2,
  puff:5,wisp:6,jellybean:6,bell:6,comet:7,puddle:7,
  crystal:18,ribbon:22,lantern:22,crescent:22,
  star_body:38,diamond:42,twin_lobe:46,
  fractal:72,aurora_form:76
};

function accessoryRarityScore(acc) {
  const SCORES = {
    none:0,bow:1,flower:1,sprout:2,star_pin:2,halo:2,clover:2,leaf:1,mushroom:2,
    antenna:2,feather:2,shell_pin:2,horns:1,crown:2,spikes:2,bone_pin:2,broken_halo:2,
    ribbon_bow:8,mini_crown:10,candy_pin:10,cloud_puff:10,cherry_clip:12,
    twig:8,bandana:10,monocle_top:10,lantern_float:12,beret:12,
    thorn_ring:8,skull_pin:10,iron_mask:10,eye_crown:12,cursed_chain:12,
    crystal_tiara:25,rainbow_halo:28,petal_wreath:30,
    ancient_rune:25,gem_cluster:28,wind_streamer:30,
    demon_wings:25,void_crown:28,shadow_cloak:32,
    fairy_wings:45,starfall_crown:50,
    spirit_orbs:45,
    eldritch_eye:45,
    celestial_halo:80,
    // Cosplay accessories
    cat_ears:8,bunny_ears:8,dog_ears:8,fox_ears:10,
    ninja_headband:14,blindfold:14,katana:22,
    pizza_slice:10,witch_hat:12,oni_horns:16,
    dragon_wings:28,maid_headband:10
  };
  return SCORES[acc] ?? 0;
}

function eyeRarityScore(eye) {
  const SCORES = {
    dot:0,sparkle:1,big_round:1,sleepy:1,happy_arc:1,heart:2,
    droplet:5,star_eye:8,twin_spark:8,monocle:8,button:8,
    wide:1,wink:2,half_lid:2,uneven:4,slit:1,angry_arc:1,void:2,spiral:5,
    X_eye:10,abyss:14,flame_eye:18,tearful:18,
    rainbow_iris:28,crystal_eye:32,
    bleeding_eye:30,galaxy_eye:60,
    // New eyes
    cat_slit:10,shiny_round:6,cross:8,dollar:12,triangle_eye:14,
    mascara:8,glowing:18,tired:6,pupil_star:14,number_3:8,
    omega:20,square:14,loading:22,sus:16
  };
  return SCORES[eye] ?? 0;
}

function computeRarityScore(genome) {
  const pat = genome.colorPattern;
  let targetTier = 'common';
  let tierProgress = Math.abs(Math.sin((genome.hue * 13.37) + (genome.saturation * 7.73) || 1)) % 1;

  if (pat === 'solid') {
    // Check hue distance from standard colors
    const hDist = Math.min(...[0, 60, 120, 180, 240, 300, 360].map(p => Math.abs(genome.hue - p)));
    if (hDist < 15) targetTier = 'common';
    else targetTier = 'uncommon';
  } else if (['gradient_v', 'gradient_h', 'gradient_diag', 'duo_tone'].includes(pat)) {
    targetTier = 'rare';
  } else if (['radial_glow', 'soft_spots', 'stripe_v'].includes(pat)) {
    targetTier = 'super_rare';
  } else if (['galaxy_swirl', 'crystal_facets', 'aurora'].includes(pat)) {
    targetTier = 'legend';
  } else if (['prismatic', 'void_rift', 'pixel_skin', 'tribal_skin', 'cameleon', 'translucid', 'magma'].includes(pat)) {
    targetTier = 'divin';
  }

  const tierDef = RARITY_TIERS[targetTier] || RARITY_TIERS.common;
  const min = tierDef.scoreMin;
  const max = tierDef.scoreMax;
  
  const shapeBonus = (SHAPE_RARITY[genome.bodyShape] ?? 0) * 0.05; 
  const accBonus = accessoryRarityScore(genome.accessory) * 0.05;   
  const eyeBonus = eyeRarityScore(genome.eyeStyle) * 0.05;          

  let rawScore = min + ((max - min) * tierProgress) + shapeBonus + accBonus + eyeBonus;
  
  return Math.min(100, Math.max(0, Math.floor(rawScore)));
}

function rarityTierFromScore(score) {
  for (const [tier, def] of Object.entries(RARITY_TIERS)) {
    if (score >= def.scoreMin && score <= def.scoreMax) return tier;
  }
  return 'common';
}

// ─── INSTABLE GENOME FACTORY ─────────────────────────────────────────────────
export function createInstableGenome({ rng = Math.random } = {}) {
  // Mass: 50% heavy, 30% medium, 20% gaseous
  const massRoll = rng();
  const instabilityMass = massRoll < 0.50 ? 'heavy' : massRoll < 0.80 ? 'medium' : 'gaseous';

  // Colors: dark, eerie, desaturated — purples, sickly greens, muddy reds
  const eerieHues = [0, 270, 300, 120, 180, 30];
  const hue        = (eerieHues[Math.floor(rng() * eerieHues.length)] + (rng() - 0.5) * 40 + 360) % 360;
  const saturation = 38 + rng() * 28;  // 38-66% — desaturated, sickly
  const lightness  = 18 + rng() * 18;  // 18-36% — always dark

  const hue2 = (hue + 30 + rng() * 60) % 360;
  const sat2 = Math.min(100, saturation - 5 + rng() * 10);
  const lit2 = Math.min(90,  lightness  - 3 + rng() * 8);

  // Physics: very low rigidity = chaotic, wobbly
  const friction          = 0.91 + rng() * 0.02;
  let   rigidity          = 0.015 + rng() * 0.012;
  let   bounceDamping     = 0.12 + rng() * 0.12;
  const surfaceSmoothness = 0.012 + rng() * 0.01;
  const volumeBias        = 1.0 + rng() * 0.1;

  // Face: exaggerated and unsettling proportions
  const faceScale        = 0.82 + rng() * 0.22;
  const eyeSpacingBias   = -0.3 + rng() * 0.6;  // wider range = uneven
  const eyeSizeBias      = -0.35 + rng() * 0.7;
  const mouthOffsetY     = -2 + rng() * 4;
  const cheekIntensity   = 0;  // no cute cheeks
  const accessorySizeBias = 1.0 + rng() * 0.3;

  const bodyShape   = 'unstable_form';
  const eyeStyle    = pickWeighted(EYE_POOLS.instable, rng);
  const mouthStyle  = pickWeighted(MOUTH_POOLS.instable, rng);
  const detailTrait = pickWeighted(DETAIL_TRAITS, rng);
  const accessory   = pickWeighted(ACCESSORY_POOLS.instable, rng);

  // Mood: only dark/aggressive — nothing cute
  const instableMoods = [
    {id:'frenzied',w:12},{id:'grumpy',w:10},{id:'mischief',w:8},
    {id:'dizzy',w:6},{id:'smug',w:5},{id:'melancholy',w:3},
  ];
  const mood = pickWeighted(instableMoods, rng);

  // Mood-derived physics (subset that applies to instable moods)
  if (mood === 'frenzied')   { bounceDamping -= 0.05; rigidity += 0.015; }
  if (mood === 'grumpy')     { rigidity += 0.01; }
  if (mood === 'dizzy')      { bounceDamping += 0.04; }

  // Pattern: void/dark patterns preferred
  const instablePatterns = [
    {id:'void_rift',w:10},{id:'solid',w:8},{id:'galaxy_swirl',w:6},
    {id:'radial_glow',w:4},{id:'gradient_v',w:3},{id:'crystal_facets',w:2},
  ];
  const colorPattern = pickWeighted(instablePatterns, rng);

  // Behavioral genes
  const laziness = rng() * 0.2;          // 0.0-0.2 — always active, always hungry
  const dietType = rng() < 0.6 ? 'carnivore' : 'omnivore';

  // Alpha: gaseous = semi-transparent, medium = slightly, heavy = opaque
  const bodyAlpha = instabilityMass === 'gaseous' ? 0.45 + rng() * 0.15
                  : instabilityMass === 'medium'  ? 0.80 + rng() * 0.12
                  : 1.0;

  // Market value multiplier (used by pricing system)
  const marketValueMultiplier = instabilityMass === 'gaseous' ? 5.0
                              : instabilityMass === 'medium'  ? 3.5
                              : 2.5;

  const genome = {
    schemaVersion: GENOME_SCHEMA_VERSION,
    hue, hue2, sat2, lit2,
    saturation: Math.min(100, saturation),
    lightness:  Math.min(90,  lightness),
    bodyShape, eyeStyle, mouthStyle, mood, accessory, detailTrait, colorPattern,
    friction, rigidity,
    bounceDamping: Math.max(0.08, bounceDamping),
    surfaceSmoothness, volumeBias, faceScale,
    eyeSpacingBias, eyeSizeBias, mouthOffsetY, cheekIntensity, accessorySizeBias,
    laziness, dietType,
    // Instable-specific traits
    isInstable:          true,
    instabilityMass,
    bodyAlpha,
    marketValueMultiplier,
    rarityTier:  'instable',
    rarityScore: 95 + Math.floor(rng() * 5),  // 95-99
  };

  return genome;
}

// ─── GENOME FACTORY ──────────────────────────────────────────────────────────
export function createGenome(type, { rng = Math.random } = {}) {
  if (type === 'instable') return createInstableGenome({ rng });
  const hue = rng() * 360;
  let saturation = type === 'scary' ? 78 + rng() * 14 : 84 + rng() * 14;
  let lightness = type === 'scary' ? 34 + rng() * 10 : (type === 'cute' ? 67 + rng() * 12 : 54 + rng() * 14);

  const bodyShape   = pickWeightedShape(rng);
  const eyeStyle    = pickWeighted(EYE_POOLS[type], rng);
  const mouthStyle  = pickWeighted(MOUTH_POOLS[type], rng);
  const moodEntry   = pickWeighted(MOODS, rng);       // returns id string
  const mood        = typeof moodEntry === 'object' ? moodEntry : moodEntry; // always string via pickWeighted
  const detailTrait = pickWeighted(DETAIL_TRAITS, rng);
  const accessory   = pickWeighted(ACCESSORY_POOLS[type], rng);
  const colorPattern = pickWeighted(COLOR_PATTERNS, rng);

  // Secondary hue for gradient/duo patterns
  const hue2 = (hue + 60 + rng() * 120) % 360;
  const sat2 = Math.min(100, saturation - 10 + rng() * 20);
  const lit2 = Math.min(90, lightness - 5 + rng() * 15);

  let friction        = type === 'cute' ? 0.98 : (type === 'scary' ? 0.94 : 0.96);
  let rigidity        = type === 'cute' ? 0.06 : (type === 'scary' ? 0.03 : 0.14);
  let bounceDamping   = type === 'scary' ? 0.26 : 0.2;
  let surfaceSmoothness = 0.035;
  let volumeBias      = 1;

  let faceScale       = 0.92 + rng() * 0.24;
  let eyeSpacingBias  = -0.12 + rng() * 0.24;
  let eyeSizeBias     = -0.18 + rng() * 0.36;
  let mouthOffsetY    = -1 + rng() * 3;
  let cheekIntensity  = rng();
  let accessorySizeBias = 0.9 + rng() * 0.22;

  // ── Shape physics ───────────────────────────────────────────────────────────
  const shapePhysics = {
    pear:     () => { rigidity += 0.015; },
    dumpling: () => { rigidity += 0.018; volumeBias = 1.06; },
    blob:     () => { surfaceSmoothness = 0.028; },
    teardrop: () => { rigidity += 0.01; },
    mochi:    () => { friction += 0.01; surfaceSmoothness = 0.04; },
    puff:     () => { rigidity += 0.008; volumeBias = 1.04; },
    wisp:     () => { rigidity -= 0.01; surfaceSmoothness = 0.026; faceScale *= 0.95; },
    jellybean:() => { volumeBias = 1.03; faceScale *= 0.97; },
    bell:     () => { rigidity += 0.012; eyeSpacingBias *= 0.8; },
    comet:    () => { surfaceSmoothness = 0.03; friction -= 0.01; },
    puddle:   () => { rigidity -= 0.008; volumeBias = 1.08; faceScale *= 1.05; },
    crystal:  () => { rigidity += 0.025; surfaceSmoothness = 0.045; },
    ribbon:   () => { rigidity -= 0.005; faceScale *= 0.92; volumeBias = 1.02; },
    lantern:  () => { rigidity += 0.02; volumeBias = 1.05; surfaceSmoothness = 0.038; },
    crescent: () => { rigidity += 0.015; faceScale *= 0.9; },
    star_body:() => { rigidity += 0.022; surfaceSmoothness = 0.05; volumeBias = 1.03; },
    diamond:  () => { rigidity += 0.03; surfaceSmoothness = 0.05; },
    twin_lobe:() => { rigidity += 0.01; volumeBias = 1.1; eyeSpacingBias += 0.1; },
    fractal:  () => { rigidity += 0.018; surfaceSmoothness = 0.022; volumeBias = 1.02; },
    aurora_form:()=>{ rigidity -= 0.008; surfaceSmoothness = 0.025; friction -= 0.005; },
    // unstable_form: handled in createInstableGenome, not here
  };
  if (shapePhysics[bodyShape]) shapePhysics[bodyShape]();

  // ── Mood physics ────────────────────────────────────────────────────────────
  if (mood === 'sleepy')      { friction += 0.01; mouthOffsetY += 1; }
  if (mood === 'joyful')      { bounceDamping -= 0.03; eyeSizeBias += 0.08; }
  if (mood === 'grumpy')      { rigidity += 0.01; mouthOffsetY -= 0.5; }
  if (mood === 'mischief')    { saturation += 4; eyeSpacingBias += 0.04; }
  if (mood === 'calm')        { surfaceSmoothness += 0.006; }
  if (mood === 'shy')         { cheekIntensity = Math.min(1, cheekIntensity + 0.4); faceScale *= 0.95; }
  if (mood === 'dreamy')      { lightness += 3; eyeSizeBias += 0.04; }
  if (mood === 'smug')        { mouthOffsetY -= 1; eyeSpacingBias += 0.03; }
  if (mood === 'dizzy')       { bounceDamping += 0.04; }
  if (mood === 'lovesick')    { cheekIntensity = Math.min(1, cheekIntensity + 0.5); eyeSizeBias += 0.1; }
  if (mood === 'proud')       { faceScale *= 1.04; eyeSpacingBias += 0.03; }
  if (mood === 'melancholy')  { lightness -= 4; saturation -= 6; mouthOffsetY += 1; }
  if (mood === 'frenzied')    { bounceDamping -= 0.05; rigidity += 0.015; eyeSizeBias += 0.15; }
  if (mood === 'enlightened') { lightness += 6; saturation -= 4; surfaceSmoothness += 0.012; }

  // ── Behavioural genes ────────────────────────────────────────────────────────
  // laziness: 0 (hyper-active) → 1 (very lazy) — affects hunger decay rate &
  // food-seeking threshold.  Correlated loosely with mood.
  let laziness = rng();
  if (mood === 'sleepy')   laziness = Math.min(1, laziness + 0.35);
  if (mood === 'calm')     laziness = Math.min(1, laziness + 0.15);
  if (mood === 'frenzied') laziness = Math.max(0, laziness - 0.35);
  if (mood === 'mischief') laziness = Math.max(0, laziness - 0.20);

  // dietType: 'herbivore' | 'carnivore' | 'omnivore'
  // Correlated with slime type but with variation.
  const dietRoll = rng();
  let dietType;
  if (type === 'cute') {
    dietType = dietRoll < 0.60 ? 'herbivore' : dietRoll < 0.85 ? 'omnivore' : 'carnivore';
  } else if (type === 'scary') {
    dietType = dietRoll < 0.60 ? 'carnivore' : dietRoll < 0.85 ? 'omnivore' : 'herbivore';
  } else {
    dietType = dietRoll < 0.20 ? 'herbivore' : dietRoll < 0.70 ? 'omnivore' : 'carnivore';
  }

  const genome = {
    schemaVersion: GENOME_SCHEMA_VERSION,
    hue, hue2, sat2, lit2,
    saturation: Math.min(100, saturation),
    lightness: Math.min(90, lightness),
    bodyShape, eyeStyle, mouthStyle, mood, accessory, detailTrait, colorPattern,
    friction, rigidity,
    bounceDamping: Math.max(0.1, bounceDamping),
    surfaceSmoothness, volumeBias, faceScale,
    eyeSpacingBias, eyeSizeBias, mouthOffsetY, cheekIntensity, accessorySizeBias,
    laziness, dietType,
  };

  const rarityScore = computeRarityScore(genome);
  const rarityTier  = rarityTierFromScore(rarityScore);
  genome.rarityScore = rarityScore;
  genome.rarityTier  = rarityTier;

  return genome;
}

// ─── BODY RADIUS ─────────────────────────────────────────────────────────────
export function computeBodyRadiusForGenome(genome, baseRadius, angle) {
  const shape = genome.bodyShape;
  const base = baseRadius;
  let radius = base;

  // Legacy shapes (unchanged physics)
  if (shape === 'round') {
    radius += (Math.sin(angle * 3) + Math.cos(angle * 2)) * (base * 0.06);
  } else if (shape === 'pear') {
    radius += Math.max(0, Math.sin(angle)) * base * 0.18;
    radius -= Math.max(0, -Math.sin(angle)) * base * 0.08;
    radius += Math.cos(angle * 2) * base * 0.04;
  } else if (shape === 'dumpling') {
    radius += Math.max(0, Math.sin(angle)) * base * 0.13;
    radius += Math.cos(angle * 4) * base * 0.035;
  } else if (shape === 'blob') {
    radius += Math.sin(angle * 5 + 0.4) * base * 0.08;
    radius += Math.cos(angle * 3 - 0.7) * base * 0.06;
  } else if (shape === 'teardrop') {
    radius += Math.max(0, -Math.sin(angle)) * base * 0.16;
    radius -= Math.max(0, Math.sin(angle)) * base * 0.06;
    radius += Math.cos(angle * 2) * base * 0.03;
  } else if (shape === 'mochi') {
    radius += Math.cos(angle * 2) * base * 0.045;
    radius += Math.sin(angle * 6) * base * 0.018;
  } else if (shape === 'puff') {
    radius += Math.sin(angle * 4) * base * 0.055;
    radius += Math.cos(angle * 8) * base * 0.02;
  } else if (shape === 'wisp') {
    radius += Math.max(0, -Math.sin(angle)) * base * 0.1;
    radius += Math.sin(angle * 2.5) * base * 0.07;
  } else if (shape === 'jellybean') {
    radius += Math.cos(angle) * base * 0.1;
    radius += Math.sin(angle * 2) * base * 0.04;
  } else if (shape === 'bell') {
    radius += Math.max(0, Math.sin(angle)) * base * 0.16;
    radius += Math.cos(angle * 3) * base * 0.025;
    radius -= Math.max(0, -Math.sin(angle)) * base * 0.02;
  } else if (shape === 'comet') {
    radius += Math.max(0, -Math.cos(angle)) * base * 0.15;
    radius += Math.sin(angle * 3) * base * 0.03;
  } else if (shape === 'puddle') {
    radius += Math.max(0, Math.sin(angle)) * base * 0.08;
    radius += Math.cos(angle * 2) * base * 0.07;
    radius += Math.sin(angle * 6) * base * 0.015;
  }
  // ── New shapes ──────────────────────────────────────────────────────────────
  else if (shape === 'crystal') {
    // Hexagonal facet shape
    const hex = Math.cos(((angle % (Math.PI / 3)) - Math.PI / 6) * 6) * base * 0.09;
    radius += hex;
    radius += Math.cos(angle * 6) * base * 0.04;
  } else if (shape === 'ribbon') {
    // Wide flat oval pinched at sides
    radius += Math.cos(angle) * base * 0.22;
    radius -= Math.abs(Math.sin(angle * 2)) * base * 0.1;
  } else if (shape === 'lantern') {
    // Tall oval, wider equator
    radius -= Math.cos(angle * 2) * base * 0.06;
    radius += Math.sin(angle * 4) * base * 0.025;
    radius += Math.max(0, Math.sin(angle)) * base * 0.04;
  } else if (shape === 'crescent') {
    // One side more pronounced
    radius += Math.cos(angle) * base * 0.14;
    radius += Math.sin(angle * 3) * base * 0.05;
    radius -= Math.max(0, -Math.cos(angle * 0.5)) * base * 0.08;
  } else if (shape === 'star_body') {
    // 5-pointed star via high freq oscillation
    radius += Math.cos(angle * 5) * base * 0.18;
    radius += Math.cos(angle * 10) * base * 0.04;
  } else if (shape === 'diamond') {
    // 4-fold symmetry, pointed
    radius += Math.cos(angle * 4) * base * 0.16;
    radius -= Math.abs(Math.sin(angle * 2)) * base * 0.04;
  } else if (shape === 'twin_lobe') {
    // Two bumps top and bottom
    radius += Math.abs(Math.cos(angle)) * base * 0.14;
    radius += Math.cos(angle * 4) * base * 0.03;
  } else if (shape === 'fractal') {
    // Multi-frequency ripple
    radius += Math.sin(angle * 3) * base * 0.07;
    radius += Math.sin(angle * 6) * base * 0.045;
    radius += Math.sin(angle * 12) * base * 0.022;
    radius += Math.cos(angle * 5 + 0.7) * base * 0.03;
  } else if (shape === 'aurora_form') {
    // Flowing asymmetric sine blend
    radius += Math.sin(angle * 2 + 0.5) * base * 0.09;
    radius += Math.cos(angle * 3 - 0.3) * base * 0.06;
    radius += Math.sin(angle * 5 + 1.1) * base * 0.03;
    radius += Math.cos(angle * 7) * base * 0.015;
  } else if (shape === 'unstable_form') {
    // Chaotic, irregular body — bulges and dips unpredictably
    radius += Math.sin(angle * 3 + 1.2) * base * 0.13;
    radius += Math.cos(angle * 5 - 0.8) * base * 0.09;
    radius += Math.sin(angle * 7 + 0.3) * base * 0.055;
    radius += Math.cos(angle * 11)       * base * 0.028;
    radius += Math.sin(angle * 4 + 2.1) * base * 0.04;
  }

  radius *= genome.volumeBias;
  return Math.max(base * 0.65, radius);
}
