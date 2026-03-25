import { PRAIRIE_SESSION_KEY, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, PANEL_MARGIN, clamp } from './prairie-constants.js';

export function loadSession() {
    try {
        const raw = window.localStorage.getItem(PRAIRIE_SESSION_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

export function saveSession(session) {
    try {
        window.localStorage.setItem(PRAIRIE_SESSION_KEY, JSON.stringify(session || {}));
    } catch (_error) {}
}

export function getViewportSize() {
    const width = Math.max(320, Math.round(window.innerWidth || document.documentElement?.clientWidth || 390));
    const height = Math.max(420, Math.round(window.innerHeight || document.documentElement?.clientHeight || 844));
    return { width, height };
}

export function normalizePanelLayout(layout = {}) {
    const viewport = getViewportSize();
    const maxWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, viewport.width - PANEL_MARGIN * 2));
    const maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, viewport.height - PANEL_MARGIN * 2));
    const width = clamp(Number.isFinite(layout.width) ? layout.width : Math.min(maxWidth, Math.round(viewport.width * 0.9)), PANEL_MIN_WIDTH, maxWidth);
    const height = clamp(Number.isFinite(layout.height) ? layout.height : Math.min(maxHeight, Math.round(viewport.height * 0.62)), PANEL_MIN_HEIGHT, maxHeight);
    const maxOffsetX = Math.max(0, (viewport.width - width) * 0.5 - PANEL_MARGIN);
    const maxOffsetY = Math.max(0, (viewport.height - height) * 0.5 - PANEL_MARGIN);
    return {
        width,
        height,
        offsetX: clamp(Number.isFinite(layout.offsetX) ? layout.offsetX : 0, -maxOffsetX, maxOffsetX),
        offsetY: clamp(Number.isFinite(layout.offsetY) ? layout.offsetY : 0, -maxOffsetY, maxOffsetY),
    };
}

export function distanceBetween(a, b) {
    return Math.hypot((a?.clientX || 0) - (b?.clientX || 0), (a?.clientY || 0) - (b?.clientY || 0));
}

export function getOrderedCanonicalIds(snapshot) {
    const ordered = [];
    const seen = new Set();

    const pushId = (canonicalId) => {
        if (typeof canonicalId !== 'string' || !canonicalId || seen.has(canonicalId)) {
            return;
        }
        if (!snapshot.recordsById?.[canonicalId]) {
            return;
        }
        seen.add(canonicalId);
        ordered.push(canonicalId);
    };

    (snapshot.teamSlots || []).forEach(pushId);
    Object.keys(snapshot.pages || {})
        .sort((a, b) => Number(a) - Number(b))
        .forEach((pageKey) => {
            (snapshot.pages[pageKey] || []).forEach(pushId);
        });
    Object.keys(snapshot.recordsById || {}).forEach(pushId);

    return ordered;
}