import { t } from '../../i18n/i18n.js';
import { Slime } from '../../vendor/inku-slime-v3/engine/entities/Slime.js';
import { Particle } from '../../vendor/inku-slime-v3/engine/entities/Particle.js';
import {
    ctx,
    particles,
    setCanvas,
    setViewport,
    setWorldBounds,
    clearParticles,
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
} from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';
import { buildCanonicalBlueprintFromRecord } from '../storage/storage-canonical-inspection-sandbox.js';
import { renderStorageSlots } from '../storage/storage-grid-renderer.js';
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { SlimeInteractionEngine } from './slime-interaction-engine.js';
import { getPerfSettings, getPerformanceTier } from '../../utils/device-performance-profile.js';

const PRAIRIE_SESSION_KEY = 'inku.prairie.session.v3';
const MAX_ACTIVE_TRUE_ENGINE = 4;
const EDGE_SCROLL_ZONE = 58;
const EDGE_SCROLL_SPEED = 14;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 2.0;
const DEFAULT_WORLD_SCALE_X = 6.0;
const DEFAULT_WORLD_SCALE_Y = 3.8;
const OUT_OF_BOUNDS_SOFT_TOLERANCE = 72;
const OUT_OF_BOUNDS_HARD_TOLERANCE = 320;
const OUT_OF_BOUNDS_FRAME_THRESHOLD = 18;
const MANIPULATION_OUT_OF_BOUNDS_GRACE_MS = 2400;
const PANEL_MIN_WIDTH = 272;
const PANEL_MAX_WIDTH = 430;
const PANEL_MIN_HEIGHT = 260;
const PANEL_MAX_HEIGHT = 620;
const PANEL_MARGIN = 12;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadSession() {
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

function saveSession(session) {
    try {
        window.localStorage.setItem(PRAIRIE_SESSION_KEY, JSON.stringify(session || {}));
    } catch (_error) {}
}

function getViewportSize() {
    const width = Math.max(320, Math.round(window.innerWidth || document.documentElement?.clientWidth || 390));
    const height = Math.max(420, Math.round(window.innerHeight || document.documentElement?.clientHeight || 844));
    return { width, height };
}

function normalizePanelLayout(layout = {}) {
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

function distanceBetween(a, b) {
    return Math.hypot((a?.clientX || 0) - (b?.clientX || 0), (a?.clientY || 0) - (b?.clientY || 0));
}

function getOrderedCanonicalIds(snapshot) {
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

export function createPrairieFeature() {
    const storageContext = getStorageRuntimeContext();

    let root = null;
    let viewport = null;
    let scene = null;
    let canvas = null;
    let minimapCanvas = null;
    let droneToggle = null;
    let dronePanel = null;
    let droneClose = null;
    let dronePanelDragHandle = null;
    let dronePanelResizeHandle = null;
    let droneTeamGrid = null;
    let droneArchiveGrid = null;
    let droneCap = null;
    let droneArchiveHint = null;
    let emptyState = null;
    let resizeObserver = null;
    let unsubscribeRepository = null;
    let currentMount = null;
    let rafId = 0;
    let backgroundTickId = 0;
    let saveTimeout = 0;
    let isSuspended = false;
    let interactionsBound = false;
    let dronePanelCloseTimeout = 0;
    let panelDrag = null;
    let panelResize = null;
    let panelLayout = null;

    const session = loadSession();
    panelLayout = normalizePanelLayout(session.panel || {});
    const interactionEngine = new SlimeInteractionEngine();
    let camera = {
        x: Number.isFinite(session.camera?.x) ? session.camera.x : 0,
        y: Number.isFinite(session.camera?.y) ? session.camera.y : 0,
        zoom: Number.isFinite(session.camera?.zoom) ? clamp(session.camera.zoom, MIN_ZOOM, MAX_ZOOM) : 1,
    };
    let world = { width: 1440, height: 920, groundY: 720, left: 40, top: 68, right: 1400, bottom: 720 };
    let activeCanonicalIds = Array.isArray(session.activeCanonicalIds)
        ? session.activeCanonicalIds.filter((value, index, source) => typeof value === 'string' && value && source.indexOf(value) === index).slice(0, MAX_ACTIVE_TRUE_ENGINE)
        : [];
    const runtimeById = new Map();
    const pointers = new Map();
    let pointerMode = 'idle';
    let panAnchor = null;
    let pinchAnchor = null;
    let activeDrag = null;
    let edgeScrollPointer = null;
    // Rect du viewport mis en cache pour éviter getBoundingClientRect() chaque frame
    // dans applyEdgeScroll. Mis à jour dans resize() seulement.
    let viewportEdgeRect = null;

    // ── Observation Loupe state ──────────────────────────────────────────
    let loupeBtn = null;
    let obsPanel = null;
    let obsClose = null;
    let obsTitle = null;
    let obsHint = null;
    let obsBody = null;
    let obsPageLog = null;
    let obsPageStats = null;
    let obsPageJournal = null;
    let obsTabs = [];
    let obsSelectedSlimeId = null;
    let obsActiveTab = 'log';
    let obsOpen = false;
    let obsLoupeMode = false;  // true when loupe is active and user should tap a slime
    let obsUpdateInterval = 0;
    let obsDragHandle = null;
    let obsDrag   = null; // { pid, sx, sy, pt, pl }
    let obsResize = null; // { pid, sx, sy, pw, ph, pt, pl, corner }
    let obsPos    = null; // { top, left, width, height } — null = use CSS default

    function applyPanelLayout() {
        if (!dronePanel) {
            return;
        }
        panelLayout = normalizePanelLayout(panelLayout || {});
        dronePanel.style.setProperty('--prairie-panel-width', `${panelLayout.width}px`);
        dronePanel.style.setProperty('--prairie-panel-height', `${panelLayout.height}px`);
        dronePanel.style.setProperty('--prairie-panel-offset-x', `${panelLayout.offsetX}px`);
        dronePanel.style.setProperty('--prairie-panel-offset-y', `${panelLayout.offsetY}px`);
    }

    function buildShell() {
        root = document.createElement('section');
        root.className = 'prairie-feature';
        root.dataset.prairieFeature = 'true';
        root.innerHTML = `
            <div class="prairie-feature__viewport" data-prairie-viewport>
                <div class="prairie-feature__scene" data-prairie-scene>
                    <div class="prairie-feature__sky-glow prairie-feature__sky-glow--left"></div>
                    <div class="prairie-feature__sky-glow prairie-feature__sky-glow--right"></div>
                </div>
                <div class="prairie-feature__ground-band" data-prairie-ground-band></div>
                <div class="prairie-feature__ground-line" data-prairie-ground-line></div>
                <canvas class="prairie-feature__engine" data-prairie-canvas aria-label="${t('prairie.canvas_aria')}"></canvas>
            </div>
            <div class="prairie-feature__overlay">
                <div class="prairie-feature__topbar">
                    <div class="prairie-minimap-wrapper">
                        <div class="prairie-minimap glass-panel">
                            <canvas class="prairie-minimap__canvas" data-prairie-minimap width="152" height="86" aria-label="${t('prairie.minimap_aria')}"></canvas>
                        </div>
                    </div>
                    <div class="prairie-drone">
                        <button type="button" class="prairie-drone__toggle glass-panel" data-prairie-drone-toggle aria-expanded="false" aria-controls="prairie-drone-panel" aria-label="${t('prairie.open_storage_aria')}">
                            <span class="prairie-drone__icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3"/></svg></span>
                            <span class="prairie-drone__cap-pill" data-prairie-cap-pill aria-hidden="true">·</span>
                        </button>
                        <div id="prairie-drone-panel" class="prairie-drone__panel storage-panel storage-panel--prairie-compact" data-prairie-drone-panel hidden>
                            <div class="storage-panel__surface">
                                <header class="storage-panel__header prairie-drone__storage-header" data-prairie-panel-drag-handle>
                                    <div class="prairie-drone__header-copy">
                                        <h2 class="storage-panel__title">Slimes</h2>
                                        <p class="prairie-drone__header-meta"><span data-prairie-cap>0</span><span class="prairie-drone__header-sep">/</span><span>${MAX_ACTIVE_TRUE_ENGINE}</span></p>
                                    </div>
                                    <button type="button" class="storage-panel__close" data-prairie-drone-close aria-label="${t('prairie.close_storage_aria')}">×</button>
                                </header>
                                <div class="storage-panel__body prairie-drone__storage-body">
                                    <section class="storage-panel__section storage-panel__section--team">
                                        <div class="storage-panel__section-header">
                                            <h3>Prairie</h3>
                                        </div>
                                        <div class="storage-panel__meadow storage-panel__meadow--team">
                                            <div class="storage-team-grid" data-prairie-team-grid></div>
                                        </div>
                                    </section>
                                    <section class="storage-panel__section storage-panel__section--archive">
                                        <div class="storage-panel__section-header">
                                            <h3>Archive</h3>
                                            <span class='prairie-drone__section-badge' data-prairie-archive-hint></span>
                                        </div>
                                        <div class="storage-panel__meadow storage-panel__meadow--archive">
                                            <div class="storage-archive-grid" data-prairie-archive-grid></div>
                                            <p class="prairie-drone__empty" data-prairie-empty hidden>Réserve vide</p>
                                        </div>
                                    </section>
                                </div>
                                <button type="button" class="prairie-drone__resize-handle" data-prairie-panel-resize aria-label="${t('prairie.resize_storage_aria')}"></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="prairie-feature__help glass-panel" data-prairie-help>Glisse · Pince pour zoomer</div>
                <button type="button" class="prairie-loupe glass-panel" data-prairie-loupe aria-label="${t('prairie.observe_aria')}">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><line x1="11.5" y1="11.5" x2="16" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
                <div class="prairie-obs" data-prairie-obs hidden>
                    <div class="prairie-obs__corner" data-corner="tl"></div>
                    <div class="prairie-obs__corner" data-corner="tr"></div>
                    <div class="prairie-obs__corner" data-corner="bl"></div>
                    <div class="prairie-obs__corner" data-corner="br"></div>
                    <div class="prairie-obs__surface">
                        <header class="prairie-obs__header" data-prairie-obs-drag>
                            <h3 class="prairie-obs__title" data-prairie-obs-title>Observation</h3>
                            <div class="prairie-obs__tabs">
                                <button type="button" class="prairie-obs__tab is-active" data-prairie-obs-tab="log">${t('prairie.obs.tab_activity')}</button>
                                <button type="button" class="prairie-obs__tab" data-prairie-obs-tab="stats">${t('prairie.obs.tab_stats')}</button>
                                <button type="button" class="prairie-obs__tab" data-prairie-obs-tab="journal">${t('prairie.obs.tab_journal')}</button>
                            </div>
                            <button type="button" class="prairie-obs__close" data-prairie-obs-close>×</button>
                        </header>
                        <div class="prairie-obs__hint" data-prairie-obs-hint>${t('prairie.obs.hint')}</div>
                        <div class="prairie-obs__body" data-prairie-obs-body>
                            <div class="prairie-obs__page prairie-obs__page--log is-active" data-prairie-obs-page="log"></div>
                            <div class="prairie-obs__page prairie-obs__page--stats" data-prairie-obs-page="stats"></div>
                            <div class="prairie-obs__page prairie-obs__page--journal" data-prairie-obs-page="journal"></div>
                        </div>
                    </div>
                </div>
            </div>`;

        viewport = root.querySelector('[data-prairie-viewport]');
        scene = root.querySelector('[data-prairie-scene]');
        canvas = root.querySelector('[data-prairie-canvas]');
        minimapCanvas = root.querySelector('[data-prairie-minimap]');
        droneToggle = root.querySelector('[data-prairie-drone-toggle]');
        dronePanel = root.querySelector('[data-prairie-drone-panel]');
        droneClose = root.querySelector('[data-prairie-drone-close]');
        dronePanelDragHandle = root.querySelector('[data-prairie-panel-drag-handle]');
        dronePanelResizeHandle = root.querySelector('[data-prairie-panel-resize]');
        droneTeamGrid = root.querySelector('[data-prairie-team-grid]');
        droneArchiveGrid = root.querySelector('[data-prairie-archive-grid]');
        droneCap = root.querySelector('[data-prairie-cap]');
        droneArchiveHint = root.querySelector('[data-prairie-archive-hint]');
        emptyState = root.querySelector('[data-prairie-empty]');
        loupeBtn = root.querySelector('[data-prairie-loupe]');
        obsPanel = root.querySelector('[data-prairie-obs]');
        obsClose = root.querySelector('[data-prairie-obs-close]');
        obsDragHandle = root.querySelector('[data-prairie-obs-drag]');
        obsTitle = root.querySelector('[data-prairie-obs-title]');
        obsHint = root.querySelector('[data-prairie-obs-hint]');
        obsBody = root.querySelector('[data-prairie-obs-body]');
        obsPageLog = root.querySelector('[data-prairie-obs-page="log"]');
        obsPageStats = root.querySelector('[data-prairie-obs-page="stats"]');
        obsPageJournal = root.querySelector('[data-prairie-obs-page="journal"]');
        obsTabs = [...root.querySelectorAll('[data-prairie-obs-tab]')];
    }

    function ensureShell(mount) {
        if (!root) {
            buildShell();
        }
        currentMount = mount;
        if (!root.isConnected) {
            mount.appendChild(root);
        }
        mount.classList.add('content-mount--prairie');
    }

    function ensureCanvasRuntime() {
        if (!canvas) {
            return;
        }
        const runtimeContext = canvas.getContext('2d', { alpha: true });
        setCanvas(canvas, runtimeContext);
    }

    function resizeCanvas() {
        if (!canvas || !viewport) {
            return;
        }
        const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
        const cssWidth  = Math.max(1, Math.round(viewport.clientWidth  || canvas.clientWidth  || 390));
        const cssHeight = Math.max(1, Math.round(viewport.clientHeight || canvas.clientHeight || 720));
        const nextWidth  = Math.round(cssWidth  * dpr);
        const nextHeight = Math.round(cssHeight * dpr);
        canvas.width  = nextWidth;
        canvas.height = nextHeight;
        canvas.style.width  = cssWidth  + 'px';
        canvas.style.height = cssHeight + 'px';
        setViewport(nextWidth, nextHeight);
    }

    function computeWorld() {
        const width = Math.max(1, Math.round(viewport?.clientWidth || canvas?.clientWidth || 390));
        const height = Math.max(1, Math.round(viewport?.clientHeight || canvas?.clientHeight || 720));
        const nextWorldWidth = Math.max(2400, Math.round(width * DEFAULT_WORLD_SCALE_X));
        const nextWorldHeight = Math.max(1600, Math.round(height * DEFAULT_WORLD_SCALE_Y));
        const groundY = Math.round(nextWorldHeight * 0.74);
        world = {
            width: nextWorldWidth,
            height: nextWorldHeight,
            groundY,
            left: 42,
            top: 76,
            right: nextWorldWidth - 42,
            bottom: groundY,
        };
        scene?.style.setProperty('--prairie-world-width', `${world.width}px`);
        scene?.style.setProperty('--prairie-world-height', `${world.height}px`);
        scene?.style.setProperty('--prairie-ground-y', `${world.groundY}px`);
        setWorldBounds(world.width, world.height);
        for (const entry of runtimeById.values()) {
            entry.slime.worldBounds = { left: world.left, top: world.top, right: world.right, bottom: world.bottom };
        }
        // Rebuild prairie objects when world size changes
        buildPrairieObjects();
        clampCamera();
    }

    function screenToWorld(clientX, clientY) {
        const rect = canvas?.getBoundingClientRect?.();
        if (!rect || !rect.width || !rect.height || !canvas) {
            return null;
        }
        // localX/Y are in canvas device pixels; effectiveZoom accounts for DPR.
        const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
        const effectiveZoom = camera.zoom * dpr;
        const localX = ((clientX - rect.left) / rect.width) * canvas.width;
        const localY = ((clientY - rect.top) / rect.height) * canvas.height;
        return {
            x: camera.x + (localX - canvas.width * 0.5) / effectiveZoom,
            y: camera.y + (localY - canvas.height * 0.5) / effectiveZoom,
        };
    }

    function worldToScreen(worldX, worldY) {
        const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
        const effectiveZoom = camera.zoom * dpr;
        return {
            x: ((worldX - camera.x) * effectiveZoom) + (canvas?.width || 1) * 0.5,
            y: ((worldY - camera.y) * effectiveZoom) + (canvas?.height || 1) * 0.5,
        };
    }

    function clampCamera() {
        // Use CSS pixel dimensions (not canvas device pixels) so world units match.
        const viewWidth = Math.max(1, viewport?.clientWidth || canvas?.clientWidth || 1);
        const viewHeight = Math.max(1, viewport?.clientHeight || canvas?.clientHeight || 1);
        const halfViewWidth = viewWidth * 0.5 / Math.max(camera.zoom, 0.1);
        const halfViewHeight = viewHeight * 0.5 / Math.max(camera.zoom, 0.1);
        camera.x = clamp(Number.isFinite(camera.x) ? camera.x : world.width * 0.5, halfViewWidth, Math.max(halfViewWidth, world.width - halfViewWidth));
        camera.y = clamp(Number.isFinite(camera.y) ? camera.y : world.height * 0.5, halfViewHeight, Math.max(halfViewHeight, world.height - halfViewHeight));
        camera.zoom = clamp(Number.isFinite(camera.zoom) ? camera.zoom : 1, MIN_ZOOM, MAX_ZOOM);
    }

    function listRecords() {
        const snapshot = storageContext.repository.getSnapshot();
        return getOrderedCanonicalIds(snapshot)
            .map((canonicalId) => snapshot.recordsById[canonicalId])
            .filter(Boolean);
    }

    function findRecordById(canonicalId) {
        const snapshot = storageContext.repository.getSnapshot();
        return snapshot.recordsById?.[canonicalId] || null;
    }

    function getDefaultDeploymentPlacement(slotIndex = 0) {
        const patterns = [
            { x: 0.38, y: 0.64 },
            { x: 0.62, y: 0.64 },
            { x: 0.46, y: 0.54 },
            { x: 0.54, y: 0.54 },
        ];
        const pattern = patterns[slotIndex] || patterns[0];
        return {
            x: clamp(world.width * pattern.x, world.left + 90, world.right - 90),
            y: clamp(world.height * pattern.y, world.top + 90, world.bottom - 20),
        };
    }

    function getPrairieRespawnCenter(slotIndex = 0) {
        const placement = getDefaultDeploymentPlacement(slotIndex);
        return {
            x: placement.x,
            y: clamp(world.groundY - 96, world.top + 72, world.bottom - 18),
        };
    }

    function getSavedPrairiePlacement(record, slotIndex = 0) {
        const prairieState = record?.prairieState && typeof record.prairieState === 'object' ? record.prairieState : null;
        if (Number.isFinite(prairieState?.x) && Number.isFinite(prairieState?.y)) {
            return {
                x: clamp(prairieState.x, world.left + 40, world.right - 40),
                y: clamp(prairieState.y, world.top + 40, world.bottom - 20),
            };
        }
        return getDefaultDeploymentPlacement(slotIndex);
    }

    function getActiveEntries() {
        return activeCanonicalIds
            .map((canonicalId) => runtimeById.get(canonicalId))
            .filter(Boolean);
    }

    function syncSceneTransform() {
        if (!scene || !viewport) {
            return;
        }
        const translateX = (viewport.clientWidth * 0.5) - (camera.x * camera.zoom);
        const translateY = (viewport.clientHeight * 0.5) - (camera.y * camera.zoom);
        scene.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${camera.zoom})`;

        // Ground elements live outside the scene so they stay fixed in screen space.
        const screenGroundY = translateY + world.groundY * camera.zoom;
        viewport.style.setProperty('--prairie-screen-ground-y', `${Math.round(screenGroundY)}px`);
    }

    function scheduleSessionSave(reason = 'session_save') {
        clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            persistAllActiveRecords(reason);
            saveSession({ activeCanonicalIds: [...activeCanonicalIds], camera: { ...camera }, panel: panelLayout });
        }, 120);
    }

    function upsertPrairieState(draft, canonicalId, updates = {}) {
        const record = draft.recordsById?.[canonicalId];
        if (!record) {
            return;
        }
        record.prairieState = {
            ...(record.prairieState || {}),
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        record.updatedAt = new Date().toISOString();
    }

    function persistAllActiveRecords(reason = 'manual') {
        if (!activeCanonicalIds.length) {
            return;
        }

        const payloads = getActiveEntries().map((entry) => {
            const slime = entry.slime;
            const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
            return {
                canonicalId: entry.canonicalId,
                snapshot: slime.exportCanonicalSnapshot?.() || null,
                livingState: slime.exportLivingStateSnapshot?.() || null,
                prairieState: {
                    x: Number.isFinite(center?.x) ? center.x : entry.record?.prairieState?.x,
                    y: Number.isFinite(center?.y) ? center.y : entry.record?.prairieState?.y,
                    camera: { ...camera },
                    deployed: true,
                    reason,
                },
            };
        });

        storageContext.repository.transact((draft) => {
            const deployedSet = new Set(payloads.map((payload) => payload.canonicalId));
            Object.values(draft.recordsById || {}).forEach((record) => {
                if (!record?.canonicalId) {
                    return;
                }
                if (!deployedSet.has(record.canonicalId) && record.prairieState?.deployed) {
                    upsertPrairieState(draft, record.canonicalId, { deployed: false, camera: { ...camera }, reason });
                }
            });
            payloads.forEach((payload) => {
                const record = draft.recordsById?.[payload.canonicalId];
                if (!record) {
                    return;
                }
                if (payload.snapshot) {
                    record.canonicalSnapshot = payload.snapshot;
                }
                if (payload.livingState) {
                    record.livingState = payload.livingState;
                }
                upsertPrairieState(draft, payload.canonicalId, payload.prairieState);
            });
            return draft;
        }, { type: 'prairie:persist_active_records', reason, canonicalIds: [...activeCanonicalIds] });
    }

    function markRecordWithdrawn(canonicalId, reason = 'prairie_withdraw') {
        storageContext.repository.transact((draft) => {
            upsertPrairieState(draft, canonicalId, { deployed: false, camera: { ...camera }, reason });
            return draft;
        }, { type: 'prairie:withdraw_record', canonicalId, reason });
    }

    function createCanonicalRuntime(record, slotIndex = 0, placement = null, impulseY = -1.8) {
        const blueprint = buildCanonicalBlueprintFromRecord(record);
        if (!blueprint) {
            return null;
        }
        const spawnAt = placement || getSavedPrairiePlacement(record, slotIndex);
        const slime = new Slime({
            blueprint: deepClone(blueprint),
            spawnX: spawnAt.x,
            spawnY: spawnAt.y,
            spawnImpulseY: impulseY,
            spawnImpulseX: 0,
            boxPadding: 0,
            worldBounds: { left: world.left, top: world.top, right: world.right, bottom: world.bottom },
            surfaceIntegrityExplosionEnabled: false,
        });
        const runtimePose = record.canonicalSnapshot?.runtimePose || {};
        if (runtimePose.facing === -1 || runtimePose.facing === 1) {
            slime.facing = runtimePose.facing;
        }
        slime.explode = function prairieSuppressedExplosion() {
            this.restoreSurfaceIntegrity?.({ preserveVelocity: false });
        };
        for (let i = 0; i < 8; i += 1) {
            slime.update();
        }
        // Store canonical name for the interaction/memory system
        slime._canonicalName = record?.identity?.name
            || record?.canonicalSnapshot?.identity?.name
            || record?.displayName
            || 'Inkübus';
        return slime;
    }

    function deployCanonicalSlime(canonicalId, { preserveCamera = false, placement = null, impulseY = -1.8 } = {}) {
        if (runtimeById.has(canonicalId) || activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE) {
            return false;
        }
        const record = findRecordById(canonicalId);
        if (!record) {
            return false;
        }
        const slotIndex = activeCanonicalIds.length;
        const slime = createCanonicalRuntime(record, slotIndex, placement, impulseY);
        if (!slime) {
            return false;
        }
        runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
        activeCanonicalIds = [...activeCanonicalIds, canonicalId];
        if (!preserveCamera) {
            const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.() || getSavedPrairiePlacement(record, slotIndex);
            camera.x = center.x;
            camera.y = clamp(center.y - 120, world.height * 0.28, world.height * 0.7);
            clampCamera();
        }
        renderDronePanel();
        scheduleSessionSave('prairie_deploy');
        return true;
    }

    function withdrawCanonicalSlime(canonicalId) {
        const entry = runtimeById.get(canonicalId);
        if (!entry) {
            return;
        }
        entry.slime.releaseGrab?.();
        const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
        storageContext.repository.transact((draft) => {
            const record = draft.recordsById?.[canonicalId];
            if (!record) {
                return draft;
            }
            record.canonicalSnapshot = entry.slime.exportCanonicalSnapshot?.() || record.canonicalSnapshot;
            record.livingState = entry.slime.exportLivingStateSnapshot?.() || record.livingState;
            upsertPrairieState(draft, canonicalId, {
                x: Number.isFinite(center?.x) ? center.x : record.prairieState?.x,
                y: Number.isFinite(center?.y) ? center.y : record.prairieState?.y,
                camera: { ...camera },
                deployed: false,
                reason: 'prairie_withdraw',
            });
            return draft;
        }, { type: 'prairie:withdraw_record', canonicalId });
        runtimeById.delete(canonicalId);
        interactionEngine.removeSlime(canonicalId);
        activeCanonicalIds = activeCanonicalIds.filter((value) => value !== canonicalId);
        renderDronePanel();
        scheduleSessionSave('prairie_withdraw');
    }

    function respawnOutOfBounds(canonicalId) {
        const existing = runtimeById.get(canonicalId);
        const slotIndex = activeCanonicalIds.indexOf(canonicalId);
        if (!existing || slotIndex < 0) {
            return;
        }
        existing.slime.releaseGrab?.();
        for (let i = 0; i < 18; i += 1) {
            const sourceNode = existing.slime.nodes?.[Math.floor(Math.random() * existing.slime.nodes.length)] || null;
            if (sourceNode) {
                particles.push(new Particle(sourceNode.x, sourceNode.y, existing.slime.color));
            }
        }
        const record = findRecordById(canonicalId) || existing.record;
        if (!record) {
            runtimeById.delete(canonicalId);
            activeCanonicalIds = activeCanonicalIds.filter((value) => value !== canonicalId);
            renderDronePanel();
            return;
        }
        const slime = createCanonicalRuntime(record, slotIndex, getPrairieRespawnCenter(slotIndex), -2.1);
        if (!slime) {
            return;
        }
        runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
        storageContext.repository.transact((draft) => {
            upsertPrairieState(draft, canonicalId, {
                x: getPrairieRespawnCenter(slotIndex).x,
                y: getPrairieRespawnCenter(slotIndex).y,
                camera: { ...camera },
                deployed: true,
                reason: 'prairie_out_of_bounds_respawn',
            });
            return draft;
        }, { type: 'prairie:out_of_bounds_respawn', canonicalId });
        renderDronePanel();
    }

    function getSlimeRadius(slime, center = null) {
        if (!slime) {
            return 0;
        }
        const pivot = center || slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        let radius = Math.max(18, slime.baseRadius * 0.8);
        for (const node of slime.nodes || []) {
            radius = Math.max(radius, Math.hypot(node.x - pivot.x, node.y - pivot.y));
        }
        return radius;
    }

    function markEntryManipulated(entry) {
        if (!entry) {
            return;
        }
        entry.lastManipulatedAt = performance.now();
        entry.outOfBoundsFrames = 0;
    }

    function wasRecentlyManipulated(entry, now = performance.now()) {
        return Boolean(entry && Number.isFinite(entry.lastManipulatedAt) && (now - entry.lastManipulatedAt) <= MANIPULATION_OUT_OF_BOUNDS_GRACE_MS);
    }

    function recoverSlimeIntoPrairie(entry) {
        const slime = entry?.slime;
        if (!slime) {
            return;
        }
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!center) {
            return;
        }
        const radius = Math.max(28, getSlimeRadius(slime, center));
        const safeMargin = Math.max(34, radius * 0.82);
        const targetX = clamp(center.x, world.left + safeMargin, world.right - safeMargin);
        const targetY = clamp(center.y, world.top + safeMargin, world.bottom - safeMargin);
        const shiftX = targetX - center.x;
        const shiftY = targetY - center.y;
        if (Math.abs(shiftX) > 0.001 || Math.abs(shiftY) > 0.001) {
            for (const node of slime.nodes || []) {
                node.x += shiftX;
                node.y += shiftY;
                node.oldX += shiftX;
                node.oldY += shiftY;
            }
        }
        slime.restoreSurfaceIntegrity?.({ preserveVelocity: false });
    }

    function resolveSlimeCollisions() {
        const entries = getActiveEntries();
        for (let iteration = 0; iteration < 2; iteration += 1) {
            for (let i = 0; i < entries.length; i += 1) {
                for (let j = i + 1; j < entries.length; j += 1) {
                    const first = entries[i].slime;
                    const second = entries[j].slime;
                    const centerA = first.getRawVisualCenter?.() || first.getVisualCenter?.();
                    const centerB = second.getRawVisualCenter?.() || second.getVisualCenter?.();
                    const dx = centerB.x - centerA.x;
                    const dy = centerB.y - centerA.y;
                    const distance = Math.hypot(dx, dy) || 0.0001;
                    const minDistance = getSlimeRadius(first, centerA) + getSlimeRadius(second, centerB) - 10;
                    if (distance >= minDistance) {
                        continue;
                    }
                    const overlap = minDistance - distance;
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const firstWeight = first.draggedNode ? 0.2 : 0.5;
                    const secondWeight = second.draggedNode ? 0.2 : 0.5;
                    const totalWeight = firstWeight + secondWeight || 1;
                    const firstPush = overlap * (firstWeight / totalWeight);
                    const secondPush = overlap * (secondWeight / totalWeight);
                    for (const node of first.nodes || []) {
                        if (node === first.draggedNode) {
                            continue;
                        }
                        node.x -= nx * firstPush;
                        node.y -= ny * firstPush;
                        node.oldX -= nx * firstPush;
                        node.oldY -= ny * firstPush;
                    }
                    for (const node of second.nodes || []) {
                        if (node === second.draggedNode) {
                            continue;
                        }
                        node.x += nx * secondPush;
                        node.y += ny * secondPush;
                        node.oldX += nx * secondPush;
                        node.oldY += ny * secondPush;
                    }
                }
            }
        }
    }

    function renderMinimap() {
        if (!minimapCanvas || !viewport) {
            return;
        }
        const context = minimapCanvas.getContext('2d');
        if (!context) {
            return;
        }
        const width = minimapCanvas.width;
        const height = minimapCanvas.height;
        context.clearRect(0, 0, width, height);
        context.fillStyle = 'rgba(4, 11, 18, 0.9)';
        context.fillRect(0, 0, width, height);
        const padding = 8;
        const scale = Math.min((width - padding * 2) / world.width, (height - padding * 2) / world.height);
        const mapWidth = world.width * scale;
        const mapHeight = world.height * scale;
        const offsetX = (width - mapWidth) * 0.5;
        const offsetY = (height - mapHeight) * 0.5;
        context.fillStyle = 'rgba(66, 126, 123, 0.25)';
        context.fillRect(offsetX, offsetY, mapWidth, mapHeight);
        context.fillStyle = 'rgba(63, 126, 91, 0.8)';
        context.fillRect(offsetX, offsetY + world.groundY * scale, mapWidth, Math.max(2, mapHeight - world.groundY * scale));
        context.strokeStyle = 'rgba(155, 255, 190, 0.85)';
        context.lineWidth = 1.4;
        context.strokeRect(offsetX, offsetY, mapWidth, mapHeight);
        const viewWorldWidth = viewport.clientWidth / camera.zoom;
        const viewWorldHeight = viewport.clientHeight / camera.zoom;
        context.strokeStyle = 'rgba(184, 248, 255, 0.95)';
        context.strokeRect(
            offsetX + (camera.x - viewWorldWidth * 0.5) * scale,
            offsetY + (camera.y - viewWorldHeight * 0.5) * scale,
            viewWorldWidth * scale,
            viewWorldHeight * scale,
        );
        for (const entry of getActiveEntries()) {
            const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
            if (!center) {
                continue;
            }
            context.fillStyle = 'rgba(92, 255, 122, 0.95)';
            context.beginPath();
            context.arc(offsetX + center.x * scale, offsetY + center.y * scale, 3.5, 0, Math.PI * 2);
            context.fill();
        }
        // Object dots on minimap
        for (const obj of prairieObjects) {
            if (!obj.interactive) continue;
            const dotColor = obj.type === 'ball' ? 'rgba(255,200,80,0.7)'
                : obj.type === 'rock' ? 'rgba(140,140,160,0.5)'
                : obj.type === 'flower' ? 'rgba(255,120,180,0.5)'
                : 'rgba(180,180,120,0.35)';
            context.fillStyle = dotColor;
            context.beginPath();
            context.arc(offsetX + obj.x * scale, offsetY + (obj.y || world.groundY) * scale, 1.8, 0, Math.PI * 2);
            context.fill();
        }
    }

    function renderDronePanel() {
        if (!droneTeamGrid || !droneArchiveGrid) {
            return;
        }
        const records = listRecords();
        const activeSet = new Set(activeCanonicalIds);
        const teamEntries = Array.from({ length: MAX_ACTIVE_TRUE_ENGINE }, (_, slotIndex) => {
            const canonicalId = activeCanonicalIds[slotIndex] || null;
            const record = canonicalId ? findRecordById(canonicalId) || runtimeById.get(canonicalId)?.record || null : null;
            return {
                canonicalId,
                record,
                placement: { kind: 'team', slotIndex },
            };
        });
        const archiveEntries = records
            .filter((record) => !activeSet.has(record.canonicalId))
            .map((record, slotIndex) => ({
                canonicalId: record.canonicalId,
                record,
                placement: { kind: 'archive', slotIndex, page: 1 },
            }));

        renderStorageSlots({ container: droneTeamGrid, records: teamEntries, slotClassName: 'storage-slot storage-slot--team prairie-drone__slot prairie-drone__slot--team' });
        renderStorageSlots({ container: droneArchiveGrid, records: archiveEntries, slotClassName: 'storage-slot storage-slot--archive prairie-drone__slot prairie-drone__slot--archive' });

        const decorate = (container, mode) => {
            [...container.querySelectorAll('[data-storage-slot="true"]')].forEach((slot) => {
                const canonicalId = slot.dataset.canonicalId;
                if (!canonicalId) {
                    return;
                }
                const action = document.createElement('button');
                action.type = 'button';
                action.className = `prairie-drone__slot-action prairie-drone__slot-action--${mode === 'team' ? 'withdraw' : 'deploy'}`;
                action.dataset.prairieSlotAction = mode === 'team' ? 'withdraw' : 'deploy';
                action.innerHTML = mode === 'team'
    ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    : '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5.5 4,8 8.5,2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                action.setAttribute('aria-label', mode === 'team' ? t('prairie.remove_slime_aria') : t('prairie.deploy_slime_aria'));
                if (mode === 'archive' && activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE) {
                    action.disabled = true;
                    action.dataset.prairieSlotAction = 'blocked';
                    action.classList.add('is-blocked');
                }
                slot.appendChild(action);
            });
        };

        decorate(droneTeamGrid, 'team');
        decorate(droneArchiveGrid, 'archive');

        if (droneCap) {
            droneCap.textContent = String(activeCanonicalIds.length); const capPill = root?.querySelector('[data-prairie-cap-pill]'); if (capPill) capPill.textContent = activeCanonicalIds.length > 0 ? String(activeCanonicalIds.length) : '·';
        }
        if (droneArchiveHint) {
            droneArchiveHint.textContent = activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE ? 'MAX' : '';
        }
        if (emptyState) {
            emptyState.hidden = records.length > 0;
        }
    }

    function hitTestSlime(worldPoint) {
        let best = null;
        let bestDistance = Infinity;
        for (const entry of getActiveEntries()) {
            const slime = entry.slime;
            // Gaseous instable: untouchable when not grounded (must be stored to be affected)
            if (slime.genome?.isInstable
                && slime.genome.instabilityMass === 'gaseous'
                && !slime._instableGrounded) continue;
            for (const node of slime.nodes || []) {
                const distance = Math.hypot(node.x - worldPoint.x, node.y - worldPoint.y);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = entry;
                }
            }
        }
        if (!best) {
            return null;
        }
        return bestDistance <= best.slime.baseRadius * 1.45 ? best : null;
    }

    function applyEdgeScroll(clientX, clientY) {
        if (!viewport) {
            return;
        }
        const rect = viewportEdgeRect || viewport.getBoundingClientRect();
        let deltaX = 0;
        let deltaY = 0;
        if (clientX < rect.left + EDGE_SCROLL_ZONE) {
            deltaX = -((rect.left + EDGE_SCROLL_ZONE - clientX) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
        } else if (clientX > rect.right - EDGE_SCROLL_ZONE) {
            deltaX = ((clientX - (rect.right - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
        }
        if (clientY < rect.top + EDGE_SCROLL_ZONE) {
            deltaY = -((rect.top + EDGE_SCROLL_ZONE - clientY) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
        } else if (clientY > rect.bottom - EDGE_SCROLL_ZONE) {
            deltaY = ((clientY - (rect.bottom - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_SPEED;
        }
        if (deltaX || deltaY) {
            camera.x += deltaX / camera.zoom;
            camera.y += deltaY / camera.zoom;
            clampCamera();
        }
    }

    function updateZoom(nextZoom, anchorClientX, anchorClientY) {
        if (!viewport || !canvas) {
            return;
        }
        const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        const before = screenToWorld(anchorClientX, anchorClientY);
        camera.zoom = zoom;
        clampCamera();
        const after = screenToWorld(anchorClientX, anchorClientY);
        if (before && after) {
            camera.x += before.x - after.x;
            camera.y += before.y - after.y;
            clampCamera();
        }
    }

    function softlyKeepSlimeNearPrairie(slime) {
        if (!slime) {
            return;
        }
        const looseLeft = world.left - OUT_OF_BOUNDS_SOFT_TOLERANCE;
        const looseRight = world.right + OUT_OF_BOUNDS_SOFT_TOLERANCE;
        const looseTop = world.top - OUT_OF_BOUNDS_SOFT_TOLERANCE;
        const looseBottom = world.bottom + OUT_OF_BOUNDS_SOFT_TOLERANCE;
        for (const node of slime.nodes || []) {
            if (node.x < looseLeft) {
                node.x = looseLeft;
                node.oldX = Math.min(node.oldX, node.x);
            } else if (node.x > looseRight) {
                node.x = looseRight;
                node.oldX = Math.max(node.oldX, node.x);
            }
            if (node.y < looseTop) {
                node.y = looseTop;
                node.oldY = Math.min(node.oldY, node.y);
            } else if (node.y > looseBottom) {
                node.y = looseBottom;
                node.oldY = Math.max(node.oldY, node.y);
            }
        }
    }

    function isSlimeOutOfPrairieBounds(slime) {
        if (!slime || slime.draggedNode) {
            return false;
        }
        const center = slime.getVisualCenter?.() || slime.getRawVisualCenter?.();
        if (!center) {
            return false;
        }
        const radius = Math.max(28, getSlimeRadius(slime, center));
        const hardMargin = Math.max(OUT_OF_BOUNDS_HARD_TOLERANCE, radius * 2.1);
        const centerFarOutside = (
            center.x < world.left - hardMargin
            || center.x > world.right + hardMargin
            || center.y < world.top - hardMargin
            || center.y > world.bottom + hardMargin
        );
        if (!centerFarOutside) {
            return false;
        }
        const nodes = Array.isArray(slime.nodes) ? slime.nodes : [];
        if (!nodes.length) {
            return false;
        }
        const escapeMargin = Math.max(OUT_OF_BOUNDS_SOFT_TOLERANCE * 1.5, radius * 0.9);
        const allOutsideExpandedBounds = nodes.every((node) => (
            node.x < world.left - escapeMargin
            || node.x > world.right + escapeMargin
            || node.y < world.top - escapeMargin
            || node.y > world.bottom + escapeMargin
        ));
        const invalidNodeDetected = nodes.some((node) => !Number.isFinite(node.x) || !Number.isFinite(node.y));
        return allOutsideExpandedBounds || invalidNodeDetected;
    }

    // ── Observation Panel Logic ─────────────────────────────────────────────

    const BEHAVIOR_LABELS = {
        approach:     t('behavior.approach'),
        observe:      t('behavior.observe'),
        follow:       t('behavior.follow'),
        orbit:        t('behavior.orbit'),
        bond:         t('behavior.bond'),
        romance:      t('behavior.romance'),
        investigate:  t('behavior.investigate'),
        challenge:    t('behavior.challenge'),
        intimidate:   t('behavior.intimidate'),
        flee:         t('behavior.flee'),
        recoil:       t('behavior.recoil'),
        calm:         t('behavior.calm'),
        wander:       t('behavior.wander'),
        idle_look:    t('behavior.idle_look'),
        explore_jump: t('behavior.explore_jump'),
        sniff_object: t('behavior.sniff_object'),
        play_ball:    t('behavior.play_ball'),
        sit_stump:    t('behavior.sit_stump'),
        flee_short:   t('behavior.flee_short'),
        fight_clash:  t('behavior.fight_clash'),
        fight_won:    t('behavior.fight_won'),
        fight_lost:   t('behavior.fight_lost'),
        seek_food:    t('behavior.seek_food'),
        eat_berry:    t('behavior.eat_berry'),
        hunt_bird:    t('behavior.hunt_bird'),
        communicate:  t('behavior.communicate'),
        falcon_dive:  t('behavior.falcon_dive'),
    };

    const STAT_LABELS = {
        curiosity: `🔍 ${t('stat.curiosity')}`,
        empathy:   `💚 ${t('stat.empathy')}`,
        ferocity:  `🔥 ${t('stat.ferocity')}`,
        stability: `🧘 ${t('stat.stability')}`,
        vitality:  `💪 ${t('stat.vitality')}`,
        agility:   `⚡ ${t('stat.agility')}`,
    };

    function openObsPanel() {
        if (!obsPanel) return;
        obsPanel.hidden = false;
        obsOpen = true;
        requestAnimationFrame(() => obsPanel.classList.add('is-open'));
        applyObsLayout();
        updateObsContent();
        clearInterval(obsUpdateInterval);
        obsUpdateInterval = setInterval(updateObsContent, 500);
    }

    function closeObsPanel() {
        if (!obsPanel) return;
        obsPanel.classList.remove('is-open');
        obsOpen = false;
        obsLoupeMode = false;
        loupeBtn?.classList.remove('is-active');
        clearInterval(obsUpdateInterval);
        setTimeout(() => { if (!obsOpen && obsPanel) obsPanel.hidden = true; }, 200);
    }

    function selectSlimeForObs(canonicalId) {
        obsSelectedSlimeId = canonicalId;
        obsLoupeMode = false;
        loupeBtn?.classList.remove('is-active');
        const entry = runtimeById.get(canonicalId);
        const record = findRecordById(canonicalId);
        const name = record?.identity?.name || record?.canonicalSnapshot?.identity?.name || 'Inkübus';
        if (obsTitle) obsTitle.textContent = name;
        if (obsHint) obsHint.hidden = true;
        if (obsBody) obsBody.style.display = '';
        if (!obsOpen) openObsPanel();
        updateObsContent();
    }

    function applyObsLayout() {
        if (!obsPanel || !obsPos) return;
        const vp = getViewportSize();
        obsPos.width  = clamp(obsPos.width,  200, vp.width  - 10);
        obsPos.height = clamp(obsPos.height, 140, vp.height - 50);
        obsPos.top    = clamp(obsPos.top,      0, vp.height - obsPos.height - 10);
        obsPos.left   = clamp(obsPos.left,     0, vp.width  - obsPos.width  - 4);
        obsPanel.style.setProperty('--obs-top',   `${obsPos.top}px`);
        obsPanel.style.setProperty('--obs-left',  `${obsPos.left}px`);
        obsPanel.style.setProperty('--obs-bot',   'auto');
        obsPanel.style.setProperty('--obs-right', 'auto');
        obsPanel.style.setProperty('--obs-w',     `${obsPos.width}px`);
        obsPanel.style.setProperty('--obs-h',     `${obsPos.height}px`);
        obsPanel.style.setProperty('--obs-maxh',  'none');
    }

    function initObsPos() {
        if (obsPos || !obsPanel) return;
        const r = obsPanel.getBoundingClientRect();
        obsPos = { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function updateObsContent() {
        if (!obsOpen || !obsSelectedSlimeId) return;
        const entry = runtimeById.get(obsSelectedSlimeId);
        if (!entry) return;
        const brain = entry.slime._prairieBrain;
        if (!brain) return;

        if (obsActiveTab === 'log') {
            renderLogPage(brain, entry);
        } else if (obsActiveTab === 'journal') {
            renderJournalPage(brain, entry);
        } else {
            renderStatsPage(brain, entry);
        }
    }

    function renderLogPage(brain, entry) {
        if (!obsPageLog) return;
        const log = brain.interactionLog;
        if (!log.length) {
            obsPageLog.innerHTML = `<p class="prairie-obs__empty-msg">${t('prairie.no_interaction')}</p>`;
            return;
        }
        // Show latest first, max 20
        const items = log.slice(-20).reverse();
        let html = '';
        for (const ev of items) {
            const label = BEHAVIOR_LABELS[ev.type] || ev.type;
            const ago = formatTimeAgo(ev.time);
            const detail = ev.detail ? `<span class="prairie-obs__detail">${ev.detail}</span>` : '';
            let targetStr = '';
            if (ev.targetId) {
                const tRecord = findRecordById(ev.targetId);
                const tName = tRecord?.identity?.name || tRecord?.canonicalSnapshot?.identity?.name || '';
                if (tName) targetStr = `<span class="prairie-obs__target">→ ${tName}</span>`;
            }
            html += `<div class="prairie-obs__log-item"><span class="prairie-obs__log-label">${label}</span>${targetStr}${detail}<span class="prairie-obs__log-time">${ago}</span></div>`;
        }
        obsPageLog.innerHTML = html;
    }

    function renderStatsPage(brain, entry) {
        if (!obsPageStats) return;
        const stats = entry.slime.stats;
        const changes = brain.statChangeLog;
        const now = Date.now();

        let html = '';

        // ── Temporary stat-change toasts (last 5s) ──
        const fresh = changes.filter(c => now - c.time < 5000);
        if (fresh.length) {
            html += '<div class="prairie-obs__toasts">';
            for (const c of fresh.slice(-5).reverse()) {
                const diff = c.newVal - c.oldVal;
                const age  = now - c.time;
                const opacity = age < 2000 ? 1 : Math.max(0, 1 - (age - 2000) / 3000);
                const sign = diff > 0 ? '+' : '';
                const cls  = diff > 0 ? 'prairie-obs__toast--up' : 'prairie-obs__toast--down';
                const statLabel = (STAT_LABELS[c.stat] || c.stat).replace(/^\S+\s/, ''); // strip leading emoji
                html += `<div class="prairie-obs__toast ${cls}" style="opacity:${opacity.toFixed(2)}">${sign}${diff.toFixed(1)} ${statLabel}</div>`;
            }
            html += '</div>';
        }

        // ── Stats bars (no inline change lists) ──
        html += '<div class="prairie-obs__stats-grid">';
        for (const [key, label] of Object.entries(STAT_LABELS)) {
            const val = stats?.[key];
            if (val === undefined) continue;
            const pct = clamp(val, 0, 100);
            html += `<div class="prairie-obs__stat-row">
                <div class="prairie-obs__stat-head"><span class="prairie-obs__stat-label">${label}</span><span class="prairie-obs__stat-val">${Math.round(pct)}</span></div>
                <div class="prairie-obs__stat-bar"><div class="prairie-obs__stat-fill" style="width:${pct}%"></div></div>
            </div>`;
        }
        html += '</div>';

        // ── Hunger bar ──
        const hunger = Math.round(brain.hunger ?? 0);
        const hungerColor = hunger > 70 ? '#e05050' : hunger > 40 ? '#d08030' : '#50b070';
        const hungerLabel = hunger > 80 ? t('hunger.starving') : hunger > 55 ? t('hunger.hungry') : hunger > 30 ? t('hunger.peckish') : t('hunger.satisfied');
        html += `<div class="prairie-obs__stat-row" style="margin-top:0.3rem">
            <div class="prairie-obs__stat-head"><span class="prairie-obs__stat-label">${t('prairie.obs.hunger_label')}</span><span class="prairie-obs__stat-val">${hunger}</span></div>
            <div class="prairie-obs__stat-bar"><div class="prairie-obs__stat-fill" style="width:${hunger}%;background:${hungerColor}"></div></div>
        </div>
        <div style="font-size:0.48rem;color:rgba(180,200,195,0.5);margin-bottom:0.3rem;padding-left:2px">${hungerLabel}</div>`;

        // ── Current behavior ──
        const bLabel = BEHAVIOR_LABELS[brain.behavior] || brain.behavior;
        html += `<div class="prairie-obs__current">${t('prairie.obs.behavior_label')} : <strong>${bLabel}</strong></div>`;

        // ── Temperament archetype ──
        const prog = entry.slime.livingState?.progressionLedger;
        const temperament = prog?.temperament;
        if (temperament && temperament !== 'neutral') {
            const TEMP_ICONS = { combatant: '⚔️', fearful: '😨', resilient: '🛡️', pacifist: '☮️' };
            const wins   = prog?.combatWins   || 0;
            const losses = prog?.combatLosses || 0;
            const combatStr = (wins > 0 || losses > 0) ? ` · ${wins}V/${losses}D` : '';
            const tempLabel = t(`temperament.${temperament}`) || temperament;
            html += `<div class="prairie-obs__current" style="opacity:0.82;font-size:0.88em">${TEMP_ICONS[temperament] || '•'} ${t('prairie.obs.temperament_label')} : <strong>${tempLabel}</strong>${combatStr}</div>`;
        }

        // ── Canonical relationships (persisted across sessions) ──
        const relLedger = entry.slime.livingState?.relationshipLedger;
        if (relLedger && Object.keys(relLedger.affinities || {}).length > 0) {
            const REL_TYPE_ICONS = { lover: '💕', friend: '💚', friendly: '🙂', neutral: '😐', hostile: '😠', rival: '⚔️', combat_partner: '🥊' };
            html += `<div class="prairie-obs__bias-title">${t('prairie.obs.relations_title')}</div>`;
            for (const [tid, rel] of Object.entries(relLedger.affinities)) {
                // Resolve display name — fall back to live record lookup if missing
                let name = rel.displayName;
                if (!name) {
                    const rec = findRecordById(tid);
                    name = rec?.identity?.name || rec?.canonicalSnapshot?.identity?.name || '';
                }
                if (!name) continue; // skip genuinely unknown entries
                const icon     = REL_TYPE_ICONS[rel.type] || '😐';
                const typeFr   = t(`relation.${rel.type}`) || rel.type || t('relation.neutral');
                const biasColor = rel.bias > 0 ? 'rgba(80,220,120,0.8)' : rel.bias < 0 ? 'rgba(220,80,80,0.8)' : 'rgba(180,180,180,0.7)';
                html += `<div class="prairie-obs__bias-row"><span>${icon} ${name}</span><span style="color:${biasColor}">${typeFr}</span></div>`;
                const lastEv = rel.significantEvents?.[rel.significantEvents.length - 1];
                if (lastEv) {
                    html += `<div class="prairie-obs__stat-change" style="font-style:italic;opacity:0.7;padding-left:8px"><span>${lastEv.note}</span></div>`;
                }
            }
        }

        obsPageStats.innerHTML = html;
    }

    // ── generateLog : traduit l'état interne du slime en phrases naturelles ──
    // prairieObjects is captured from the enclosing scope (closure).
    function generateLog(brain, slime) {
        const lines = [];
        const genome = slime?.genome || {};
        const diet = genome.dietType || 'omnivore';
        const laziness = genome.laziness ?? 0.5;
        const hunger = brain.hunger ?? 0;
        const em = brain.emotionalState || { happiness: 0.5, fear: 0 };
        const objMem = slime?.livingState?.objectMemoryLedger || {};
        const relLedger = slime?.livingState?.relationshipLedger;

        // ── Faim ──────────────────────────────────────────────────────────────
        if (hunger > 80) {
            lines.push(t('journal.hunger.starving'));
        } else if (hunger > 55) {
            lines.push(t('journal.hunger.hungry'));
        } else if (hunger > 30) {
            lines.push(t('journal.hunger.peckish'));
        } else {
            lines.push(t('journal.hunger.satisfied'));
        }

        // ── Objet de nourriture le plus proche dans la mémoire avec souvenir ─
        const nearbyObjects = prairieObjects.filter(o =>
            (o.type === 'berry_bush' || o.type === 'bird') && o.interactive !== false
        );
        for (const obj of nearbyObjects) {
            let memKey = null;
            if (obj.type === 'berry_bush') memKey = `berry_${obj.berryType || 'red'}`;
            else if (obj.type === 'bird')  memKey = 'bird_meat';
            if (!memKey) continue;
            const mem = objMem[memKey];
            if (!mem) continue;
            const pp = mem.pleasurePain;
            if (pp <= -0.3 && hunger > 40) {
                if (obj.type === 'berry_bush') {
                    lines.push(t('journal.memory.bad_berries').replace('{type}', obj.berryType || ''));
                } else {
                    lines.push(t('journal.memory.bad_bird'));
                }
            } else if (pp >= 0.3 && hunger > 30) {
                if (obj.type === 'berry_bush') {
                    lines.push(t('journal.memory.good_berries'));
                } else {
                    lines.push(t('journal.memory.good_bird'));
                }
            }
        }

        // ── Régime alimentaire ────────────────────────────────────────────────
        lines.push(t(`journal.diet.${diet}`) || t('journal.diet.omnivore'));

        // ── Paresse ───────────────────────────────────────────────────────────
        if (laziness > 0.75) {
            lines.push(t('journal.laziness.high'));
        } else if (laziness < 0.25) {
            lines.push(t('journal.laziness.low'));
        }

        // ── Comportement actuel ───────────────────────────────────────────────
        const bLabel = BEHAVIOR_LABELS[brain.behavior] || brain.behavior;
        lines.push(t('journal.behavior.current').replace('{behavior}', bLabel));

        // ── État émotionnel ───────────────────────────────────────────────────
        if (em.fear > 0.5) {
            lines.push(t('journal.emotion.fear'));
        } else if (em.happiness > 0.75) {
            lines.push(t('journal.emotion.happy'));
        } else if (em.happiness < 0.3) {
            lines.push(t('journal.emotion.lonely'));
        }

        // ── Relations ─────────────────────────────────────────────────────────
        if (relLedger) {
            const friends = Object.values(relLedger.affinities || {}).filter(r => r.type === 'friend' || r.type === 'lover');
            const rivals  = Object.values(relLedger.affinities || {}).filter(r => r.type === 'rival' || r.type === 'hostile');
            if (friends.length > 0) {
                lines.push(t('journal.relation.friend').replace('{name}', friends[0].displayName));
            }
            if (rivals.length > 0) {
                lines.push(t('journal.relation.rival').replace('{name}', rivals[0].displayName));
            }
        }

        // Max 6 lignes pour ne pas surcharger
        return lines.slice(0, 6);
    }

    function renderJournalPage(brain, entry) {
        if (!obsPageJournal) return;
        const slime = entry?.slime;
        if (!slime) {
            obsPageJournal.innerHTML = `<p class="prairie-obs__empty-msg">${t('prairie.obs.no_slime')}</p>`;
            return;
        }
        const thoughts = generateLog(brain, slime);
        let html = '<div class="prairie-obs__journal">';
        for (const line of thoughts) {
            html += `<p class="prairie-obs__journal-line">💭 ${line}</p>`;
        }
        // Show hunger bar
        const hunger = Math.round(brain.hunger ?? 0);
        const hungerColor = hunger > 70 ? '#e05050' : hunger > 40 ? '#e09030' : '#50b070';
        html += `<div class="prairie-obs__journal-hunger">
            <span>${t('prairie.obs.journal_hunger')}</span>
            <div class="prairie-obs__stat-bar" style="flex:1;margin-left:6px">
                <div class="prairie-obs__stat-fill" style="width:${hunger}%;background:${hungerColor}"></div>
            </div>
            <span style="margin-left:4px;font-size:0.85em">${hunger}/100</span>
        </div>`;
        // Diet badge
        const dietEmoji = { herbivore: '🌿', carnivore: '🥩', omnivore: '🍽️' };
        const diet = slime.genome?.dietType || 'omnivore';
        html += `<div class="prairie-obs__journal-badge">${dietEmoji[diet] || '🍽️'} ${t(`diet.${diet}`) || diet}</div>`;
        html += '</div>';
        obsPageJournal.innerHTML = html;
    }

    function formatTimeAgo(timestamp) {
        const sec = Math.round((Date.now() - timestamp) / 1000);
        if (sec < 5) return t('time.just_now');
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        return `${min}m`;
    }

    function bindObsInteractions() {
        if (!loupeBtn || !obsPanel) return;

        loupeBtn.addEventListener('click', () => {
            if (obsOpen && !obsLoupeMode) {
                closeObsPanel();
                return;
            }
            if (obsLoupeMode) {
                obsLoupeMode = false;
                loupeBtn.classList.remove('is-active');
                return;
            }
            obsLoupeMode = true;
            loupeBtn.classList.add('is-active');
            if (!obsOpen) {
                openObsPanel();
                if (obsHint) obsHint.hidden = false;
                if (obsBody) obsBody.style.display = 'none';
            }
        });

        obsClose?.addEventListener('click', closeObsPanel);

        // ── Drag (header) ──
        obsDragHandle?.addEventListener('pointerdown', (e) => {
            if (e.target.closest('[data-prairie-obs-close]') || e.target.closest('[data-prairie-obs-tab]')) return;
            initObsPos();
            obsDrag = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, pt: obsPos.top, pl: obsPos.left };
            obsDragHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
        }, { passive: false });
        obsDragHandle?.addEventListener('pointermove', (e) => {
            if (!obsDrag || obsDrag.pid !== e.pointerId) return;
            obsPos.top  = obsDrag.pt + (e.clientY - obsDrag.sy);
            obsPos.left = obsDrag.pl + (e.clientX - obsDrag.sx);
            applyObsLayout();
        }, { passive: true });
        const releaseObsDrag = (e) => {
            if (!obsDrag || obsDrag.pid !== e.pointerId) return;
            obsDragHandle.releasePointerCapture(e.pointerId);
            obsDrag = null;
        };
        obsDragHandle?.addEventListener('pointerup', releaseObsDrag, { passive: true });
        obsDragHandle?.addEventListener('pointercancel', releaseObsDrag, { passive: true });

        // ── 4-corner resize ──
        for (const corner of (obsPanel?.querySelectorAll('[data-corner]') || [])) {
            corner.addEventListener('pointerdown', (e) => {
                initObsPos();
                obsResize = {
                    pid: e.pointerId, sx: e.clientX, sy: e.clientY,
                    pw: obsPos.width, ph: obsPos.height, pt: obsPos.top, pl: obsPos.left,
                    corner: corner.dataset.corner,
                };
                corner.setPointerCapture(e.pointerId);
                e.preventDefault(); e.stopPropagation();
            }, { passive: false });
            corner.addEventListener('pointermove', (e) => {
                if (!obsResize || obsResize.pid !== e.pointerId) return;
                const dx = e.clientX - obsResize.sx;
                const dy = e.clientY - obsResize.sy;
                const c  = obsResize.corner;
                if (c === 'br' || c === 'tr') obsPos.width  = obsResize.pw + dx;
                if (c === 'bl' || c === 'tl') { obsPos.width = obsResize.pw - dx; obsPos.left = obsResize.pl + dx; }
                if (c === 'br' || c === 'bl') obsPos.height = obsResize.ph + dy;
                if (c === 'tr' || c === 'tl') { obsPos.height = obsResize.ph - dy; obsPos.top = obsResize.pt + dy; }
                applyObsLayout();
            }, { passive: true });
            const releaseCorner = (e) => {
                if (!obsResize || obsResize.pid !== e.pointerId) return;
                corner.releasePointerCapture(e.pointerId);
                obsResize = null;
            };
            corner.addEventListener('pointerup', releaseCorner, { passive: true });
            corner.addEventListener('pointercancel', releaseCorner, { passive: true });
        }

        // Tabs
        for (const tab of obsTabs) {
            tab.addEventListener('click', () => {
                obsActiveTab = tab.dataset.prairieObsTab;
                for (const t of obsTabs) t.classList.toggle('is-active', t === tab);
                obsPageLog?.classList.toggle('is-active', obsActiveTab === 'log');
                obsPageStats?.classList.toggle('is-active', obsActiveTab === 'stats');
                obsPageJournal?.classList.toggle('is-active', obsActiveTab === 'journal');
                updateObsContent();
            });
        }

    }

    function bindInteractions() {
        if (interactionsBound || !canvas || !droneToggle || !dronePanel || !droneTeamGrid || !droneArchiveGrid || !minimapCanvas) {
            return;
        }
        interactionsBound = true;
        bindObsInteractions();

        const closeDrone = () => {
            window.clearTimeout(dronePanelCloseTimeout);
            dronePanel.classList.remove('is-open');
            droneToggle.setAttribute('aria-expanded', 'false');
            dronePanelCloseTimeout = window.setTimeout(() => {
                if (dronePanel && !dronePanel.classList.contains('is-open')) {
                    dronePanel.hidden = true;
                }
            }, 180);
        };
        const openDrone = () => {
            renderDronePanel();
            applyPanelLayout();
            window.clearTimeout(dronePanelCloseTimeout);
            dronePanel.hidden = false;
            droneToggle.setAttribute('aria-expanded', 'true');
            window.requestAnimationFrame(() => dronePanel?.classList.add('is-open'));
        };

        droneToggle.addEventListener('click', () => {
            if (dronePanel.hidden) {
                openDrone();
            } else {
                closeDrone();
            }
        });
        droneClose?.addEventListener('click', closeDrone);

        dronePanelDragHandle?.addEventListener('pointerdown', (event) => {
            if (event.target.closest('[data-prairie-drone-close]') || event.target.closest('[data-prairie-panel-resize]')) {
                return;
            }
            panelDrag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                offsetX: panelLayout?.offsetX || 0,
                offsetY: panelLayout?.offsetY || 0,
            };
            dronePanelDragHandle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        }, { passive: false });

        dronePanelDragHandle?.addEventListener('pointermove', (event) => {
            if (!panelDrag || panelDrag.pointerId !== event.pointerId) {
                return;
            }
            panelLayout = normalizePanelLayout({
                ...panelLayout,
                offsetX: panelDrag.offsetX + (event.clientX - panelDrag.startX),
                offsetY: panelDrag.offsetY + (event.clientY - panelDrag.startY),
            });
            applyPanelLayout();
        }, { passive: true });

        const releasePanelDrag = (event) => {
            if (!panelDrag || panelDrag.pointerId !== event.pointerId) {
                return;
            }
            dronePanelDragHandle?.releasePointerCapture?.(event.pointerId);
            panelDrag = null;
            saveSession({ activeCanonicalIds: [...activeCanonicalIds], camera: { ...camera }, panel: panelLayout });
        };

        dronePanelDragHandle?.addEventListener('pointerup', releasePanelDrag, { passive: true });
        dronePanelDragHandle?.addEventListener('pointercancel', releasePanelDrag, { passive: true });

        dronePanelResizeHandle?.addEventListener('pointerdown', (event) => {
            panelResize = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                width: panelLayout?.width || PANEL_MIN_WIDTH,
                height: panelLayout?.height || PANEL_MIN_HEIGHT,
            };
            dronePanelResizeHandle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        }, { passive: false });

        dronePanelResizeHandle?.addEventListener('pointermove', (event) => {
            if (!panelResize || panelResize.pointerId !== event.pointerId) {
                return;
            }
            panelLayout = normalizePanelLayout({
                ...panelLayout,
                width: panelResize.width + (event.clientX - panelResize.startX),
                height: panelResize.height + (event.clientY - panelResize.startY),
            });
            applyPanelLayout();
        }, { passive: true });

        const releasePanelResize = (event) => {
            if (!panelResize || panelResize.pointerId !== event.pointerId) {
                return;
            }
            dronePanelResizeHandle?.releasePointerCapture?.(event.pointerId);
            panelResize = null;
            saveSession({ activeCanonicalIds: [...activeCanonicalIds], camera: { ...camera }, panel: panelLayout });
        };

        dronePanelResizeHandle?.addEventListener('pointerup', releasePanelResize, { passive: true });
        dronePanelResizeHandle?.addEventListener('pointercancel', releasePanelResize, { passive: true });

        const onDroneSlotClick = (event, mode) => {
            const actionButton = event.target.closest?.('[data-prairie-slot-action]');
            if (!actionButton) {
                return;
            }
            const slot = actionButton.closest?.('[data-storage-slot="true"]');
            if (!slot) {
                return;
            }
            const canonicalId = slot.dataset.canonicalId;
            const action = actionButton.dataset.prairieSlotAction;
            if (!canonicalId || action === 'blocked') {
                return;
            }
            if (mode === 'team' && action === 'withdraw') {
                withdrawCanonicalSlime(canonicalId);
                return;
            }
            if (mode === 'archive' && action === 'deploy') {
                deployCanonicalSlime(canonicalId);
            }
        };

        droneTeamGrid.addEventListener('click', (event) => onDroneSlotClick(event, 'team'));
        droneArchiveGrid.addEventListener('click', (event) => onDroneSlotClick(event, 'archive'));

        minimapCanvas.addEventListener('pointerdown', (event) => {
            const rect = minimapCanvas.getBoundingClientRect();
            camera.x = clamp(((event.clientX - rect.left) / rect.width) * world.width, 0, world.width);
            camera.y = clamp(((event.clientY - rect.top) / rect.height) * world.height, 0, world.height);
            clampCamera();
            scheduleSessionSave('prairie_minimap_pan');
        }, { passive: true });

        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            updateZoom(camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08), event.clientX, event.clientY);
            scheduleSessionSave('prairie_zoom');
        }, { passive: false });

        canvas.addEventListener('pointerdown', (event) => {
            const point = screenToWorld(event.clientX, event.clientY);
            if (!point) {
                return;
            }
            pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
            canvas.setPointerCapture?.(event.pointerId);
            if (pointers.size === 2) {
                const [first, second] = [...pointers.values()];
                pinchAnchor = { distance: distanceBetween(first, second), zoom: camera.zoom };
                pointerMode = 'pinch';
                if (activeDrag) {
                    activeDrag.entry.slime.releaseGrab?.();
                    activeDrag = null;
                }
                return;
            }
            const hit = hitTestSlime(point);
            if (hit) {
                // Loupe mode: tap selects for observation, don't drag
                if (obsLoupeMode || obsOpen) {
                    selectSlimeForObs(hit.canonicalId);
                    return;
                }
                pointerMode = 'slime-drag';
                activeDrag = { pointerId: event.pointerId, entry: hit };
                edgeScrollPointer = { clientX: event.clientX, clientY: event.clientY };
                markEntryManipulated(hit);
                hit.slime.checkGrab?.(point.x, point.y);
                return;
            }
            pointerMode = 'pan';
            panAnchor = { clientX: event.clientX, clientY: event.clientY, cameraX: camera.x, cameraY: camera.y };
        }, { passive: true });

        canvas.addEventListener('pointermove', (event) => {
            if (!pointers.has(event.pointerId)) {
                return;
            }
            pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
            if (pointerMode === 'pinch' && pointers.size >= 2 && pinchAnchor) {
                const [first, second] = [...pointers.values()];
                const ratio = Math.max(12, distanceBetween(first, second)) / Math.max(12, pinchAnchor.distance);
                updateZoom(pinchAnchor.zoom * ratio, (first.clientX + second.clientX) * 0.5, (first.clientY + second.clientY) * 0.5);
                scheduleSessionSave('prairie_pinch');
                return;
            }
            if (pointerMode === 'slime-drag' && activeDrag?.pointerId === event.pointerId) {
                const point = screenToWorld(event.clientX, event.clientY);
                if (!point) {
                    return;
                }
                markEntryManipulated(activeDrag.entry);
                activeDrag.entry.slime.updateGrab?.(point.x, point.y);
                edgeScrollPointer = { clientX: event.clientX, clientY: event.clientY };
                applyEdgeScroll(event.clientX, event.clientY);
                return;
            }
            if (pointerMode === 'pan' && panAnchor) {
                camera.x = panAnchor.cameraX - ((event.clientX - panAnchor.clientX) / camera.zoom);
                camera.y = panAnchor.cameraY - ((event.clientY - panAnchor.clientY) / camera.zoom);
                clampCamera();
                scheduleSessionSave('prairie_pan');
            }
        }, { passive: true });

        const releasePointer = (event) => {
            pointers.delete(event.pointerId);
            canvas.releasePointerCapture?.(event.pointerId);
            if (activeDrag?.pointerId === event.pointerId) {
                markEntryManipulated(activeDrag.entry);
                activeDrag.entry.slime.releaseGrab?.();
                activeDrag = null;
                edgeScrollPointer = null;
                scheduleSessionSave('prairie_drag_release');
            }
            if (pointers.size < 2) {
                pinchAnchor = null;
            }
            if (pointers.size === 0) {
                pointerMode = 'idle';
                panAnchor = null;
            }
        };

        canvas.addEventListener('pointerup', releasePointer, { passive: true });
        canvas.addEventListener('pointercancel', releasePointer, { passive: true });
        canvas.addEventListener('lostpointercapture', releasePointer, { passive: true });
    }

    // ── Prairie Objects System ─────────────────────────────────────────────
    // Procedural world objects that slimes can interact with
    let prairieObjects = [];
    let prairieObjectsSeed = 0;

    function seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function buildPrairieObjects() {
        if (!world || world.width < 100) return;
        const rng = seededRandom(42 + Math.round(world.width));
        prairieObjects = [];
        const gY = world.groundY;
        const wL = world.left + 60;
        const wR = world.right - 60;
        const wSpan = wR - wL;

        // ── Grass tufts (many, small, decorative + slight interaction) ───
        const grassCount = Math.round(wSpan / 45);
        for (let i = 0; i < grassCount; i++) {
            const x = wL + rng() * wSpan;
            const h = 8 + rng() * 18;
            const blades = 2 + Math.floor(rng() * 4);
            prairieObjects.push({
                type: 'grass', x, y: gY, height: h, blades,
                hue: 110 + rng() * 40, alpha: 0.35 + rng() * 0.3,
                sway: rng() * Math.PI * 2, swaySpeed: 0.0008 + rng() * 0.001,
                interactive: false,
            });
        }

        // ── Flowers (medium, decorative, slimes observe them) ────────────
        const flowerCount = 5 + Math.floor(rng() * 6);
        for (let i = 0; i < flowerCount; i++) {
            const x = wL + 80 + rng() * (wSpan - 160);
            prairieObjects.push({
                type: 'flower', x, y: gY,
                petalHue: rng() * 360, petalCount: 4 + Math.floor(rng() * 4),
                size: 10 + rng() * 14, stemH: 22 + rng() * 20,
                sway: rng() * Math.PI * 2, swaySpeed: 0.001 + rng() * 0.0008,
                interactive: true, interactRadius: 50,
            });
        }

        // ── Rocks (medium-large, slimes bump into / study them) ──────────
        const rockCount = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < rockCount; i++) {
            const x = wL + 100 + rng() * (wSpan - 200);
            const w = 28 + rng() * 40;
            const h = 16 + rng() * 24;
            prairieObjects.push({
                type: 'rock', x, y: gY, w, h,
                hue: 180 + rng() * 50, lightness: 22 + rng() * 15,
                roughness: rng(),
                interactive: true, interactRadius: w * 0.8,
                solid: true,
            });
        }

        // ── Small balls (throwable! slimes can push/toss them) ───────────
        const ballCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < ballCount; i++) {
            const x = wL + 120 + rng() * (wSpan - 240);
            const radius = 7 + rng() * 6;
            prairieObjects.push({
                type: 'ball', x, y: gY - radius, radius,
                vx: 0, vy: 0,
                hue: rng() * 360, saturation: 60 + rng() * 30,
                interactive: true, interactRadius: radius * 2.5,
                throwable: true, grabbed: false,
            });
        }

        // ── Mushrooms (cute, slimes investigate) ─────────────────────────
        const mushCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < mushCount; i++) {
            const x = wL + 80 + rng() * (wSpan - 160);
            prairieObjects.push({
                type: 'mushroom', x, y: gY,
                capHue: rng() > 0.5 ? (350 + rng() * 20) : (30 + rng() * 30),
                capW: 14 + rng() * 12, capH: 8 + rng() * 8,
                stemH: 10 + rng() * 12, dots: Math.floor(rng() * 5),
                interactive: true, interactRadius: 40,
            });
        }

        // ── Tree stumps (large, landmark) ────────────────────────────────
        const stumpCount = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < stumpCount; i++) {
            const x = wL + 200 + rng() * (wSpan - 400);
            prairieObjects.push({
                type: 'stump', x, y: gY,
                w: 40 + rng() * 30, h: 25 + rng() * 20,
                rings: 2 + Math.floor(rng() * 3),
                interactive: true, interactRadius: 60,
            });
        }

        // ── Puddles (flat, decorative + curiosity trigger) ───────────────
        const puddleCount = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < puddleCount; i++) {
            const x = wL + 100 + rng() * (wSpan - 200);
            prairieObjects.push({
                type: 'puddle', x, y: gY + 2,
                w: 35 + rng() * 40, h: 4 + rng() * 4,
                interactive: true, interactRadius: 45,
            });
        }

        // ── Small round bushes (3 overlapping circles, purely decorative) ─
        const bushCount = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < bushCount; i++) {
            const x = wL + 60 + rng() * (wSpan - 120);
            const r = 8 + rng() * 8;          // main ball radius 8-16
            const leafHue = 105 + rng() * 30; // green 105-135
            prairieObjects.push({
                type: 'bush', x, y: gY,
                r, leafHue,
                interactive: false,
            });
        }

        // ── Berry bushes (interactive, slimes can eat berries) ───────────────
        const BERRY_TYPES = ['red', 'blue', 'yellow'];
        const berryBushCount = 4 + Math.floor(rng() * 5);
        for (let i = 0; i < berryBushCount; i++) {
            const x = wL + 80 + rng() * (wSpan - 160);
            const berryType = BERRY_TYPES[Math.floor(rng() * BERRY_TYPES.length)];
            const maxBerries = 3 + Math.floor(rng() * 5);
            prairieObjects.push({
                type: 'berry_bush', x, y: gY,
                berryType,
                berryCount: maxBerries,
                maxBerries,
                r: 12 + rng() * 8,
                leafHue: 110 + rng() * 25,
                _lastRegrowAt: 0,
                _lastEatenAt: 0,
                interactive: true,
                interactRadius: 60,
            });
        }

        // ── Birds (small entities that land, can be hunted) ──────────────────
        const birdCount = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < birdCount; i++) {
            const x = wL + 120 + rng() * (wSpan - 240);
            prairieObjects.push({
                type: 'bird',
                x, y: gY,
                state: 'landed', // 'landing'|'landed'|'startled'|'flying'|'captured'
                vx: 0, vy: 0,
                hue: 20 + rng() * 340,
                size: 7 + rng() * 5,
                _spawnX: x,
                _nextLandAt: 0,
                _startledAt: 0,
                _capturedAt: 0,
                alertRadius: 110 + rng() * 40,
                interactive: true,
                interactRadius: 55,
            });
        }

        // ── Pebble clusters (tiny circles on ground, purely decorative) ──
        const pebbleGroupCount = 4 + Math.floor(rng() * 3);
        for (let i = 0; i < pebbleGroupCount; i++) {
            const x = wL + 40 + rng() * (wSpan - 80);
            const count = 2 + Math.floor(rng() * 3);
            const pebbles = [];
            for (let j = 0; j < count; j++) {
                pebbles.push({
                    dx: (j - count * 0.5) * (6 + rng() * 5),
                    r:  Math.max(2, 2 + rng() * 4),  // radius 2-6, always >= 2
                    hue: 170 + rng() * 60,
                    l:   28 + rng() * 18,
                });
            }
            prairieObjects.push({
                type: 'pebbles', x, y: gY,
                pebbles,
                interactive: false,
            });
        }

        // Sort by y then x for proper layering
        prairieObjects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    }

    function updatePrairieObjects() {
        const now = performance.now();
        for (const obj of prairieObjects) {
            if (obj.type === 'ball' && !obj.grabbed) {
                // Simple physics for balls
                obj.vy += 0.4; // gravity
                obj.vx *= 0.97; // friction
                obj.x += obj.vx;
                obj.y += obj.vy;
                // Ground
                const floorY = world.groundY - obj.radius;
                if (obj.y > floorY) {
                    obj.y = floorY;
                    obj.vy *= -0.35;
                    obj.vx *= 0.85;
                    if (Math.abs(obj.vy) < 0.5) obj.vy = 0;
                }
                // Walls
                if (obj.x < world.left + obj.radius) { obj.x = world.left + obj.radius; obj.vx = Math.abs(obj.vx) * 0.5; }
                if (obj.x > world.right - obj.radius) { obj.x = world.right - obj.radius; obj.vx = -Math.abs(obj.vx) * 0.5; }
            }

            // ── Berry bush: regrow berries over time ─────────────────────────
            if (obj.type === 'berry_bush' && obj.berryCount < obj.maxBerries) {
                const REGROW_INTERVAL = 30000; // 30s per berry
                if (now - obj._lastRegrowAt > REGROW_INTERVAL) {
                    obj._lastRegrowAt = now;
                    obj.berryCount = Math.min(obj.maxBerries, obj.berryCount + 1);
                }
            }

            // ── Bird AI ──────────────────────────────────────────────────────
            if (obj.type === 'bird') {
                _updateBird(obj, now);
            }
        }
    }

    // Bird AI: landing, alert detection, flying away, respawning
    function _updateBird(bird, now) {
        switch (bird.state) {
            case 'landed': {
                // Check if any carnivore/omnivore slime is too close AND moving too fast
                let startled = false;
                for (const entry of runtimeById.values()) {
                    const slime = entry.slime;
                    const diet = slime.genome?.dietType || 'omnivore';
                    if (diet === 'herbivore') continue;
                    const brain = slime._prairieBrain;
                    if (!brain) continue;
                    const sc = slime.getRawVisualCenter?.() || slime.getVisualCenter?.() || { x: 0, y: 0 };
                    const d = Math.hypot(sc.x - bird.x, sc.y - bird.y);
                    if (d < bird.alertRadius) {
                        // Startled if slime is moving fast (not hunting stealthily)
                        const movingFast = Math.abs(slime._aiSpeedMul || 0) > 0.8
                            && brain.behavior !== 'hunt_bird';
                        if (movingFast) { startled = true; break; }
                    }
                }
                if (startled) {
                    bird.state = 'startled';
                    bird._startledAt = now;
                }
                break;
            }
            case 'startled': {
                // Begin flying away
                bird.vx = (Math.random() - 0.5) * 6;
                bird.vy = -4 - Math.random() * 3;
                bird.state = 'flying';
                break;
            }
            case 'flying': {
                bird.x += bird.vx;
                bird.y += bird.vy;
                bird.vy -= 0.1; // continue rising
                bird.vx *= 0.98;
                // Once far off-screen, schedule re-landing
                if (bird.y < -200 || bird.x < world.left - 300 || bird.x > world.right + 300) {
                    bird.state = 'landing';
                    bird._nextLandAt = now + 15000 + Math.random() * 20000; // 15-35s
                    // Reset position to somewhere in the world
                    bird.x = world.left + 100 + Math.random() * (world.right - world.left - 200);
                    bird.y = world.groundY - 500; // high up
                }
                break;
            }
            case 'captured': {
                // Bird was captured — respawn after delay
                if (!bird._nextLandAt || bird._nextLandAt === 0) {
                    bird._nextLandAt = now + 20000 + Math.random() * 20000;
                }
                if (now > bird._nextLandAt) {
                    bird.x = world.left + 100 + Math.random() * (world.right - world.left - 200);
                    bird.y = world.groundY;
                    bird.vx = 0; bird.vy = 0;
                    bird.state = 'landed';
                    bird._nextLandAt = 0;
                }
                break;
            }
            case 'landing': {
                // Descend back to ground
                if (now > bird._nextLandAt) {
                    bird.y = world.groundY;
                    bird.vx = 0; bird.vy = 0;
                    bird.state = 'landed';
                }
                break;
            }
        }
    }

    function drawPrairieObjects() {
        if (!ctx) return;
        const now = performance.now();

        for (const obj of prairieObjects) {
            ctx.save();
            switch (obj.type) {
                case 'grass': {
                    const sw = Math.sin(now * obj.swaySpeed + obj.sway) * 3;
                    ctx.strokeStyle = `hsla(${obj.hue}, 55%, 38%, ${obj.alpha})`;
                    ctx.lineWidth = 1.5;
                    ctx.lineCap = 'round';
                    for (let b = 0; b < obj.blades; b++) {
                        const bx = obj.x + (b - obj.blades * 0.5) * 4;
                        const bsw = sw + Math.sin(b * 1.3) * 2;
                        ctx.beginPath();
                        ctx.moveTo(bx, obj.y);
                        ctx.quadraticCurveTo(bx + bsw * 0.6, obj.y - obj.height * 0.6, bx + bsw, obj.y - obj.height);
                        ctx.stroke();
                    }
                    break;
                }
                case 'flower': {
                    const sw = Math.sin(now * obj.swaySpeed + obj.sway) * 4;
                    const topX = obj.x + sw;
                    const topY = obj.y - obj.stemH;
                    // Stem
                    ctx.strokeStyle = 'hsla(130, 50%, 32%, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(obj.x, obj.y);
                    ctx.quadraticCurveTo(obj.x + sw * 0.4, obj.y - obj.stemH * 0.5, topX, topY);
                    ctx.stroke();
                    // Petals
                    for (let p = 0; p < obj.petalCount; p++) {
                        const a = (p / obj.petalCount) * Math.PI * 2;
                        const px = topX + Math.cos(a) * obj.size * 0.5;
                        const py = topY + Math.sin(a) * obj.size * 0.35;
                        ctx.fillStyle = `hsla(${obj.petalHue}, 70%, 65%, 0.7)`;
                        ctx.beginPath();
                        ctx.ellipse(px, py, obj.size * 0.28, obj.size * 0.18, a, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Center
                    ctx.fillStyle = `hsla(${(obj.petalHue + 40) % 360}, 80%, 70%, 0.85)`;
                    ctx.beginPath();
                    ctx.arc(topX, topY, obj.size * 0.14, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'rock': {
                    ctx.fillStyle = `hsla(${obj.hue}, 12%, ${obj.lightness}%, 0.8)`;
                    ctx.beginPath();
                    // Blobby rock shape
                    const cx = obj.x, cy = obj.y;
                    ctx.moveTo(cx - obj.w * 0.5, cy);
                    ctx.quadraticCurveTo(cx - obj.w * 0.45, cy - obj.h * (0.7 + obj.roughness * 0.3), cx, cy - obj.h);
                    ctx.quadraticCurveTo(cx + obj.w * 0.5, cy - obj.h * (0.6 + obj.roughness * 0.2), cx + obj.w * 0.5, cy);
                    ctx.closePath();
                    ctx.fill();
                    // Highlight
                    ctx.fillStyle = `hsla(${obj.hue}, 8%, ${obj.lightness + 12}%, 0.25)`;
                    ctx.beginPath();
                    ctx.ellipse(cx - obj.w * 0.1, cy - obj.h * 0.65, obj.w * 0.18, obj.h * 0.15, -0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'ball': {
                    const r = obj.radius;
                    // Shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.12)';
                    ctx.beginPath();
                    ctx.ellipse(obj.x, world.groundY + 1, r * 1.1, r * 0.25, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // Ball
                    const grad = ctx.createRadialGradient(obj.x - r * 0.3, obj.y - r * 0.3, r * 0.1, obj.x, obj.y, r);
                    grad.addColorStop(0, `hsla(${obj.hue}, ${obj.saturation}%, 72%, 0.95)`);
                    grad.addColorStop(1, `hsla(${obj.hue}, ${obj.saturation}%, 42%, 0.9)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
                    ctx.fill();
                    // Shine
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.beginPath();
                    ctx.arc(obj.x - r * 0.25, obj.y - r * 0.3, r * 0.25, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'mushroom': {
                    const mx = obj.x, my = obj.y;
                    // Stem
                    ctx.fillStyle = 'hsla(45, 20%, 82%, 0.75)';
                    ctx.fillRect(mx - 4, my - obj.stemH, 8, obj.stemH);
                    // Cap
                    ctx.fillStyle = `hsla(${obj.capHue}, 60%, 48%, 0.8)`;
                    ctx.beginPath();
                    ctx.ellipse(mx, my - obj.stemH, obj.capW * 0.5, obj.capH, 0, Math.PI, 0);
                    ctx.fill();
                    // Dots
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    for (let d = 0; d < obj.dots; d++) {
                        const da = (d / obj.dots) * Math.PI - Math.PI * 0.1;
                        const dr = obj.capW * 0.25;
                        ctx.beginPath();
                        ctx.arc(mx + Math.cos(da) * dr, my - obj.stemH - Math.sin(da) * obj.capH * 0.5, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }
                case 'bush': {
                    // Three overlapping circles for a round leafy bush
                    const bx = obj.x, by = obj.y;
                    const r = obj.r;
                    // Back-left lobe
                    ctx.fillStyle = `hsla(${obj.leafHue - 5}, 44%, 28%, 0.78)`;
                    ctx.beginPath();
                    ctx.arc(bx - r * 0.45, by - r * 0.55, r * 0.72, 0, Math.PI * 2);
                    ctx.fill();
                    // Back-right lobe
                    ctx.fillStyle = `hsla(${obj.leafHue}, 44%, 30%, 0.78)`;
                    ctx.beginPath();
                    ctx.arc(bx + r * 0.42, by - r * 0.52, r * 0.68, 0, Math.PI * 2);
                    ctx.fill();
                    // Front main lobe
                    ctx.fillStyle = `hsla(${obj.leafHue + 6}, 46%, 34%, 0.82)`;
                    ctx.beginPath();
                    ctx.arc(bx, by - r * 0.75, r, 0, Math.PI * 2);
                    ctx.fill();
                    // Highlight dot
                    ctx.fillStyle = `hsla(${obj.leafHue + 12}, 50%, 50%, 0.18)`;
                    ctx.beginPath();
                    ctx.arc(bx - r * 0.2, by - r * 1.1, r * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'pebbles': {
                    for (const p of obj.pebbles) {
                        const pr = Math.max(2, p.r);
                        ctx.fillStyle = `hsla(${p.hue}, 12%, ${p.l}%, 0.70)`;
                        ctx.beginPath();
                        ctx.arc(obj.x + p.dx, obj.y - pr * 0.4, pr, 0, Math.PI * 2);
                        ctx.fill();
                        // Tiny specular dot
                        ctx.fillStyle = `hsla(${p.hue}, 8%, ${p.l + 16}%, 0.20)`;
                        ctx.beginPath();
                        ctx.arc(obj.x + p.dx - pr * 0.3, obj.y - pr * 0.7, pr * 0.28, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }

                case 'berry_bush': {
                    const bx = obj.x, by = obj.y;
                    const r = obj.r;
                    // Empty bush is more desaturated and darker
                    const satBoost = obj.berryCount > 0 ? 1 : 0.45;
                    const litBoost = obj.berryCount > 0 ? 1 : 0.75;
                    // Bush lobes
                    ctx.fillStyle = `hsla(${obj.leafHue - 8}, ${50 * satBoost}%, ${22 * litBoost}%, 0.88)`;
                    ctx.beginPath();
                    ctx.arc(bx - r * 0.42, by - r * 0.5, r * 0.70, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = `hsla(${obj.leafHue}, ${50 * satBoost}%, ${24 * litBoost}%, 0.88)`;
                    ctx.beginPath();
                    ctx.arc(bx + r * 0.38, by - r * 0.48, r * 0.66, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = `hsla(${obj.leafHue + 8}, ${52 * satBoost}%, ${28 * litBoost}%, 0.90)`;
                    ctx.beginPath();
                    ctx.arc(bx, by - r * 0.72, r, 0, Math.PI * 2);
                    ctx.fill();
                    // Berries
                    if (obj.berryCount > 0) {
                        const BERRY_HUES = { red: 0, blue: 240, yellow: 55 };
                        const bHue = BERRY_HUES[obj.berryType] ?? 0;
                        const berryPositions = [
                            { dx: -r * 0.28, dy: -r * 0.82 }, { dx: r * 0.3,  dy: -r * 0.95 },
                            { dx: 0,          dy: -r * 1.12 }, { dx: -r * 0.5, dy: -r * 0.62 },
                            { dx: r * 0.48,   dy: -r * 0.60 }, { dx: -r * 0.12, dy: -r * 1.30 },
                            { dx: r * 0.18,   dy: -r * 1.35 },
                        ];
                        for (let bi = 0; bi < Math.min(obj.berryCount, berryPositions.length); bi++) {
                            const bp = berryPositions[bi];
                            ctx.fillStyle = `hsla(${bHue}, 70%, 48%, 0.92)`;
                            ctx.beginPath();
                            ctx.arc(bx + bp.dx, by + bp.dy, 3.5, 0, Math.PI * 2);
                            ctx.fill();
                            // Tiny shine
                            ctx.fillStyle = `hsla(${bHue}, 60%, 72%, 0.5)`;
                            ctx.beginPath();
                            ctx.arc(bx + bp.dx - 1, by + bp.dy - 1, 1.2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    break;
                }

                case 'bird': {
                    if (obj.state === 'captured' || obj.state === 'landing') break;
                    // Don't render birds that are well off-screen
                    if (obj.y < world.groundY - 800) break;
                    const bx = obj.x, by = obj.y;
                    const sz = obj.size;
                    const h = obj.hue;
                    const inFlight = obj.state === 'flying' || obj.state === 'startled';

                    ctx.save();
                    ctx.translate(bx, by);

                    if (inFlight) {
                        // Flying: wings up
                        const flap = Math.sin(now * 0.018) * 0.45;
                        // Body
                        ctx.fillStyle = `hsla(${h}, 55%, 42%, 0.90)`;
                        ctx.beginPath();
                        ctx.ellipse(0, -sz * 0.3, sz * 0.45, sz * 0.28, -0.3, 0, Math.PI * 2);
                        ctx.fill();
                        // Wings
                        ctx.fillStyle = `hsla(${h}, 48%, 36%, 0.82)`;
                        ctx.beginPath();
                        ctx.ellipse(-sz * 0.6, -sz * 0.35 - flap * sz, sz * 0.55, sz * 0.18, -0.5 - flap, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(sz * 0.6, -sz * 0.35 - flap * sz, sz * 0.55, sz * 0.18, 0.5 + flap, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Landed: small bird on ground
                        // Body
                        ctx.fillStyle = `hsla(${h}, 55%, 44%, 0.88)`;
                        ctx.beginPath();
                        ctx.ellipse(0, -sz * 0.38, sz * 0.42, sz * 0.32, 0, 0, Math.PI * 2);
                        ctx.fill();
                        // Head
                        ctx.fillStyle = `hsla(${h + 15}, 60%, 52%, 0.90)`;
                        ctx.beginPath();
                        ctx.arc(sz * 0.28, -sz * 0.68, sz * 0.22, 0, Math.PI * 2);
                        ctx.fill();
                        // Beak
                        ctx.fillStyle = `hsla(40, 70%, 60%, 0.88)`;
                        ctx.beginPath();
                        ctx.moveTo(sz * 0.48, -sz * 0.70);
                        ctx.lineTo(sz * 0.70, -sz * 0.62);
                        ctx.lineTo(sz * 0.48, -sz * 0.60);
                        ctx.closePath();
                        ctx.fill();
                        // Eye
                        ctx.fillStyle = 'rgba(0,0,0,0.7)';
                        ctx.beginPath();
                        ctx.arc(sz * 0.34, -sz * 0.72, sz * 0.06, 0, Math.PI * 2);
                        ctx.fill();
                        // Feet
                        ctx.strokeStyle = `hsla(40, 50%, 45%, 0.6)`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(-sz * 0.1, 0); ctx.lineTo(-sz * 0.1, sz * 0.1);
                        ctx.moveTo(-sz * 0.1, sz * 0.1); ctx.lineTo(-sz * 0.25, sz * 0.18);
                        ctx.moveTo(-sz * 0.1, sz * 0.1); ctx.lineTo(sz * 0.0, sz * 0.18);
                        ctx.moveTo(sz * 0.1, 0); ctx.lineTo(sz * 0.1, sz * 0.1);
                        ctx.moveTo(sz * 0.1, sz * 0.1); ctx.lineTo(-sz * 0.05, sz * 0.18);
                        ctx.moveTo(sz * 0.1, sz * 0.1); ctx.lineTo(sz * 0.22, sz * 0.18);
                        ctx.stroke();
                    }
                    ctx.restore();
                    break;
                }
                case 'stump': {
                    const sx = obj.x, sy = obj.y;
                    // Body
                    ctx.fillStyle = 'hsla(28, 35%, 28%, 0.8)';
                    ctx.beginPath();
                    ctx.moveTo(sx - obj.w * 0.5, sy);
                    ctx.lineTo(sx - obj.w * 0.42, sy - obj.h);
                    ctx.lineTo(sx + obj.w * 0.42, sy - obj.h);
                    ctx.lineTo(sx + obj.w * 0.5, sy);
                    ctx.closePath();
                    ctx.fill();
                    // Top
                    ctx.fillStyle = 'hsla(30, 28%, 35%, 0.75)';
                    ctx.beginPath();
                    ctx.ellipse(sx, sy - obj.h, obj.w * 0.42, obj.h * 0.22, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // Rings
                    ctx.strokeStyle = 'hsla(32, 22%, 25%, 0.4)';
                    ctx.lineWidth = 1;
                    for (let r = 0; r < obj.rings; r++) {
                        const rf = (r + 1) / (obj.rings + 1);
                        ctx.beginPath();
                        ctx.ellipse(sx, sy - obj.h, obj.w * 0.42 * rf, obj.h * 0.22 * rf, 0, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    break;
                }
                case 'puddle': {
                    const shimmer = 0.08 + Math.sin(now * 0.001 + obj.x * 0.01) * 0.04;
                    ctx.fillStyle = `rgba(120, 200, 220, ${shimmer})`;
                    ctx.beginPath();
                    ctx.ellipse(obj.x, obj.y, obj.w * 0.5, obj.h, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = `rgba(160, 230, 245, ${shimmer + 0.06})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                    break;
                }
            }
            ctx.restore();
        }
    }

    function getNearestInteractiveObject(worldX, worldY, maxDist = 80) {
        let best = null, bestDist = maxDist;
        for (const obj of prairieObjects) {
            if (!obj.interactive) continue;
            const d = Math.hypot(obj.x - worldX, (obj.y || world.groundY) - worldY);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
    }

    // Expose objects for the interaction engine
    function getPrairieObjects() { return prairieObjects; }

    // ── Inkübus Speech Bubble System ─────────────────────────────────────
    // Tiny speech bubbles in incomprehensible Inkübus language
    // that reflect the creature's current emotion/behavior
    const INKUBUS_VOCAB = {
        happy:    [
            'möki!', 'puu~', 'nyah♪', 'buu☆', 'kiki!', 'pyoo~', 'wah!', 'myu♡',
            'yupii!', 'pöpö~', 'nihi!', 'füü☆', 'möö möö!', 'kya kya!',
            'wuiii~', 'pipipi!', 'boing~', 'nyuu nyuu!', 'füfü♪', 'hoho~',
            'yayy!', 'möki möki!', 'puu puu~', 'tehee~', 'wiiii!',
        ],
        curious:  [
            'hm?', 'nuu?', 'eeh~', 'kö?', 'mhh..', 'öö?', 'wha~?', 'nn?',
            'hmmm~?', 'nani?', 'kökö?', 'öhö?', 'fufu?', 'waah?',
            'müü?', 'eh eh?', 'nnh?', 'oooh?', 'köh?', 'mmh mmh?',
            'nüh?', 'hhh~?', 'buhh?', 'wuuh?',
        ],
        angry:    [
            'GRR!', 'bakh!', 'TSK!', 'rrgh!', 'HMPH!', 'kha!', 'BAH!',
            'RRRH!', 'ngh NGH!', 'GRRKH!', 'bha BHA!', 'KHF!',
            'hhrrgh!', 'PFFT!', 'GRKH GRKH!', 'ngrr..', 'BAKBAK!',
            'tskkk!', 'RRRHH!', 'khaa!', 'hmph HMPH!',
        ],
        scared:   [
            'hiih!', 'kyaa!', 'eep!', 'nuu!', 'waa!', 'mmh!', 'iii!',
            'hyaa hyaa!', 'niiih!', 'wawa!', 'eeep eep!', 'hiii~',
            'yuuu!', 'kyuu kyuu!', 'nooo!', 'mmmh!', 'hiiii~!',
            'waaah!', 'eeep!', 'piiih!', 'nyaa nyaa!',
        ],
        love:     [
            'doki♡', 'muu~♡', 'kyuu♡', 'poki~', 'nyuu♡', 'fuwa~♡',
            'nyon♡', 'popo~♡', 'kyuu kyuu♡', 'mochi♡', 'doki doki♡',
            'füüh~♡', 'nyu nyu♡', 'wawa♡', 'hnnn♡', 'hehehe♡',
            'mmmm♡', 'pyuu♡', 'hoho♡', 'fufu~♡',
        ],
        thinking: [
            'mm...', 'nrr..', 'huu~', 'zzz..', 'hmm~', 'fuu..', 'nn~',
            'müü..', 'öhm..', 'nnnh~', 'buh..', 'hrrm..', 'ehhh..',
            'nnn nnn..', 'köh..', 'fmm..', 'öhö..', 'wuu..',
            'mhmm..', 'nhh..', 'hnng..',
        ],
        pain:     [
            'ow!', 'itai!', 'gah!', 'ngh!', 'ouch!', 'kuh!',
            'oww oww!', 'nghh!', 'itch!', 'augh!', 'kkhh!',
            'hnngh!', 'yowch!', 'ggkh!', 'nrgh!', 'ahhk!',
        ],
        playful:  [
            'yay!', 'wee!', 'hehe~', 'pya!', 'boing!', 'wheee!', 'yipee!',
            'pyoing!', 'yatta!', 'wiii~', 'bwee!', 'hihihi!', 'pyon pyon!',
            'nyahaha!', 'weehee!', 'boingo!', 'yippii!', 'pii pii!',
            'wheehe~', 'keke!', 'ahahah~',
        ],
        combat:   [
            'RAGH!', 'krakh!', 'YAKH!', 'HRR!', 'BRAK!', 'kuh-HA!', 'GHK!', 'SRAK!',
            'GRAKH GRAKH!', 'HYARR!', 'KRSH!', 'BAKK!', 'RRAAA!',
            'YAHHH!', 'krakrak!', 'HRRAKH!', 'NNGHH!', 'THWAK!',
            'BRKK!', 'HAAAKH!', 'RRRAH!',
        ],
        greeting: [
            'nyu~!', 'möki!', 'pöpö!', 'heyy~', 'nyaa!', 'wuuh!',
            'öhi!', 'pyuu!', 'koko!', 'mömö!', 'füfu!', 'yooh~',
            'heee~', 'nyooo!', 'pippi!', 'möh möh!',
        ],
        farewell: [
            'möki..', 'byuu~', 'nnn..', 'puu..', 'kö kö..', 'füü..',
            'nyah..', 'öhh..', 'myu~..',  'bweh..', 'hnnn..',
        ],
        // Replies — used when a slime "responds" to another's bubble
        reply_happy:   ['puu~!', 'möki möki!', 'nyu nyuu!', 'yahh!', 'mhm!', 'fufu~', 'wee!'],
        reply_curious: ['hm hm!', 'nn nn?', 'öhö?', 'wuuh?', 'nani nani?', 'köh?', 'mmh!'],
        reply_angry:   ['EEP!', 'nuu!', 'bakh!', 'HMPH!', 'grh..', 'rrgh!', 'ngrr!'],
        reply_love:    ['doki♡', 'nyon♡', 'muu♡', 'füfü♡', 'popo~♡', 'kyuu!♡'],
        reply_combat:  ['GRAKH!', 'YAKH!', 'HRR!', 'BRAK!', 'RAGH!', 'krsh!'],
    };

    // Multi-word Inkubus "sentences" for longer interactions
    const INKUBUS_SENTENCES = {
        bond:       ['möki möki puu~', 'nyu nyu köh?', 'füfu~ myu♡', 'pöpö kiki!', 'wuu wuu mhm'],
        romance:    ['doki doki puu♡', 'nyu~ möki♡', 'füfu~ nyon♡', 'muu~ kyuu♡', 'popo~ wuuh♡'],
        fight_clash:['GRAKH RAGH!', 'BAKK KRSH!', 'HRR BRAK!', 'YAKH GRAKH!', 'NNGH RRAH!'],
        challenge:  ['HMPH ngrr!', 'GRR bakh!', 'TSK HMPH!', 'rrgh RRRH!'],
        flee:       ['waa waa nuu!', 'hiih kyaa!', 'eep eep waa!', 'nuu nuu hiih!'],
        reckless_chase: ['HAAKH GRAKH!', 'RAGH RAGH!', 'RRRAH YAKH!'],
        investigate:['hm? nani?', 'öö? köh?', 'nn nn mmh?', 'wuuh? nuu?'],
        orbit:      ['nyu~? möki?', 'köh köh?', 'puu~? hm?'],
        calm:       ['mhm~ puu..', 'nnu~ füfu', 'öhö~ möki', 'huu~ nrr'],
    };

    function getEmotionForBehavior(behavior) {
        const map = {
            approach:       'curious',
            observe:        'curious',
            investigate:    'curious',
            follow:         'happy',
            orbit:          'curious',
            bond:           'love',
            romance:        'love',
            calm:           'happy',
            idle_look:      'thinking',
            challenge:      'angry',
            intimidate:     'angry',
            flee:           'scared',
            teleport_flee:  'scared',
            recoil:         'pain',
            flee_short:     'scared',
            wander:         'happy',
            explore_jump:   'playful',
            sniff_object:   'curious',
            play_ball:      'playful',
            sit_stump:      'thinking',
            fight_clash:    'combat',
            reckless_chase: 'combat',
        };
        return map[behavior] || 'thinking';
    }

    // Returns a reply emotion appropriate to the speaker's emotion
    function getReplyEmotion(speakerEmotion) {
        const map = {
            happy:   'reply_happy',
            curious: 'reply_curious',
            angry:   'reply_angry',
            combat:  'reply_combat',
            love:    'reply_love',
            scared:  'reply_happy',  // reassurance
            pain:    'reply_curious',
            playful: 'reply_happy',
            thinking:'reply_curious',
        };
        return map[speakerEmotion] || 'reply_curious';
    }

    function getEmotionColor(emotion) {
        const colors = {
            happy:         'rgba(180, 255, 210, 0.92)',
            curious:       'rgba(200, 230, 255, 0.92)',
            angry:         'rgba(255, 180, 170, 0.92)',
            scared:        'rgba(220, 200, 255, 0.92)',
            love:          'rgba(255, 200, 220, 0.92)',
            thinking:      'rgba(220, 225, 240, 0.88)',
            pain:          'rgba(255, 190, 170, 0.92)',
            playful:       'rgba(255, 240, 180, 0.92)',
            combat:        'rgba(255, 100, 80, 0.95)',
            greeting:      'rgba(180, 255, 220, 0.93)',
            farewell:      'rgba(210, 210, 240, 0.88)',
            reply_happy:   'rgba(160, 255, 200, 0.93)',
            reply_curious: 'rgba(190, 225, 255, 0.93)',
            reply_angry:   'rgba(255, 160, 150, 0.93)',
            reply_love:    'rgba(255, 185, 215, 0.93)',
            reply_combat:  'rgba(255, 80,  60, 0.97)',
        };
        return colors[emotion] || 'rgba(220, 230, 240, 0.9)';
    }

    function getEmotionBorder(emotion) {
        const colors = {
            happy:         'rgba(80,  200, 120, 0.5)',
            curious:       'rgba(100, 170, 220, 0.5)',
            angry:         'rgba(220, 80,  70,  0.5)',
            scared:        'rgba(160, 120, 220, 0.5)',
            love:          'rgba(220, 100, 140, 0.5)',
            thinking:      'rgba(140, 150, 180, 0.4)',
            pain:          'rgba(200, 90,  70,  0.5)',
            playful:       'rgba(220, 180, 60,  0.5)',
            combat:        'rgba(200, 40,  20,  0.7)',
            greeting:      'rgba(60,  200, 130, 0.55)',
            farewell:      'rgba(130, 130, 180, 0.4)',
            reply_happy:   'rgba(60,  190, 110, 0.55)',
            reply_curious: 'rgba(80,  155, 210, 0.55)',
            reply_angry:   'rgba(210, 60,  50,  0.6)',
            reply_love:    'rgba(210, 80,  130, 0.6)',
            reply_combat:  'rgba(190, 20,  10,  0.8)',
        };
        return colors[emotion] || 'rgba(150, 160, 180, 0.4)';
    }

    // Active bubbles: { slimeId, text, emotion, startedAt, duration, x, y }
    let activeBubbles = [];

    function spawnBubble(canonicalId, text, emotion, now, yOffset) {
        const entry = runtimeById.get(canonicalId);
        if (!entry) return;
        const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
        if (!center) return;
        activeBubbles = activeBubbles.filter(b => b.slimeId !== canonicalId);
        const duration = 1600 + text.length * 55 + Math.random() * 600;
        activeBubbles.push({
            slimeId: canonicalId,
            text, emotion, duration,
            startedAt: now,
            x: center.x,
            y: center.y - entry.slime.baseRadius * (yOffset || 1.6),
        });
    }

    function maybeSpawnBubble(entry, now) {
        const brain = entry.slime._prairieBrain;
        if (!brain) return;

        // ── Forced pending bubble (post-fight, teleport, etc.) ──
        if (brain._pendingBubble) {
            const { emotion } = brain._pendingBubble;
            brain._pendingBubble = null;
            const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.thinking;
            const text = vocab[Math.floor(Math.random() * vocab.length)];
            spawnBubble(entry.canonicalId, text, emotion, now);
            // Trigger reply from target if close
            if (brain.targetId) {
                const targetEntry = runtimeById.get(brain.targetId);
                if (targetEntry) {
                    const tb = targetEntry.slime._prairieBrain;
                    if (tb && !tb._pendingReply) {
                        const replyEmo = getReplyEmotion(emotion);
                        tb._pendingReply = { emotion: replyEmo, at: now + 500 + Math.random() * 700 };
                    }
                }
            }
            return;
        }

        // ── Pending reply (response to another slime's bubble) ──
        if (brain._pendingReply && now >= brain._pendingReply.at) {
            const { emotion } = brain._pendingReply;
            brain._pendingReply = null;
            const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.reply_curious;
            const text = vocab[Math.floor(Math.random() * vocab.length)];
            spawnBubble(entry.canonicalId, text, emotion, now);
            return;
        }

        // ── Cooldown: min gap depends on behavior intensity ──
        const behavior = brain.behavior;
        const existing = activeBubbles.find(b => b.slimeId === entry.canonicalId);
        const GAPS = {
            fight_clash:    600,
            reckless_chase: 700,
            challenge:      900,
            flee:           800,
            teleport_flee:  700,
            bond:           1200,
            romance:        1400,
            approach:       1600,
            orbit:          1800,
            follow:         1600,
            investigate:    1500,
            calm:           2000,
            wander:         4000,
            idle_look:      5000,
            sit_stump:      6000,
        };
        const minGap = GAPS[behavior] ?? 2000;
        if (existing && now < existing.startedAt + minGap) return;

        // ── Spawn probability per tick ──
        const RATES = {
            fight_clash:    0.22,
            reckless_chase: 0.18,
            challenge:      0.10,
            flee:           0.09,
            teleport_flee:  0.15,
            bond:           0.07,
            romance:        0.06,
            approach:       0.05,
            orbit:          0.04,
            follow:         0.04,
            investigate:    0.05,
            intimidate:     0.06,
            calm:           0.04,
            explore_jump:   0.03,
            play_ball:      0.04,
            sniff_object:   0.04,
            recoil:         0.12,
            wander:         0.003,
            idle_look:      0.001,
            sit_stump:      0.001,
        };
        const rate = RATES[behavior] ?? 0.025;
        if (Math.random() > rate) return;

        // ── Pick text: sentence (20%) or word ──
        const emotion = getEmotionForBehavior(behavior);
        let text;
        const sentences = INKUBUS_SENTENCES[behavior];
        if (sentences && Math.random() < 0.22) {
            text = sentences[Math.floor(Math.random() * sentences.length)];
        } else {
            const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.thinking;
            text = vocab[Math.floor(Math.random() * vocab.length)];
        }

        spawnBubble(entry.canonicalId, text, emotion, now);

        // ── Trigger conversational reply from the social target ──
        if (brain.targetId) {
            const socialBehaviors = ['approach','observe','follow','orbit','bond','romance','investigate','calm','challenge','intimidate'];
            if (socialBehaviors.includes(behavior)) {
                const targetEntry = runtimeById.get(brain.targetId);
                if (targetEntry) {
                    const tb = targetEntry.slime._prairieBrain;
                    if (tb && !tb._pendingReply && !tb._pendingBubble) {
                        const replyEmo = getReplyEmotion(emotion);
                        tb._pendingReply = { emotion: replyEmo, at: now + 400 + Math.random() * 900 };
                    }
                }
            }
        }
    }

    function drawSpeechBubbles() {
        if (!ctx) return;
        const now = performance.now();

        activeBubbles = activeBubbles.filter(b => now < b.startedAt + b.duration);

        for (const b of activeBubbles) {
            // Track slime position live
            const entry = runtimeById.get(activeCanonicalIds.find(id => {
                const e = runtimeById.get(id);
                return e && e.canonicalId === b.slimeId;
            }));
            if (entry) {
                const c = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
                if (c) {
                    b.x = c.x;
                    b.y = c.y - entry.slime.baseRadius * 1.7;
                }
            }

            const age      = now - b.startedAt;
            // Pop-in: fast scale from 0 → 1.12 → 1 in first 220ms
            const popT     = Math.min(1, age / 220);
            const popScale = popT < 0.7
                ? 0.5 + popT / 0.7 * 0.65
                : 1.15 - (popT - 0.7) / 0.3 * 0.15;
            const fadeIn   = Math.min(1, age / 120);
            const fadeOut  = Math.min(1, (b.duration - age) / 280);
            const alpha    = fadeIn * fadeOut;
            if (alpha < 0.01) continue;

            // Float up gently
            const floatY = b.y - age * 0.006;

            // Font size: combat/angry bigger, love/thinking smaller
            const bigEmotions   = new Set(['combat','angry','reply_combat','reply_angry']);
            const smallEmotions = new Set(['thinking','farewell','reply_curious']);
            const fontSize = bigEmotions.has(b.emotion) ? 11 : smallEmotions.has(b.emotion) ? 9 : 10;
            const fontWeight = bigEmotions.has(b.emotion) ? '900' : 'bold';

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(b.x, floatY);
            ctx.scale(popScale, popScale);
            ctx.translate(-b.x, -floatY);

            ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
            const metrics = ctx.measureText(b.text);
            const tw  = metrics.width;
            const pad = 6;
            const bw  = tw + pad * 2;
            const bh  = fontSize + 8;
            const bx  = b.x - bw / 2;
            const by  = floatY - bh / 2;
            const r   = 7;

            // Shadow for depth
            ctx.shadowColor   = 'rgba(0,0,0,0.18)';
            ctx.shadowBlur    = 4;
            ctx.shadowOffsetY = 2;

            // Bubble background
            ctx.fillStyle   = getEmotionColor(b.emotion);
            ctx.strokeStyle = getEmotionBorder(b.emotion);
            ctx.lineWidth   = bigEmotions.has(b.emotion) ? 1.5 : 1;

            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.lineTo(bx + bw - r, by);
            ctx.quadraticCurveTo(bx + bw, by,      bx + bw, by + r);
            ctx.lineTo(bx + bw, by + bh - r);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
            // Tail pointing down toward slime
            ctx.lineTo(b.x + 5, by + bh);
            ctx.lineTo(b.x,     by + bh + 6);
            ctx.lineTo(b.x - 4, by + bh);
            ctx.lineTo(bx + r,  by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
            ctx.lineTo(bx, by + r);
            ctx.quadraticCurveTo(bx, by, bx + r, by);
            ctx.closePath();
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.stroke();

            // Text — darker for combat/angry, softer for love
            const loveEmotions = new Set(['love','reply_love','greeting']);
            ctx.fillStyle = bigEmotions.has(b.emotion)
                ? 'rgba(90, 10, 10, 0.95)'
                : loveEmotions.has(b.emotion)
                    ? 'rgba(140, 30, 80, 0.9)'
                    : 'rgba(25, 25, 40, 0.88)';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.text, b.x, floatY);

            ctx.restore();
        }
    }

    function drawFrame() {
        if (!canvas || !ctx) {
            return;
        }
        // Re-assert our canvas as the global context each frame.
        // Another SlimeEngine (incubator) keeps a window 'resize' listener that
        // calls setCanvas() even while suspended, overwriting ctx with its own
        // canvas. Re-asserting here is free (getContext returns a cached object)
        // and guarantees slime.draw() always targets the prairie canvas.
        ensureCanvasRuntime();
        const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
        // Scale by DPR so that world units (CSS pixels) map correctly to device pixels.
        const dpr = Math.min(window.devicePixelRatio || 1, getPerfSettings().dprCap);
        const effectiveZoom = zoom * dpr;
        const translateX = (canvas.width * 0.5) - (camera.x * effectiveZoom);
        const translateY = (canvas.height * 0.5) - (camera.y * effectiveZoom);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(effectiveZoom, 0, 0, effectiveZoom, translateX, translateY);

        // Draw prairie background objects (grass, puddles, flowers behind slimes)
        drawPrairieObjects();

        for (const entry of getActiveEntries()) {
            entry.slime.draw();
        }
        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            particle.update();
            particle.draw();
            if (particle.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // ── Inkübus speech bubbles ──────────────────────────────────────────
        drawSpeechBubbles();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function step() {
        rafId = window.requestAnimationFrame(step);

        // NOTE: No FPS throttling here — performance tier only affects rendering
        // quality (DPR, particles, visual effects), never frame rate. Capping FPS
        // hurts the user on low/medium tiers without any actual GPU/CPU benefit.

        try {
            if (pointerMode === 'slime-drag' && edgeScrollPointer) {
                applyEdgeScroll(edgeScrollPointer.clientX, edgeScrollPointer.clientY);
            }

            const now = performance.now();
            for (const entry of getActiveEntries()) {
                entry.slime.update();
                if (!entry.slime.draggedNode && !wasRecentlyManipulated(entry, now)) {
                    softlyKeepSlimeNearPrairie(entry.slime);
                }
            }
            resolveSlimeCollisions();

            // ── Autonomous behavior engine ──────────────────────────────────────
            {
                const engineEntries = activeCanonicalIds
                    .map((id) => ({ id, slime: runtimeById.get(id)?.slime }))
                    .filter((e) => e.slime && !e.slime.draggedNode);
                if (engineEntries.length >= 1) {
                    interactionEngine.tick(engineEntries, world, prairieObjects);
                }
            }

            // ── Idle braking: stop residual sliding when no AI intent ──────────
            for (const entry of getActiveEntries()) {
                const slime = entry.slime;
                if (slime.draggedNode || wasRecentlyManipulated(entry, now)) continue;
                const brain = slime._prairieBrain;
                if (brain && Math.abs(brain.intentDir) > 0.05) continue;
                const gr = slime.getGroundedRatio?.() ?? 0;
                if (gr < 0.15) continue;
                const avgV = slime.getAverageVelocity?.();
                if (!avgV || Math.abs(avgV.x) > 1.5) continue;
                if (slime.locomotionState !== 'idle' && slime.locomotionState !== 'land') continue;
                for (const node of slime.nodes || []) {
                    if (node === slime.draggedNode) continue;
                    const vx = node.x - node.oldX;
                    if (Math.abs(vx) < 0.1) node.oldX = node.x;
                    else if (Math.abs(vx) < 0.5) node.oldX = node.x - vx * 0.15;
                }
            }

            for (const canonicalId of [...activeCanonicalIds]) {
                const entry = runtimeById.get(canonicalId);
                if (!entry) {
                    continue;
                }
                if (isSlimeOutOfPrairieBounds(entry.slime)) {
                    if (entry.slime.draggedNode || wasRecentlyManipulated(entry, now)) {
                        entry.outOfBoundsFrames = 0;
                        continue;
                    }
                    entry.outOfBoundsFrames = (entry.outOfBoundsFrames || 0) + 1;
                    if (entry.outOfBoundsFrames >= OUT_OF_BOUNDS_FRAME_THRESHOLD) {
                        respawnOutOfBounds(canonicalId);
                    }
                    continue;
                }
                entry.outOfBoundsFrames = 0;
            }

            syncSceneTransform();
            updatePrairieObjects();

            // Spawn speech bubbles
            const bubbleNow = performance.now();
            for (const entry of getActiveEntries()) {
                if (!entry.slime.draggedNode) {
                    maybeSpawnBubble(entry, bubbleNow);
                }
            }
        } catch (_stepErr) {
            // Physics/AI error — still render the frame so the canvas never freezes
        }

        drawFrame();
        renderMinimap();
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            stopLoop();
            stopBackgroundTick();
        } else if (!isSuspended) {
            // Ensure canvas is properly sized after returning from background,
            // then restart the render loop.
            resize();
            startLoop();
        } else {
            // Prairie suspendue mais device revenu — relancer le background tick
            startBackgroundTick();
        }
    }

    // pageshow fires on iOS Safari/Chrome when the app comes back from the
    // background (BFCache restore). visibilitychange alone is not reliable on
    // all mobile browsers, so this acts as an additional safety net.
    function handlePageShow() {
        if (!isSuspended && !rafId) {
            resize();
            startLoop();
        }
    }

    function startLoop() {
        if (rafId) {
            window.cancelAnimationFrame(rafId);
        }
        // addEventListener deduplicates – safe to call multiple times.
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('inku:perf-tier-changed', handlePerfTierChanged);
        rafId = window.requestAnimationFrame(step);
    }

    /**
     * Tick de logique léger pour la prairie en arrière-plan.
     * Met à jour l'IA et les interactions sans aucun rendu canvas.
     * Cadence : ~4 Hz pour un coût CPU quasi nul.
     */
    function backgroundTick() {
        const now = performance.now();
        for (const entry of getActiveEntries()) {
            entry.slime.update();
        }
        resolveSlimeCollisions();
        const engineEntries = activeCanonicalIds
            .map((id) => ({ id, slime: runtimeById.get(id)?.slime }))
            .filter((e) => e.slime && !e.slime.draggedNode);
        if (engineEntries.length >= 1) {
            interactionEngine.tick(engineEntries, world, prairieObjects);
        }
    }

    function startBackgroundTick() {
        if (backgroundTickId) return;
        backgroundTickId = window.setInterval(backgroundTick, 250);
    }

    function stopBackgroundTick() {
        if (backgroundTickId) {
            window.clearInterval(backgroundTickId);
            backgroundTickId = 0;
        }
    }

    function stopLoop() {
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
        // Keep the visibilitychange listener alive so the loop can restart when
        // the user returns from another app or tab.  Only teardownLoop() (called
        // from unmount) fully removes it.
        window.removeEventListener('inku:perf-tier-changed', handlePerfTierChanged);
    }

    function teardownLoop() {
        stopLoop();
        stopBackgroundTick();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
    }

    function handlePerfTierChanged() {
        // Resize canvas to apply new DPR cap immediately
        resizeCanvas();
        computeWorld();
        syncSceneTransform();
    }

    function resize() {
        resizeCanvas();
        computeWorld();
        clampCamera();
        // Mettre en cache le rect du viewport (une seule lecture par resize, pas par frame)
        viewportEdgeRect = viewport ? viewport.getBoundingClientRect() : null;
        syncSceneTransform();
        applyPanelLayout();
        renderMinimap();
        drawFrame();
    }

    function showFeature() {
        if (!root) {
            return;
        }
        root.hidden = false;
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        root.style.pointerEvents = 'auto';
        root.style.position = 'relative';
        root.style.inset = '';
    }

    function hideFeature() {
        if (!root) {
            return;
        }
        root.hidden = false;
        root.style.visibility = 'hidden';
        root.style.opacity = '0';
        root.style.pointerEvents = 'none';
        root.style.position = 'absolute';
        root.style.inset = '0';
    }

    function bindResize() {
        if (resizeObserver || !viewport) {
            return;
        }
        if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(() => resize());
            resizeObserver.observe(viewport);
            return;
        }
        const onResize = () => resize();
        window.addEventListener('resize', onResize);
        resizeObserver = { disconnect: () => window.removeEventListener('resize', onResize) };
    }

    function subscribeRepository() {
        if (unsubscribeRepository) {
            return;
        }
        unsubscribeRepository = storageContext.repository.subscribe(() => {
            const latestActiveIds = [];
            for (const canonicalId of activeCanonicalIds) {
                const nextRecord = findRecordById(canonicalId);
                const entry = runtimeById.get(canonicalId);
                if (!nextRecord || !entry) {
                    runtimeById.delete(canonicalId);
                    continue;
                }
                entry.record = nextRecord;
                latestActiveIds.push(canonicalId);
            }
            activeCanonicalIds = latestActiveIds;
            renderDronePanel();
        });
    }

    function bootstrapPrairieRuntime() {
        ensureCanvasRuntime();
        resize();
        bindResize();
        subscribeRepository();
        bindInteractions();
        clearParticles();
        interactionEngine.reset();

        const savedIds = activeCanonicalIds.filter((canonicalId) => !!findRecordById(canonicalId)).slice(0, MAX_ACTIVE_TRUE_ENGINE);
        runtimeById.clear();
        activeCanonicalIds = [];

        savedIds.forEach((canonicalId, index) => {
            const record = findRecordById(canonicalId);
            if (!record) {
                return;
            }
            const slime = createCanonicalRuntime(record, index, getSavedPrairiePlacement(record, index), -1.2);
            if (!slime) {
                return;
            }
            runtimeById.set(canonicalId, { canonicalId, slime, record, outOfBoundsFrames: 0, lastManipulatedAt: 0 });
            activeCanonicalIds.push(canonicalId);
        });

        if (activeCanonicalIds.length) {
            const firstRecord = findRecordById(activeCanonicalIds[0]);
            const prairieCamera = firstRecord?.prairieState?.camera;
            if (prairieCamera && Number.isFinite(prairieCamera.x) && Number.isFinite(prairieCamera.y)) {
                camera = {
                    x: prairieCamera.x,
                    y: prairieCamera.y,
                    zoom: clamp(Number.isFinite(prairieCamera.zoom) ? prairieCamera.zoom : camera.zoom, MIN_ZOOM, MAX_ZOOM),
                };
                clampCamera();
            }
        }

        renderDronePanel();
        applyPanelLayout();
        syncSceneTransform();
        drawFrame();
        renderMinimap();
        startLoop();
    }

    return {
        id: 'prairie',
        mount(context) {
            ensureShell(context.mount);
            isSuspended = false;
            stopBackgroundTick();
            showFeature();
            bootstrapPrairieRuntime();
        },
        resume(context) {
            ensureShell(context.mount);
            isSuspended = false;
            stopBackgroundTick();
            showFeature();
            bootstrapPrairieRuntime();
        },
        suspend() {
            if (!root || isSuspended) {
                return;
            }
            isSuspended = true;
            persistAllActiveRecords('prairie_suspend');
            saveSession({ activeCanonicalIds: [...activeCanonicalIds], camera: { ...camera }, panel: panelLayout });
            stopLoop();
            // Continuer la logique IA en arrière-plan (sans rendu canvas)
            startBackgroundTick();
            clearTimeout(saveTimeout);
            window.clearTimeout(dronePanelCloseTimeout);
            clearInterval(obsUpdateInterval);
            clearParticles();
            hideFeature();
        },
        syncLayout() {
            if (isSuspended) {
                return;
            }
            resize();
        },
        unmount() {
            persistAllActiveRecords('prairie_unmount');
            saveSession({ activeCanonicalIds: [...activeCanonicalIds], camera: { ...camera }, panel: panelLayout });
            teardownLoop();
            clearTimeout(saveTimeout);
            window.clearTimeout(dronePanelCloseTimeout);
            clearInterval(obsUpdateInterval);
            clearParticles();
            resizeObserver?.disconnect?.();
            resizeObserver = null;
            unsubscribeRepository?.();
            unsubscribeRepository = null;
            runtimeById.clear();
            activeCanonicalIds = [];
            interactionsBound = false;
            if (currentMount) {
                currentMount.classList.remove('content-mount--prairie');
            }
            root?.remove?.();
            root = null;
            viewport = null;
            viewportEdgeRect = null;
            scene = null;
            canvas = null;
            minimapCanvas = null;
            droneToggle = null;
            dronePanel = null;
            droneClose = null;
            dronePanelDragHandle = null;
            dronePanelResizeHandle = null;
            droneTeamGrid = null;
            droneArchiveGrid = null;
            droneCap = null;
            droneArchiveHint = null;
            emptyState = null;
            currentMount = null;
        },
    };
}
