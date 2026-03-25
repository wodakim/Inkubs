import { t } from '../../i18n/i18n.js';
import { setCanvas } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { MAX_ACTIVE_TRUE_ENGINE } from './prairie-constants.js';

export function buildShell(ctx) {
    ctx.root = document.createElement('section');
    ctx.root.className = 'prairie-feature';
    ctx.root.dataset.prairieFeature = 'true';
    ctx.root.innerHTML = `
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

    ctx.viewport = ctx.root.querySelector('[data-prairie-viewport]');
    ctx.scene = ctx.root.querySelector('[data-prairie-scene]');
    ctx.canvas = ctx.root.querySelector('[data-prairie-canvas]');
    ctx.minimapCanvas = ctx.root.querySelector('[data-prairie-minimap]');
    ctx.droneToggle = ctx.root.querySelector('[data-prairie-drone-toggle]');
    ctx.dronePanel = ctx.root.querySelector('[data-prairie-drone-panel]');
    ctx.droneClose = ctx.root.querySelector('[data-prairie-drone-close]');
    ctx.dronePanelDragHandle = ctx.root.querySelector('[data-prairie-panel-drag-handle]');
    ctx.dronePanelResizeHandle = ctx.root.querySelector('[data-prairie-panel-resize]');
    ctx.droneTeamGrid = ctx.root.querySelector('[data-prairie-team-grid]');
    ctx.droneArchiveGrid = ctx.root.querySelector('[data-prairie-archive-grid]');
    ctx.droneCap = ctx.root.querySelector('[data-prairie-cap]');
    ctx.droneArchiveHint = ctx.root.querySelector('[data-prairie-archive-hint]');
    ctx.emptyState = ctx.root.querySelector('[data-prairie-empty]');
    ctx.loupeBtn = ctx.root.querySelector('[data-prairie-loupe]');
    ctx.obsPanel = ctx.root.querySelector('[data-prairie-obs]');
    ctx.obsClose = ctx.root.querySelector('[data-prairie-obs-close]');
    ctx.obsDragHandle = ctx.root.querySelector('[data-prairie-obs-drag]');
    ctx.obsTitle = ctx.root.querySelector('[data-prairie-obs-title]');
    ctx.obsHint = ctx.root.querySelector('[data-prairie-obs-hint]');
    ctx.obsBody = ctx.root.querySelector('[data-prairie-obs-body]');
    ctx.obsPageLog = ctx.root.querySelector('[data-prairie-obs-page="log"]');
    ctx.obsPageStats = ctx.root.querySelector('[data-prairie-obs-page="stats"]');
    ctx.obsPageJournal = ctx.root.querySelector('[data-prairie-obs-page="journal"]');
    ctx.obsTabs = [...ctx.root.querySelectorAll('[data-prairie-obs-tab]')];
}

export function ensureShell(ctx, mount) {
    if (!ctx.root) {
        buildShell(ctx);
    }
    ctx.currentMount = mount;
    if (!ctx.root.isConnected) {
        mount.appendChild(ctx.root);
    }
    mount.classList.add('content-mount--prairie');
}

export function ensureCanvasRuntime(ctx) {
    if (!ctx.canvas) {
        return;
    }
    const runtimeContext = ctx.canvas.getContext('2d', { alpha: true });
    setCanvas(ctx.canvas, runtimeContext);
}