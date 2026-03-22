/**
 * economy-config.js
 * Centralise tous les paramètres numériques du système économique.
 * Seuls les slimes dans l'équipe de 4 génèrent du revenu passif.
 */

/**
 * Revenu de base en inkübits/min pour chaque tier de rareté.
 *
 * Cohérence économique (4 slots d'équipe maximum) :
 *   common    ×4 = 8/min  → earn 200 inkübits in ~25 min  (common costs ~200)
 *   uncommon  ×4 = 28/min → earn 450 inkübits in ~16 min
 *   rare      ×4 = 80/min → earn 950 inkübits in ~12 min
 *   epic      ×4 = 240/min
 *   legendary ×4 = 720/min
 *
 * Pour progresser :
 *   - 2 common (départ) → 3e common en ~50 min → 4e en ~25 min
 *   - 4 common → premier uncommon en ~65 min
 *   - 4 uncommon → premier rare en ~34 min
 *   - 4 rare → premier epic en ~24 min
 */
export const RARITY_INCOME_BASE = Object.freeze({
    common:    2.0,
    uncommon:  7.0,
    rare:      20.0,
    epic:      60.0,
    legendary: 180.0,
    instable:  80.0,  // Base; real income = base × genome.marketValueMultiplier (2.5–5.0)
});

/** Multiplicateurs de revenu selon l'humeur du slime. */
export const MOOD_INCOME_MULTIPLIER = Object.freeze({
    enlightened: 1.38,
    joyful:      1.24,
    proud:       1.18,
    lovesick:    1.14,
    curious:     1.12,
    study:       1.12,
    smug:        1.10,
    frenzied:    1.10,
    dreamy:      1.08,
    calm:        1.05,
    mischief:    1.03,
    shy:         1.00,
    dizzy:       0.92,
    melancholy:  0.90,
    sleepy:      0.88,
    grumpy:      0.85,
});

/**
 * Poids de contribution de chaque stat au bonus de revenu.
 * La somme des poids = 1.0.
 * Les stats les plus "productives" (curiosité, empathie) pèsent plus.
 */
export const INCOME_STAT_WEIGHTS = Object.freeze({
    curiosity:  0.25,
    empathy:    0.22,
    vitality:   0.20,
    agility:    0.16,
    stability:  0.10,
    ferocity:   0.07,
});

/** Le bonus stat max est de +60% du revenu de base (à stats = 100). */
export const INCOME_STAT_BONUS_CAP = 0.60;

/**
 * Configuration pour le calcul du prix d'acquisition.
 *
 * Fourchettes de prix typiques :
 *   common    ~200  inkübits  (elemTotal ~5,  complexity ~0.5)
 *   uncommon  ~430  inkübits  (elemTotal ~25, complexity ~0.8)
 *   rare      ~920  inkübits  (elemTotal ~60, complexity ~1.5)
 *   epic      ~1950 inkübits  (elemTotal ~130, complexity ~2.5)
 *   legendary ~3700 inkübits  (elemTotal ~230, complexity ~4.0)
 */
export const ACQUISITION_COST_CONFIG = Object.freeze({
    basePrice:        100,
    complexityWeight: 100,
    rarityWeight:     10,   // appliqué au score cumulé des éléments visuels
    attributeWeight:  12,
    roundTo:          5,
});

/** Solde de départ du joueur en inkübits. */
export const STARTING_INKUBITS = 500;

/**
 * Nombre de minutes de génération de revenu pour récupérer le coût d'achat.
 * price = incomeRate(slime) × PRICE_RECOVERY_MINUTES
 * Garantit une cohérence directe entre prix et revenu.
 */
export const PRICE_RECOVERY_MINUTES = 100;
