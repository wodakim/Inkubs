// www/src/features/potion-factory/potion-persistence.js

const STORAGE_KEY = 'inku.factory.v1';

export const BOX_MAX     = 4;   // Boîtes sur la table
export const POTION_MAX  = 4;   // Potions par boîte
export const FLASK_COUNT = 6;   // Fioles de préparation
export const BOX_COST    = 50;
export const POTION_COST = 10;
export const FLASK_MAX_DOSES = 2; // Doses pour remplir une fiole

/**
 * Limite de gouttes qu'un slime peut fournir en une interaction.
 */
export function getPotionDropLimit(slime) {
    if (!slime?.proceduralCore?.genome?.stats) return 1;
    const vitality = slime.proceduralCore.genome.stats.vitality || 0;
    return Math.max(1, Math.floor(vitality / 50));
}

export const PotionPersistence = {

    saveFactoryState(state) {
        if (!state) return false;
        try {
            const snapshot = {
                timestamp: Date.now(),
                flasks: state.flasks.map(f => ({ id: f.id, doses: [...f.doses] })),
                boxes: state.boxes.map(b => ({
                    id: b.id,
                    potions: b.potions.map(p => ({ doses: [...p.doses] })),
                    status: b.status,
                    timerEnd: b.timerEnd,
                    rewardValue: b.rewardValue,
                })),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
            return true;
        } catch (e) {
            console.error('[Factory] saveFactoryState:', e);
            return false;
        }
    },

    loadFactoryState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.flasks)) { this.clearFactoryState(); return null; }

            // Migration ancien format (box singulier)
            if (!Array.isArray(parsed.boxes) && parsed.box) {
                parsed.boxes = [{
                    id: 0,
                    potions: Array.isArray(parsed.box.potions)
                        ? parsed.box.potions.slice(0, POTION_MAX).map(p => ({ doses: [...(p.doses || [])] }))
                        : [],
                    status: parsed.box.status || 'idle',
                    timerEnd: parsed.box.timerEnd || null,
                    rewardValue: parsed.box.rewardValue || 0,
                }];
            } else if (!Array.isArray(parsed.boxes)) {
                parsed.boxes = [];
            }

            // Normalise le nombre de fioles selon FLASK_COUNT
            while (parsed.flasks.length < FLASK_COUNT) {
                parsed.flasks.push({ id: parsed.flasks.length, doses: [] });
            }
            parsed.flasks = parsed.flasks.slice(0, FLASK_COUNT);

            // Progression hors-ligne
            parsed.boxes.forEach(b => {
                if (b.status === 'packaging' && b.timerEnd && Date.now() >= b.timerEnd) {
                    b.status = 'ready';
                }
            });

            return parsed;
        } catch (e) {
            console.error('[Factory] loadFactoryState:', e);
            this.clearFactoryState();
            return null;
        }
    },

    clearFactoryState() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    },
};