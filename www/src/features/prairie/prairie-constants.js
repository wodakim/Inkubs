export const PRAIRIE_SESSION_KEY = 'inku.prairie.session.v3';
export const MAX_ACTIVE_TRUE_ENGINE = 4;
export const EDGE_SCROLL_ZONE = 58;
export const EDGE_SCROLL_SPEED = 14;
export const MIN_ZOOM = 0.38;
export const MAX_ZOOM = 2.0;
export const DEFAULT_WORLD_SCALE_X = 6.0;
export const DEFAULT_WORLD_SCALE_Y = 3.8;
export const OUT_OF_BOUNDS_SOFT_TOLERANCE = 72;
export const OUT_OF_BOUNDS_HARD_TOLERANCE = 320;
export const OUT_OF_BOUNDS_FRAME_THRESHOLD = 18;
export const MANIPULATION_OUT_OF_BOUNDS_GRACE_MS = 2400;
export const PANEL_MIN_WIDTH = 272;
export const PANEL_MAX_WIDTH = 430;
export const PANEL_MIN_HEIGHT = 260;
export const PANEL_MAX_HEIGHT = 620;
export const PANEL_MARGIN = 12;

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}