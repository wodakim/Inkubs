/**
 * economy-config.js
 * Centralise tous les paramètres numériques du système économique.
 * Seuls les slimes dans l'équipe de 4 génèrent du revenu passif.
 */

/** Revenu de base en inkübits/min pour chaque tier de rareté. */
export const RARITY_INCOME_BASE = Object.freeze({
    common:    0.6,
    uncommon:  2.0,
    rare:      5.5,
    epic:      13.0,
    legendary: 30.0,
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

/** Configuration pour le calcul du prix d'acquisition. */
export const ACQUISITION_COST_CONFIG = Object.freeze({
    basePrice:        120,
    complexityWeight: 75,
    rarityWeight:     5,    // appliqué à rarityValue (0-100 via courbe)
    attributeWeight:  12,
    roundTo:          5,
});

/** Solde de départ du joueur en inkübits. */
export const STARTING_INKUBITS = 500;
