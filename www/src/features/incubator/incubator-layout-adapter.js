
const DESIGN_WIDTH = 560;
const DESIGN_HEIGHT = 720;
const DEFAULT_OVERLAP_PX = 24;
const HEIGHT_PADDING_PX = 8;
const VESSEL_CENTER_SHIFT_PX = 0;

export function syncIncubatorLayout({ frame, stage, overlapPx = DEFAULT_OVERLAP_PX }) {
    if (!frame || !stage) {
        return { scale: 1, overlapPx, vesselShiftPx: VESSEL_CENTER_SHIFT_PX };
    }

    const stageRect = stage.getBoundingClientRect();
    const availableHeight = Math.max(stageRect.height + overlapPx - HEIGHT_PADDING_PX, 1);
    const heightScale = availableHeight / DESIGN_HEIGHT;
    const scale = Math.min(Math.max(heightScale, 0.84), 1.02);

    frame.style.width = `${DESIGN_WIDTH}px`;
    frame.style.height = `${DESIGN_HEIGHT}px`;
    frame.style.transform = `translate3d(var(--inku-storage-shift, 0px), ${overlapPx}px, 0) scale(${scale})`;
    frame.style.setProperty('--inku-incubator-scale', String(scale));
    frame.style.setProperty('--inku-incubator-overlap', `${overlapPx}px`);

    return { scale, overlapPx, vesselShiftPx: VESSEL_CENTER_SHIFT_PX };
}
