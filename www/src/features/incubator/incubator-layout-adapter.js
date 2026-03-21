
const DESIGN_WIDTH  = 560;
const DESIGN_HEIGHT = 720;
const DEFAULT_OVERLAP_PX   = 24;
const HEIGHT_PADDING_PX    = 8;
const VESSEL_CENTER_SHIFT_PX = 0;

export function syncIncubatorLayout({ frame, stage, overlapPx = DEFAULT_OVERLAP_PX }) {
    if (!frame || !stage) {
        return { scale: 1, overlapPx, vesselShiftPx: VESSEL_CENTER_SHIFT_PX };
    }

    const stageRect = stage.getBoundingClientRect();

    // Calcul d'échelle basé sur LARGEUR ET HAUTEUR pour que les deux consoles
    // rentrent toujours dans l'écran, quelle que soit la taille du smartphone.
    const availableHeight = Math.max(stageRect.height + overlapPx - HEIGHT_PADDING_PX, 1);
    const heightScale = availableHeight / DESIGN_HEIGHT;
    const widthScale  = stageRect.width  / DESIGN_WIDTH;

    // On prend le plus contraignant des deux axes, sans minimum trop élevé.
    const baseScale = Math.min(heightScale, widthScale);
    const scale = Math.min(Math.max(baseScale, 0.50), 1.02);

    // Supprimer la transition CSS pendant le sync pour éviter le "sursaut"
    // (la transition s'anime sinon à chaque recalcul d'échelle).
    const hadTransition = frame.style.transition;
    frame.style.transition = 'none';

    frame.style.width     = `${DESIGN_WIDTH}px`;
    frame.style.height    = `${DESIGN_HEIGHT}px`;
    frame.style.transform = `translate3d(var(--inku-storage-shift, 0px), ${overlapPx}px, 0) scale(${scale})`;
    frame.style.setProperty('--inku-incubator-scale',   String(scale));
    frame.style.setProperty('--inku-incubator-overlap', `${overlapPx}px`);

    // Double rAF : le premier rAF tire AVANT le paint (même cycle que le
    // changement de transform) → la transition serait réactivée AVANT que
    // le browser ait peint la nouvelle valeur → il interpolerait depuis
    // l'ancienne valeur = saut visible.
    // Le second rAF s'exécute après que le browser a peint une fois avec
    // transition:'none', donc la valeur est "committée" sans animation.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            frame.style.transition = hadTransition;
        });
    });

    return { scale, overlapPx, vesselShiftPx: VESSEL_CENTER_SHIFT_PX };
}
