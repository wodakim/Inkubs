// src/features/potion-factory/potion-persistence.js
/**
 * PotionPersistence - Manages the state of the potion factory across sessions.
 */

/**
 * Calculates the drop limit for a given slime based on its vitality.
 * Rule: 1 drop per 50 Vitality points (VP).
 * @param {object} slime - The canonical slime record
 * @returns {number}
 */
export function getPotionDropLimit(slime) {
    if (!slime || !slime.proceduralCore?.genome?.stats) return 1;
    const stats = slime.proceduralCore.genome.stats;
    const vitality = stats.vitality || 0;
    
    // Minimum 1 drop, then 1 every 50 points
    return Math.max(1, Math.floor(vitality / 50));
}

export const PotionPersistence = {
    // Future methods:
    // saveFactoryState(state) {}
    // loadFactoryState() {}
};
