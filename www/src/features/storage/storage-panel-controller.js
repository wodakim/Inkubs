import { t } from '../../i18n/i18n.js';
import { renderStorageSlots } from './storage-grid-renderer.js';
import { buildCanonicalPortraitSvg } from './storage-canonical-visual-renderer.js';
import { sortArchiveInSnapshot } from './storage-sort-service.js';
import { clampPageNumber } from './storage-pagination-service.js';
import { moveOrSwapCanonicalInSnapshot, normalizePlacement, renameCanonicalRecordInSnapshot, removeCanonicalRecordInSnapshot } from './storage-slot-operations.js';
import { createCanonicalInspectionSandbox } from './storage-canonical-inspection-sandbox.js';
import { computeAcquisitionCost } from '../economy/economy-calculator.js';

const LONG_PRESS_MS = 260;
const PRESS_CANCEL_DISTANCE_PX = 10;
const STORAGE_PANEL_SESSION_KEY = 'inku.storage.panel.session.v1';
const PANEL_MIN_WIDTH = 286;
const PANEL_MAX_WIDTH = 520;
const PANEL_MIN_HEIGHT = 320;
const PANEL_MAX_HEIGHT = 760;
const DETAIL_PANEL_SESSION_KEY = 'inku.storage.detail.panel.session.v1';
const DETAIL_MIN_WIDTH = 260;
const DETAIL_MAX_WIDTH = 500;
const DETAIL_MIN_HEIGHT = 300;
const DETAIL_MAX_HEIGHT = 720;
const PANEL_MARGIN = 12;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadPanelSession() {
    try {
        const raw = window.localStorage.getItem(STORAGE_PANEL_SESSION_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function savePanelSession(session) {
    try {
        window.localStorage.setItem(STORAGE_PANEL_SESSION_KEY, JSON.stringify(session || {}));
    } catch (_error) {}
}

function getViewportSize() {
    // visualViewport is more reliable on mobile (accounts for keyboard, zoom, etc.)
    const vv = window.visualViewport;
    const width  = Math.max(320, Math.round(
        (vv?.width)  || window.innerWidth  || document.documentElement?.clientWidth  || 390
    ));
    const height = Math.max(420, Math.round(
        (vv?.height) || window.innerHeight || document.documentElement?.clientHeight || 844
    ));
    return { width, height };
}

function normalizePanelLayout(layout = {}) {
    const viewport = getViewportSize();
    const maxWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, viewport.width - PANEL_MARGIN * 2));
    const maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, viewport.height - PANEL_MARGIN * 2));
    const width = clamp(Number.isFinite(layout.width) ? layout.width : Math.min(maxWidth, Math.round(viewport.width * 0.9)), PANEL_MIN_WIDTH, maxWidth);
    const height = clamp(Number.isFinite(layout.height) ? layout.height : Math.min(maxHeight, Math.round(viewport.height * 0.72)), PANEL_MIN_HEIGHT, maxHeight);
    const maxOffsetX = Math.max(0, (viewport.width - width) * 0.5 - PANEL_MARGIN);
    const maxOffsetY = Math.max(0, (viewport.height - height) * 0.5 - PANEL_MARGIN);
    return {
        width,
        height,
        offsetX: clamp(Number.isFinite(layout.offsetX) ? layout.offsetX : 0, -maxOffsetX, maxOffsetX),
        offsetY: clamp(Number.isFinite(layout.offsetY) ? layout.offsetY : 0, -maxOffsetY, maxOffsetY),
    };
}

function loadDetailPanelSession() {
    try {
        const raw = window.localStorage.getItem(DETAIL_PANEL_SESSION_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
}

function saveDetailPanelSession(session) {
    try { window.localStorage.setItem(DETAIL_PANEL_SESSION_KEY, JSON.stringify(session || {})); } catch (_) {}
}

function normalizeDetailPanelLayout(layout = {}) {
    const viewport = getViewportSize();
    const maxW = Math.max(DETAIL_MIN_WIDTH, Math.min(DETAIL_MAX_WIDTH, viewport.width - PANEL_MARGIN * 2));
    const maxH = Math.max(DETAIL_MIN_HEIGHT, Math.min(DETAIL_MAX_HEIGHT, viewport.height - PANEL_MARGIN * 2));
    const width  = clamp(Number.isFinite(layout.width)  ? layout.width  : Math.min(maxW, Math.round(viewport.width * 0.88)),  DETAIL_MIN_WIDTH,  maxW);
    const height = clamp(Number.isFinite(layout.height) ? layout.height : Math.min(maxH, Math.round(viewport.height * 0.70)), DETAIL_MIN_HEIGHT, maxH);
    const maxOffsetX = Math.max(0, (viewport.width  - width)  * 0.5 - PANEL_MARGIN);
    const maxOffsetY = Math.max(0, (viewport.height - height) * 0.5 - PANEL_MARGIN);
    return {
        width,
        height,
        offsetX: clamp(Number.isFinite(layout.offsetX) ? layout.offsetX : 0, -maxOffsetX, maxOffsetX),
        offsetY: clamp(Number.isFinite(layout.offsetY) ? layout.offsetY : 0, -maxOffsetY, maxOffsetY),
    };
}

export function createStoragePanelController({ mountTarget, repository, store = null, inspectionBridge = null, onVisibilityChange = null, floatingPanel = false }) {
    if (!mountTarget) {
        throw new Error('A mount target is required for the storage panel controller.');
    }
    if (!repository) {
        throw new Error('A storage repository is required for the storage panel controller.');
    }

    let root = null;
    let refs = {};
    let isOpen = false;
    let currentPage = 1;
    let unsubscribe = null;
    let selectedCanonicalId = null;
    let activeArchiveSortKey = 'rarity';
    let activeTab = 'team';
    let activePress = null;
    let activeDrag = null;
    let pendingSell = null;
    let pendingBoxSelection = null;
    let panelLayout = normalizePanelLayout(loadPanelSession());
    let panelDrag = null;
    let panelResize = null;
    let detailLayout = normalizeDetailPanelLayout(loadDetailPanelSession());
    let detailPanelDrag = null;
    let detailPanelResize = null;
    const detailSandbox = createCanonicalInspectionSandbox();

    function applyPanelLayout() {
        if (!floatingPanel || !root) {
            return;
        }
        // Always re-normalize so the panel can never escape the viewport
        // (handles screen resize, orientation change, desktop→mobile switch)
        panelLayout = normalizePanelLayout(panelLayout || {});
        root.style.setProperty('--storage-panel-width',    `${panelLayout.width}px`);
        root.style.setProperty('--storage-panel-height',   `${panelLayout.height}px`);
        root.style.setProperty('--storage-panel-offset-x', `${panelLayout.offsetX}px`);
        root.style.setProperty('--storage-panel-offset-y', `${panelLayout.offsetY}px`);
        // Persist the clamped layout so stale large-screen offsets don't
        // survive a page reload on a smaller screen
        persistPanelLayout();
    }

    function persistPanelLayout() {
        if (!floatingPanel) {
            return;
        }
        savePanelSession(panelLayout);
    }

    function onPanelDragStart(event) {
        if (!floatingPanel || !isOpen || event.button > 0) {
            return;
        }
        if (event.target.closest?.('[data-storage-close]')) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        panelDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: panelLayout.offsetX,
            originY: panelLayout.offsetY,
        };
        globalThis.addEventListener('pointermove', onPanelPointerMove, { passive: false });
        globalThis.addEventListener('pointerup', onPanelPointerUp, { passive: false });
        globalThis.addEventListener('pointercancel', onPanelPointerUp, { passive: false });
    }

    function onPanelResizeStart(event) {
        if (!floatingPanel || !isOpen || event.button > 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const corner = event.currentTarget.dataset.storageCorner || 'br';
        // wSign: +1 = right side grows right, -1 = left side grows left
        // hSign: +1 = bottom grows down, -1 = top grows up
        panelResize = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originWidth: panelLayout.width,
            originHeight: panelLayout.height,
            originOffsetX: panelLayout.offsetX,
            originOffsetY: panelLayout.offsetY,
            wSign: (corner === 'tr' || corner === 'br') ? 1 : -1,
            hSign: (corner === 'bl' || corner === 'br') ? 1 : -1,
        };
        globalThis.addEventListener('pointermove', onPanelPointerMove, { passive: false });
        globalThis.addEventListener('pointerup', onPanelPointerUp, { passive: false });
        globalThis.addEventListener('pointercancel', onPanelPointerUp, { passive: false });
    }

    function onPanelPointerMove(event) {
        if (panelDrag && panelDrag.pointerId === event.pointerId) {
            event.preventDefault();
            const rawX = panelDrag.originX + (event.clientX - panelDrag.startX);
            const rawY = panelDrag.originY + (event.clientY - panelDrag.startY);
            // Clamp so the panel can never leave the viewport
            const vp = getViewportSize();
            const maxOffsetX = Math.max(0, (vp.width  - panelLayout.width)  * 0.5 - PANEL_MARGIN);
            const maxOffsetY = Math.max(0, (vp.height - panelLayout.height) * 0.5 - PANEL_MARGIN);
            panelLayout.offsetX = clamp(rawX, -maxOffsetX, maxOffsetX);
            panelLayout.offsetY = clamp(rawY, -maxOffsetY, maxOffsetY);
            applyPanelLayout();
            return;
        }

        if (panelResize && panelResize.pointerId === event.pointerId) {
            event.preventDefault();
            const dx = event.clientX - panelResize.startX;
            const dy = event.clientY - panelResize.startY;
            // Opposite corner stays fixed: center shifts by half the delta
            panelLayout.width   = panelResize.originWidth   + panelResize.wSign * dx;
            panelLayout.height  = panelResize.originHeight  + panelResize.hSign * dy;
            panelLayout.offsetX = panelResize.originOffsetX + dx / 2;
            panelLayout.offsetY = panelResize.originOffsetY + dy / 2;
            panelLayout = normalizePanelLayout(panelLayout);
            applyPanelLayout();
        }
    }

    function onPanelPointerUp(event) {
        const isDragPointer = panelDrag && panelDrag.pointerId === event.pointerId;
        const isResizePointer = panelResize && panelResize.pointerId === event.pointerId;
        if (!isDragPointer && !isResizePointer) {
            return;
        }
        event.preventDefault();
        panelDrag = null;
        panelResize = null;
        applyPanelLayout();
        persistPanelLayout();
        globalThis.removeEventListener('pointermove', onPanelPointerMove, { passive: false });
        globalThis.removeEventListener('pointerup', onPanelPointerUp, { passive: false });
        globalThis.removeEventListener('pointercancel', onPanelPointerUp, { passive: false });
    }

    /* ── Detail panel : drag / resize ─────────────────────────────────── */

    function applyDetailLayout() {
        const dialog = refs.detailModal?.querySelector('.storage-detail-modal__dialog');
        if (!dialog) return;
        detailLayout = normalizeDetailPanelLayout(detailLayout || {});
        dialog.style.setProperty('--detail-width',    `${detailLayout.width}px`);
        dialog.style.setProperty('--detail-height',   `${detailLayout.height}px`);
        dialog.style.setProperty('--detail-offset-x', `${detailLayout.offsetX}px`);
        dialog.style.setProperty('--detail-offset-y', `${detailLayout.offsetY}px`);
        saveDetailPanelSession(detailLayout);
    }

    function onDetailDragStart(event) {
        if (event.button > 0) return;
        if (event.target.closest?.('[data-storage-detail-close]')) return;
        event.preventDefault();
        event.stopPropagation();
        detailPanelDrag = {
            pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY,
            originX: detailLayout.offsetX, originY: detailLayout.offsetY,
        };
        globalThis.addEventListener('pointermove', onDetailPointerMove, { passive: false });
        globalThis.addEventListener('pointerup',   onDetailPointerUp,   { passive: false });
        globalThis.addEventListener('pointercancel', onDetailPointerUp, { passive: false });
    }

    function onDetailResizeStart(event) {
        if (event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        const corner = event.currentTarget.dataset.detailCorner || 'br';
        detailPanelResize = {
            pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY,
            originWidth: detailLayout.width, originHeight: detailLayout.height,
            originOffsetX: detailLayout.offsetX, originOffsetY: detailLayout.offsetY,
            wSign: (corner === 'tr' || corner === 'br') ? 1 : -1,
            hSign: (corner === 'bl' || corner === 'br') ? 1 : -1,
        };
        globalThis.addEventListener('pointermove', onDetailPointerMove, { passive: false });
        globalThis.addEventListener('pointerup',   onDetailPointerUp,   { passive: false });
        globalThis.addEventListener('pointercancel', onDetailPointerUp, { passive: false });
    }

    function onDetailPointerMove(event) {
        if (detailPanelDrag && detailPanelDrag.pointerId === event.pointerId) {
            event.preventDefault();
            const vp = getViewportSize();
            const rawX = detailPanelDrag.originX + (event.clientX - detailPanelDrag.startX);
            const rawY = detailPanelDrag.originY + (event.clientY - detailPanelDrag.startY);
            const maxOffsetX = Math.max(0, (vp.width  - detailLayout.width)  * 0.5 - PANEL_MARGIN);
            const maxOffsetY = Math.max(0, (vp.height - detailLayout.height) * 0.5 - PANEL_MARGIN);
            detailLayout.offsetX = clamp(rawX, -maxOffsetX, maxOffsetX);
            detailLayout.offsetY = clamp(rawY, -maxOffsetY, maxOffsetY);
            applyDetailLayout();
            return;
        }
        if (detailPanelResize && detailPanelResize.pointerId === event.pointerId) {
            event.preventDefault();
            const dx = event.clientX - detailPanelResize.startX;
            const dy = event.clientY - detailPanelResize.startY;
            detailLayout.width   = detailPanelResize.originWidth   + detailPanelResize.wSign * dx;
            detailLayout.height  = detailPanelResize.originHeight  + detailPanelResize.hSign * dy;
            detailLayout.offsetX = detailPanelResize.originOffsetX + dx / 2;
            detailLayout.offsetY = detailPanelResize.originOffsetY + dy / 2;
            detailLayout = normalizeDetailPanelLayout(detailLayout);
            applyDetailLayout();
        }
    }

    function onDetailPointerUp(event) {
        const isDrag   = detailPanelDrag   && detailPanelDrag.pointerId   === event.pointerId;
        const isResize = detailPanelResize && detailPanelResize.pointerId === event.pointerId;
        if (!isDrag && !isResize) return;
        event.preventDefault();
        detailPanelDrag = null;
        detailPanelResize = null;
        applyDetailLayout();
        globalThis.removeEventListener('pointermove', onDetailPointerMove, { passive: false });
        globalThis.removeEventListener('pointerup',   onDetailPointerUp,   { passive: false });
        globalThis.removeEventListener('pointercancel', onDetailPointerUp, { passive: false });
    }

    function buildRoot() {
        root = document.createElement('section');
        root.className = floatingPanel ? 'storage-panel storage-panel--floating' : 'storage-panel';
        root.classList.remove('is-open');
        root.hidden = true;
        root.setAttribute('inert', '');
        root.innerHTML = `
            <div class="storage-panel__surface">
                <header class="storage-panel__header" data-storage-panel-drag-handle>
                    <div>
                        <p class="storage-panel__eyebrow">${t('storage.collection')}</p>
                        <h2 class="storage-panel__title">${t('storage.archive_title')}</h2>
                    </div>
                    <button type="button" class="storage-panel__close" data-storage-close aria-label="${t('storage.close_aria')}">×</button>
                </header>

                <nav class="storage-tab-nav" role="tablist" aria-label="${t('storage.sections_aria')}">
                    <button type="button" class="storage-tab-nav__btn is-active" data-storage-tab="team" role="tab" aria-selected="true">
                        <span class="storage-tab-nav__dot"></span>${t('storage.team_tab')}
                    </button>
                    <button type="button" class="storage-tab-nav__btn" data-storage-tab="archive" role="tab" aria-selected="false">
                        ${t('storage.archive_tab')}
                    </button>
                </nav>

                <div class="storage-panel__body" data-storage-scroll-body>

                    <!-- ── ÉQUIPE ACTIVE ────────────────────────────── -->
                    <div class="storage-team-showcase">
                        <div class="storage-team-showcase__label">
                            <span class="storage-team-showcase__dot"></span>
                            ${t('storage.team_active')}
                        </div>
                        <div class="storage-team-showcase__slots storage-team-grid" data-storage-team-grid></div>
                    </div>

                    <!-- ── PC BOX ─────────────────────────────────── -->
                    <div class="storage-pc-box">

                        <!-- Nav row : prev · box name · next · sort -->
                        <div class="storage-pc-box__nav-row" role="toolbar" aria-label="${t('storage.nav_aria')}">
                            <button type="button" class="storage-pc-box__nav-btn" data-storage-prev aria-label="${t('storage.prev_aria')}">
                                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true"><path d="M6.5 1.5L1.5 7L6.5 12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </button>
                            <div class="storage-pc-box__box-title">
                                <span class="storage-pc-box__box-word">${t('storage.box')}</span>
                                <span class="storage-pc-box__box-num" data-storage-page-number>1</span>
                                <span class="storage-pc-box__box-label" data-storage-page-label style="display:none"></span>
                                <div class="storage-pc-box__fill">
                                    <div class="storage-pc-box__fill-track">
                                        <div class="storage-pc-box__fill-bar" data-storage-fill-bar></div>
                                    </div>
                                    <span class="storage-pc-box__fill-count" data-storage-fill-count>0/16</span>
                                </div>
                            </div>
                            <button type="button" class="storage-pc-box__nav-btn" data-storage-next aria-label="${t('storage.next_aria')}">
                                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true"><path d="M1.5 1.5L6.5 7L1.5 12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </button>
                            <div class="storage-pc-box__sort-chips">
                                <button type="button" class="storage-pc-box__sort-btn is-active" data-storage-sort-key="rarity">${t('storage.rarity')}</button>
                                <button type="button" class="storage-pc-box__sort-btn" data-storage-sort-key="level">${t('storage.level')}</button>
                                <button type="button" class="storage-pc-box__sort-btn" data-storage-sort-key="type">${t('storage.type')}</button>
                            </div>
                        </div>

                        <!-- Box frame : biome background + slot grid -->
                        <div class="storage-pc-box__frame">
                            <div class="storage-pc-box__biome"></div>
                            <div class="storage-archive-grid storage-pc-box__grid" data-storage-archive-grid></div>
                            <div class="storage-pc-box__frame-shine"></div>
                        </div>

                        <!-- Box footer info -->
                        <div class="storage-pc-box__info-bar">
                            <span class="storage-pc-box__info-count" data-storage-page-access>1 / 99</span>
                        </div>

                    </div>

                </div>

                ${floatingPanel ? `
                    <div class="storage-panel__corner" data-storage-corner="tl"></div>
                    <div class="storage-panel__corner" data-storage-corner="tr"></div>
                    <div class="storage-panel__corner" data-storage-corner="bl"></div>
                    <div class="storage-panel__corner" data-storage-corner="br"></div>
                ` : ''}
            </div>

            <div class="storage-confirm-modal" data-storage-sell-modal hidden inert aria-hidden="true" role="dialog" aria-modal="true">
                <div class="storage-confirm-modal__dialog">
                    <h3 class="storage-confirm-modal__title">${t('storage.sell_title')}</h3>
                    <div class="storage-confirm-modal__subject" data-storage-sell-subject></div>
                    <p class="storage-confirm-modal__copy" data-storage-sell-copy></p>
                    <div class="storage-confirm-modal__actions">
                        <button type="button" class="storage-confirm-modal__button storage-confirm-modal__button--secondary" data-storage-sell-cancel>${t('common.cancel')}</button>
                        <button type="button" class="storage-confirm-modal__button storage-confirm-modal__button--danger" data-storage-sell-confirm>${t('storage.sell_confirm')}</button>
                    </div>
                </div>
            </div>

            <div class="storage-box-input-modal" data-storage-box-modal hidden inert aria-hidden="true" role="dialog" aria-modal="true">
                <div class="storage-box-input-modal__dialog">
                    <h3 class="storage-box-input-modal__title">${t('storage.box_input_title')}</h3>
                    <p class="storage-box-input-modal__hint">${t('storage.box_input_hint')}</p>
                    <input type="number" min="1" max="99" class="storage-box-input-modal__input" data-storage-box-number-input placeholder="1–99">
                    <p class="storage-box-input-modal__error" data-storage-box-error hidden></p>
                    <div class="storage-box-input-modal__actions">
                        <button type="button" class="storage-box-input-modal__btn storage-box-input-modal__btn--secondary" data-storage-box-cancel>${t('common.cancel')}</button>
                        <button type="button" class="storage-box-input-modal__btn storage-box-input-modal__btn--confirm" data-storage-box-confirm>${t('storage.box_confirm')}</button>
                    </div>
                </div>
            </div>

            <div class="storage-detail-modal" data-storage-detail-modal hidden inert>
                <div class="storage-detail-modal__backdrop" data-storage-detail-close></div>
                <section class="storage-detail-modal__dialog" aria-label="${t('storage.slime_file_aria')}">
                    <header class="storage-detail-modal__header" data-detail-drag-handle>
                        <div>
                            <p class="storage-detail-modal__eyebrow">${t('storage.profile_eyebrow')}</p>
                            <h3 class="storage-detail-modal__title" data-storage-detail-title>${t('storage.specimen')}</h3>
                        </div>
                        <button type="button" class="storage-detail-modal__close" data-storage-detail-close aria-label="${t('storage.close_detail_aria')}">×</button>
                    </header>
                    <div class="storage-detail-modal__content" data-storage-detail-content></div>
                    <div class="storage-detail-modal__corner" data-detail-corner="tl"></div>
                    <div class="storage-detail-modal__corner" data-detail-corner="tr"></div>
                    <div class="storage-detail-modal__corner" data-detail-corner="bl"></div>
                    <div class="storage-detail-modal__corner" data-detail-corner="br"></div>
                </section>
            </div>
        `;

        // Drag-actions vit dans document.body pour éviter le containing-block
        // créé par transform sur le panneau flottant (sinon position:fixed se
        // calcule par rapport au panel et non au viewport → hors-écran sur mobile).
        const dragActionsEl = document.createElement('div');
        dragActionsEl.className = 'storage-drag-actions';
        dragActionsEl.dataset.storageDragActions = '';
        dragActionsEl.hidden = true;
        dragActionsEl.innerHTML = `
            <button type="button" class="storage-action-zone storage-action-zone--move"
                    data-storage-action-zone="move" aria-label="${t('storage.action_store_aria')}">
                <span class="storage-action-zone__icon" aria-hidden="true" data-storage-move-icon>📦</span>
                <span class="storage-action-zone__label" data-storage-move-label>${t('storage.action_store_label')}</span>
                <span class="storage-action-zone__hint" data-storage-move-hint></span>
            </button>
            <button type="button" class="storage-action-zone storage-action-zone--sell"
                    data-storage-action-zone="sell" aria-label="${t('storage.sell_zone_aria')}">
                <span class="storage-action-zone__icon" aria-hidden="true">🛒</span>
                <span class="storage-action-zone__label">${t('storage.sell_label')}</span>
                <span class="storage-action-zone__price" data-storage-sell-price></span>
            </button>
        `;
        document.body.appendChild(dragActionsEl);

        refs = {
            closeButton: root.querySelector('[data-storage-close]'),
            prevButton: root.querySelector('[data-storage-prev]'),
            nextButton: root.querySelector('[data-storage-next]'),
            teamGrid: root.querySelector('[data-storage-team-grid]'),
            archiveGrid: root.querySelector('[data-storage-archive-grid]'),
            pageLabel: root.querySelector('[data-storage-page-label]'),
            pageNumber: root.querySelector('[data-storage-page-number]'),
            pageAccess: root.querySelector('[data-storage-page-access]'),
            fillBar: root.querySelector('[data-storage-fill-bar]'),
            fillCount: root.querySelector('[data-storage-fill-count]'),
            detailModal: root.querySelector('[data-storage-detail-modal]'),
            detailContent: root.querySelector('[data-storage-detail-content]'),
            detailTitle: root.querySelector('[data-storage-detail-title]'),
            scrollBody: root.querySelector('[data-storage-scroll-body]'),
            dragActions: dragActionsEl,
            moveZone: dragActionsEl.querySelector('[data-storage-action-zone="move"]'),
            moveLabel: dragActionsEl.querySelector('[data-storage-move-label]'),
            moveHint: dragActionsEl.querySelector('[data-storage-move-hint]'),
            sellZone: dragActionsEl.querySelector('[data-storage-action-zone="sell"]'),
            sellPrice: dragActionsEl.querySelector('[data-storage-sell-price]'),
            sellModal: root.querySelector('[data-storage-sell-modal]'),
            boxModal: root.querySelector('[data-storage-box-modal]'),
            boxNumberInput: root.querySelector('[data-storage-box-number-input]'),
            boxError: root.querySelector('[data-storage-box-error]'),
            sellCopy: root.querySelector('[data-storage-sell-copy]'),
            sellSubject: root.querySelector('[data-storage-sell-subject]'),
            sortChips: [...root.querySelectorAll('[data-storage-sort-key]')],
            tabBtns: [...root.querySelectorAll('[data-storage-tab]')],
            teamShowcase: root.querySelector('.storage-team-showcase'),
            pcBox: root.querySelector('.storage-pc-box'),
            dragHandle: root.querySelector('[data-storage-panel-drag-handle]'),
            cornerHandles: [...root.querySelectorAll('[data-storage-corner]')],
        };

        refs.closeButton?.addEventListener('click', close);
        refs.dragHandle?.addEventListener('pointerdown', onPanelDragStart);
        refs.cornerHandles?.forEach((c) => c.addEventListener('pointerdown', onPanelResizeStart));
        refs.sellZone?.addEventListener('click', (event) => event.preventDefault());
        refs.moveZone?.addEventListener('click', (event) => event.preventDefault());
        refs.prevButton?.addEventListener('click', () => setPage(currentPage - 1));
        refs.nextButton?.addEventListener('click', () => setPage(currentPage + 1));
        
        // Isoler complètement la modale de détails pour qu'elle ne "fuit" pas vers le storage
        if (refs.detailModal) {
            refs.detailModal.addEventListener('wheel', (e) => e.stopPropagation());
            refs.detailModal.addEventListener('touchmove', (e) => e.stopPropagation());

            const detailDialog = refs.detailModal.querySelector('.storage-detail-modal__dialog');
            if (detailDialog) {
                // Bloquer pointerdown pour éviter que le storage intercepte les
                // interactions dans la fenêtre de détail — SAUF si l'event vient
                // du canvas du sandbox (sinon pinch/grab sont bloqués).
                detailDialog.addEventListener('pointerdown', (e) => {
                    if (e.target?.closest?.('.storage-live-sandbox__canvas')) return;
                    e.stopPropagation();
                });
            }

            // Drag handle sur le header
            const detailDragHandle = refs.detailModal.querySelector('[data-detail-drag-handle]');
            detailDragHandle?.addEventListener('pointerdown', onDetailDragStart);

            // Coins de resize
            refs.detailModal.querySelectorAll('[data-detail-corner]').forEach((c) =>
                c.addEventListener('pointerdown', onDetailResizeStart)
            );

            // Empêcher un drag depuis le fond de la modale de déclencher le drag du panneau
            refs.detailModal.addEventListener('pointerdown', (e) => {
                if (e.target === refs.detailModal || e.target.classList.contains('storage-detail-modal__backdrop')) {
                    e.stopPropagation();
                }
            });
        }

        root.addEventListener('click', onRootClick);
        root.addEventListener('keydown', onRootKeyDown);
        root.addEventListener('pointerdown', onPointerDown);

        // Delegation for detail panel actions
        root.addEventListener('click', async (e) => {
            const moveBtn = e.target.closest('[data-storage-detail-move]');
            if (moveBtn && selectedCanonicalId) {
                const canonicalId = selectedCanonicalId;
                const selection = await requestBoxSelection();
                if (selection) {
                    const snapshot = repository.getSnapshot();
                    const record = snapshot.recordsById[canonicalId];
                    if (record) {
                        const slotsPerPage = snapshot.meta?.archiveSlotsPerPage || 16;
                        const sourceSlots = snapshot.pages[String(selection.page)] || [];
                        let slotIndex = sourceSlots.findIndex((v) => !v);
                        if (slotIndex < 0 && sourceSlots.length < slotsPerPage) {
                            slotIndex = sourceSlots.length;
                        }
                        const targetPlacement = { kind: 'archive', page: selection.page, slotIndex: slotIndex >= 0 ? slotIndex : 0 };
                        const sourcePlacement = resolvePlacement(snapshot, canonicalId) || { kind: 'archive', page: currentPage, slotIndex: 0 };
                        repository.transact((draft) => {
                            moveOrSwapCanonicalInSnapshot(draft, { 
                                from: sourcePlacement, 
                                to: targetPlacement 
                            });
                            return draft;
                        }, { type: 'storage:move', from: sourcePlacement, to: targetPlacement });
                        
                        // Close detail and switch to the new page
                        closeDetail();
                        setPage(selection.page);
                        setTab('archive');
                    }
                }
            }

            const sellBtn = e.target.closest('[data-storage-detail-sell]');
            if (sellBtn && selectedCanonicalId) {
                const snapshot = repository.getSnapshot();
                const record = snapshot.recordsById[selectedCanonicalId];
                if (record) {
                    closeDetail();
                    openSellModal({ canonicalId: selectedCanonicalId, record });
                }
            }
        });

        mountTarget.appendChild(root);
        // Init tab state : équipe visible, archive cachée
        setTab('team');
    }

    function ensureRoot() {
        if (!root) {
            buildRoot();
            applyPanelLayout();
            // Listen on both window and visualViewport (mobile keyboard/zoom changes)
            globalThis.addEventListener('resize', applyPanelLayout);
            globalThis.visualViewport?.addEventListener('resize', applyPanelLayout);
            globalThis.visualViewport?.addEventListener('scroll', applyPanelLayout);
            unsubscribe = repository.subscribe(() => render());
        }
        return root;
    }

    function createSlotEntries(slotIds = [], snapshot, placementFactory) {
        return slotIds.map((canonicalId, slotIndex) => ({
            canonicalId,
            record: canonicalId ? snapshot.recordsById[canonicalId] || null : null,
            placement: placementFactory(slotIndex),
        }));
    }

    function render() {
        ensureRoot();
        const snapshot = repository.getSnapshot();
        currentPage = clampPageNumber(currentPage, snapshot.meta);
        activeArchiveSortKey = snapshot.meta?.lastArchiveSortKey || activeArchiveSortKey;
        const teamEntries = createSlotEntries(snapshot.teamSlots, snapshot, (slotIndex) => ({ kind: 'team', slotIndex }));
        const archiveEntries = createSlotEntries(
            snapshot.pages[String(currentPage)] || Array.from({ length: snapshot.meta.archiveSlotsPerPage }, () => null),
            snapshot,
            (slotIndex) => ({ kind: 'archive', page: currentPage, slotIndex }),
        );

        renderStorageSlots({ container: refs.teamGrid, records: teamEntries, slotClassName: 'storage-slot storage-slot--team' });
        renderStorageSlots({ container: refs.archiveGrid, records: archiveEntries, slotClassName: 'storage-slot storage-slot--archive' });

        refs.pageLabel.textContent = `${t('storage.page')} ${currentPage}`;
        refs.pageNumber.textContent = String(currentPage);
        refs.pageAccess.textContent = `${snapshot.meta.devUnlockAllPages ? snapshot.meta.maxPages : snapshot.meta.unlockedPages} / ${snapshot.meta.maxPages}`;
        refs.prevButton.disabled = currentPage <= 1;
        refs.nextButton.disabled = currentPage >= snapshot.meta.maxPages;

        // Fill indicator for current page
        const totalSlots = snapshot.meta.archiveSlotsPerPage || 16;
        const pageSlots = snapshot.pages[String(currentPage)] || [];
        const fillCount = pageSlots.filter(Boolean).length;
        const fillPct = Math.round((fillCount / totalSlots) * 100);
        const isFull = fillCount >= totalSlots;
        if (refs.fillBar) {
            refs.fillBar.style.width = `${fillPct}%`;
            refs.fillBar.classList.toggle('is-full', isFull);
        }
        if (refs.fillCount) {
            refs.fillCount.textContent = `${fillCount}/${totalSlots}`;
            refs.fillCount.classList.toggle('is-full', isFull);
        }
        refs.sortChips?.forEach((chip) => {
            chip.classList.toggle('is-active', chip.dataset.storageSortKey === activeArchiveSortKey);
        });

        if (selectedCanonicalId) {
            const record = snapshot.recordsById[selectedCanonicalId] || null;
            if (!record) {
                closeDetail();
            } else {
                renderDetail(record);
            }
        }
    }

    function setPage(page) {
        const snapshot = repository.getSnapshot();
        currentPage = clampPageNumber(page, snapshot.meta);
        render();
    }

    function setTab(tab) {
        activeTab = tab;
        const onTeam = tab === 'team';
        if (refs.teamShowcase) refs.teamShowcase.hidden = !onTeam;
        if (refs.pcBox) refs.pcBox.hidden = onTeam;
        refs.tabBtns?.forEach(btn => {
            const isActive = btn.dataset.storageTab === tab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });
    }

    function open() {
        ensureRoot();
        isOpen = true;
        root.hidden = false;
        root.classList.add('is-open');
        root.removeAttribute('inert');
        // Toujours s'ouvrir sur l'onglet Équipe — c'est l'info prioritaire
        setTab('team');
        // Re-normalize every time the panel opens — catches stale
        // localStorage offsets from a different viewport size
        panelLayout = normalizePanelLayout(panelLayout || {});
        applyPanelLayout();
        // drag actions are shown/hidden by startDrag/clearDrag, not open/close
        onVisibilityChange?.(true);
    }

    function close() {
        if (!root) {
            return;
        }
        cancelPress();
        clearDrag();
        closeDetail();
        closeSellModal();
        // drag actions are already hidden (clearDrag was called above)
        isOpen = false;
        root.classList.remove('is-open');
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        root.setAttribute('inert', '');
        root.hidden = true;
        onVisibilityChange?.(false);
    }

    function toggle() {
        if (isOpen) {
            close();
            return;
        }
        open();
    }

    function destroy() {
        cancelPress();
        clearDrag();
        closeDetail();
        unsubscribe?.();
        unsubscribe = null;
        globalThis.removeEventListener('resize', applyPanelLayout);
        globalThis.visualViewport?.removeEventListener('resize', applyPanelLayout);
        globalThis.visualViewport?.removeEventListener('scroll', applyPanelLayout);
        panelDrag = null;
        panelResize = null;
        detailPanelDrag = null;
        detailPanelResize = null;
        globalThis.removeEventListener('pointermove', onDetailPointerMove);
        globalThis.removeEventListener('pointerup',   onDetailPointerUp);
        globalThis.removeEventListener('pointercancel', onDetailPointerUp);
        detailSandbox.destroy();
        refs.dragActions?.remove();
        root?.remove();
        refs = {};
        root = null;
        isOpen = false;
        selectedCanonicalId = null;
        pendingSell = null;
        pendingBoxSelection = null;
        onVisibilityChange?.(false);
    }

    function onRootKeyDown(event) {
        if (event.key !== 'Enter') {
            return;
        }

        const renameInput = event.target.closest?.('[data-storage-detail-name-input]');
        if (renameInput) {
            event.preventDefault();
            saveDetailName();
            return;
        }

        const boxInput = event.target.closest?.('[data-storage-box-number-input]');
        if (boxInput) {
            event.preventDefault();
            confirmBoxInputSelection();
        }
    }

    function onRootClick(event) {
        const tabTrigger = event.target.closest?.('[data-storage-tab]');
        if (tabTrigger) {
            setTab(tabTrigger.dataset.storageTab);
            return;
        }

        const closeTrigger = event.target.closest?.('[data-storage-detail-close]');
        if (closeTrigger) {
            closeDetail();
            return;
        }

        const renameTrigger = event.target.closest?.('[data-storage-detail-save-name]');
        if (renameTrigger) {
            saveDetailName();
            return;
        }

        const sellCancelTrigger = event.target.closest?.('[data-storage-sell-cancel]');
        if (sellCancelTrigger) {
            closeSellModal();
            return;
        }

        const sellConfirmTrigger = event.target.closest?.('[data-storage-sell-confirm]');
        if (sellConfirmTrigger) {
            confirmSell();
            return;
        }

        const boxCancelTrigger = event.target.closest?.('[data-storage-box-cancel]');
        if (boxCancelTrigger) {
            cancelBoxSelection();
            return;
        }

        const boxConfirmTrigger = event.target.closest?.('[data-storage-box-confirm]');
        if (boxConfirmTrigger) {
            confirmBoxInputSelection();
            return;
        }

        const sortTrigger = event.target.closest?.('[data-storage-sort-key]');
        if (sortTrigger) {
            applyArchiveSort(sortTrigger.dataset.storageSortKey || 'rarity');
        }
    }

    function onPointerDown(event) {
        if (!isOpen || event.button > 0) {
            return;
        }

        // Ne pas intercepter les clics quand la modale de détail est ouverte
        if (refs.detailModal && !refs.detailModal.hidden) {
            return;
        }

        const slot = event.target.closest?.('[data-storage-slot="true"]');
        if (!slot || !root?.contains(slot)) {
            return;
        }

        event.preventDefault();

        const placement = placementFromSlot(slot);
        if (!placement) {
            return;
        }

        const canonicalId = slot.dataset.canonicalId || null;
        activePress = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            slot,
            placement,
            canonicalId,
            longPressFired: false,
            timerId: canonicalId ? globalThis.setTimeout(() => startDrag(event, slot, placement, canonicalId), LONG_PRESS_MS) : null,
        };

        bindGlobalPointerListeners();
    }

    function bindGlobalPointerListeners() {
        globalThis.addEventListener('pointermove', onGlobalPointerMove, { passive: true });
        globalThis.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
        globalThis.addEventListener('pointercancel', onGlobalPointerCancel, { passive: true });
    }

    function unbindGlobalPointerListeners() {
        globalThis.removeEventListener('pointermove', onGlobalPointerMove, { passive: true });
        globalThis.removeEventListener('pointerup', onGlobalPointerUp, { passive: false });
        globalThis.removeEventListener('pointercancel', onGlobalPointerCancel, { passive: true });
    }

    function onGlobalPointerMove(event) {
        if (activeDrag) {
            updateDrag(event);
            return;
        }

        if (!activePress || activePress.pointerId !== event.pointerId) {
            return;
        }

        const moved = Math.hypot(event.clientX - activePress.startX, event.clientY - activePress.startY);
        if (moved > PRESS_CANCEL_DISTANCE_PX) {
            cancelPress();
        }
    }

    function onGlobalPointerUp(event) {
        if (activeDrag) {
            event.preventDefault();
            finishDrag(event);
            return;
        }

        if (!activePress || activePress.pointerId !== event.pointerId) {
            return;
        }

        const press = activePress;
        cancelPress();
        if (press.longPressFired) {
            return;
        }

        if (press.canonicalId) {
            openDetail(press.canonicalId);
        }
    }

    function onGlobalPointerCancel(event) {
        if ((activeDrag && activeDrag.pointerId === event.pointerId) || (activePress && activePress.pointerId === event.pointerId)) {
            cancelPress();
            clearDrag();
        }
    }

    function cancelPress() {
        if (activePress?.timerId) {
            clearTimeout(activePress.timerId);
        }
        activePress = null;
        if (!activeDrag) {
            unbindGlobalPointerListeners();
        }
    }

    function startDrag(event, slot, placement, canonicalId) {
        if (!activePress || activePress.pointerId !== event.pointerId || !canonicalId) {
            return;
        }

        activePress.longPressFired = true;
        closeDetail();
        const snapshot = repository.getSnapshot();
        const record = snapshot.recordsById[canonicalId] || null;
        if (!record) {
            clearDrag();
            cancelPress();
            return;
        }

        const ghost = createDragGhost(record);
        activeDrag = {
            pointerId: event.pointerId,
            sourcePlacement: placement,
            sourceCanonicalId: canonicalId,
            sourceSlot: slot,
            ghost,
            activeTargetElement: null,
            activeTargetPlacement: null,
        };

        slot.classList.add('is-drag-source');
        root?.classList.add('is-dragging');
        positionGhost(ghost, event.clientX, event.clientY);
        configureDragActionZones(placement, record);
        refs.dragActions?.removeAttribute('hidden');
        positionDragActions();
    }

    function updateDrag(event) {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
        }

        positionGhost(activeDrag.ghost, event.clientX, event.clientY);
        const hitElement = document.elementFromPoint(event.clientX, event.clientY);
        const actionZoneEl = hitElement?.closest?.('[data-storage-action-zone]') || null;
        const actionZoneType = actionZoneEl?.dataset?.storageActionZone || null;
        setActiveActionZone(actionZoneEl, actionZoneType);
        const targetSlot = actionZoneEl ? null : (hitElement?.closest?.('[data-storage-slot="true"]') || null);
        setActiveDropTarget(targetSlot);
    }

    function finishDrag(event) {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
        }

        const hitElement = document.elementFromPoint(event.clientX, event.clientY);
        const actionZoneEl = hitElement?.closest?.('[data-storage-action-zone]') || null;
        const actionZoneType = actionZoneEl?.dataset?.storageActionZone || null;
        const dropTarget = actionZoneEl ? null : (hitElement?.closest?.('[data-storage-slot="true"]') || activeDrag.activeTargetElement);
        const sourcePlacement = activeDrag.sourcePlacement;
        const sourceCanonicalId = activeDrag.sourceCanonicalId;
        const targetPlacement = placementFromSlot(dropTarget);

        if (actionZoneType === 'sell' && sourceCanonicalId) {
            const snapshot = repository.getSnapshot();
            const record = snapshot.recordsById[sourceCanonicalId] || null;
            clearDrag();
            cancelPress();
            if (record) {
                openSellModal({ canonicalId: sourceCanonicalId, record });
            }
            return;
        }

        if (actionZoneType === 'move' && sourceCanonicalId) {
            const snapshot = repository.getSnapshot();
            const isFromTeam = sourcePlacement.kind === 'team';
            const destination = isFromTeam
                ? findFirstEmptyArchivePlacement(snapshot)
                : findFirstEmptyTeamPlacement(snapshot);
            clearDrag();
            cancelPress();
            if (!destination) {
                showActionFeedback(isFromTeam ? 'archive_full' : 'team_full');
            } else {
                repository.transact((draft) => {
                    moveOrSwapCanonicalInSnapshot(draft, { from: sourcePlacement, to: destination });
                    return draft;
                }, { type: 'storage:reorder', from: sourcePlacement, to: destination });
                // Switcher sur l'onglet de destination pour confirmer visuellement
                if (isFromTeam) {
                    setPage(destination.page);
                    setTab('archive');
                } else {
                    setTab('team');
                }
            }
            return;
        }

        if (targetPlacement) {
            repository.transact((draft) => {
                moveOrSwapCanonicalInSnapshot(draft, {
                    from: sourcePlacement,
                    to: targetPlacement,
                });
                return draft;
            }, {
                type: 'storage:reorder',
                from: sourcePlacement,
                to: targetPlacement,
            });
        }

        clearDrag();
        cancelPress();
    }

    function clearDrag() {
        if (activeDrag?.sourceSlot) {
            activeDrag.sourceSlot.classList.remove('is-drag-source');
        }
        if (activeDrag?.activeTargetElement) {
            activeDrag.activeTargetElement.classList.remove('is-drag-target');
        }
        refs.moveZone?.classList.remove('is-active', 'is-full');
        refs.sellZone?.classList.remove('is-active');
        refs.dragActions?.setAttribute('hidden', '');
        activeDrag?.ghost?.remove();
        activeDrag = null;
        root?.classList.remove('is-dragging');
        unbindGlobalPointerListeners();
    }

    function setActiveDropTarget(slotElement) {
        if (!activeDrag) {
            return;
        }

        const placement = placementFromSlot(slotElement);
        const sameTarget = placement
            && activeDrag.activeTargetPlacement
            && placement.kind === activeDrag.activeTargetPlacement.kind
            && placement.slotIndex === activeDrag.activeTargetPlacement.slotIndex
            && (placement.page || null) === (activeDrag.activeTargetPlacement.page || null);

        if (sameTarget) {
            return;
        }

        activeDrag.activeTargetElement?.classList.remove('is-drag-target');
        activeDrag.activeTargetElement = null;
        activeDrag.activeTargetPlacement = null;

        if (!slotElement || !placement) {
            return;
        }

        activeDrag.activeTargetElement = slotElement;
        activeDrag.activeTargetPlacement = placement;
        slotElement.classList.add('is-drag-target');
    }

    function setActiveActionZone(zoneElement, zoneType) {
        if (!activeDrag) {
            return;
        }

        refs.moveZone?.classList.toggle('is-active', zoneType === 'move');
        refs.sellZone?.classList.toggle('is-active', zoneType === 'sell');

        if (zoneType === 'move' && refs.moveHint) {
            const snapshot = repository.getSnapshot();
            const isFromTeam = activeDrag.sourcePlacement.kind === 'team';
            const isFull = isFromTeam
                ? !findFirstEmptyArchivePlacement(snapshot)
                : !findFirstEmptyTeamPlacement(snapshot);
            refs.moveZone?.classList.toggle('is-full', isFull);
            refs.moveHint.textContent = isFull
                ? t(isFromTeam ? 'storage.action_archive_full' : 'storage.action_team_full')
                : '';
        } else if (refs.moveHint) {
            refs.moveHint.textContent = '';
            refs.moveZone?.classList.remove('is-full');
        }
    }

    function findFirstEmptyArchivePlacement(snapshot) {
        const maxPages = snapshot.meta?.unlockedPages || snapshot.meta?.maxPages || 1;
        const slotsPerPage = snapshot.meta?.archiveSlotsPerPage || 16;
        for (let page = 1; page <= maxPages; page++) {
            const slots = snapshot.pages[String(page)] || [];
            let slotIndex = slots.findIndex((v) => !v);
            if (slotIndex < 0 && slots.length < slotsPerPage) {
                slotIndex = slots.length;
            }
            if (slotIndex >= 0) {
                return { kind: 'archive', page, slotIndex };
            }
        }
        return null;
    }

    function findFirstEmptyTeamPlacement(snapshot) {
        const maxTeamSize = snapshot.meta?.teamSlotCount || 4;
        const slots = snapshot.teamSlots || [];
        let slotIndex = slots.findIndex((v) => !v);
        if (slotIndex < 0 && slots.length < maxTeamSize) {
            slotIndex = slots.length;
        }
        return slotIndex >= 0 ? { kind: 'team', slotIndex } : null;
    }

    function computeSellValue(record) {
        const cost = computeAcquisitionCost(record);
        return Math.max(1, Math.floor(cost * 0.5));
    }

    function positionDragActions() {
        if (!refs.dragActions || !root) {
            return;
        }
        const panelRect = root.getBoundingClientRect();
        const navEl = document.querySelector('[data-nav-shell]');
        const navTop = navEl ? navEl.getBoundingClientRect().top : window.innerHeight;
        const MARGIN = 6;

        // Ensure element is in DOM so offsetHeight is accurate
        const actH = refs.dragActions.offsetHeight || 60;
        const actW = refs.dragActions.offsetWidth  || 160;
        const vp   = getViewportSize();

        // Default: just below the panel
        let top = panelRect.bottom + MARGIN;

        // If would overlap navbar, move up
        if (top + actH + MARGIN > navTop) {
            top = navTop - actH - MARGIN;
        }
        // If still inside the panel (panel is huge), overlap panel bottom instead
        if (top < panelRect.top) {
            top = panelRect.bottom - actH - MARGIN;
        }

        // Center on panel, clamped to viewport
        let left = panelRect.left + (panelRect.width - actW) / 2;
        left = clamp(left, MARGIN, vp.width - actW - MARGIN);

        refs.dragActions.style.top       = `${Math.round(top)}px`;
        refs.dragActions.style.left      = `${Math.round(left)}px`;
        refs.dragActions.style.transform = 'none';
    }

    function configureDragActionZones(placement, record) {
        const isFromTeam = placement.kind === 'team';

        if (refs.moveZone) {
            const label = t(isFromTeam ? 'storage.action_store_label' : 'storage.action_team_label');
            const aria  = t(isFromTeam ? 'storage.action_store_aria'  : 'storage.action_team_aria');
            if (refs.moveLabel) refs.moveLabel.textContent = label;
            refs.moveZone.setAttribute('aria-label', aria);
            const icon = refs.moveZone.querySelector('[data-storage-move-icon]');
            if (icon) icon.textContent = isFromTeam ? '📦' : '⚔️';
        }

        if (refs.sellPrice && record) {
            const value = computeSellValue(record);
            refs.sellPrice.textContent = `+${value} ◆`;
        }
    }

    function showActionFeedback(reason) {
        const msgKey = reason === 'team_full' ? 'storage.action_team_full' : 'storage.action_archive_full';
        const el = refs.dragActions;
        if (!el) return;
        el.removeAttribute('hidden');
        el.classList.add('is-feedback');
        el.dataset.feedbackMsg = t(msgKey);
        const timer = setTimeout(() => {
            el.classList.remove('is-feedback');
            delete el.dataset.feedbackMsg;
        }, 2200);
        // store timer so destroy() can clear it
        if (!root._feedbackTimers) root._feedbackTimers = [];
        root._feedbackTimers.push(timer);
    }

    function createDragGhost(record) {
        const ghost = document.createElement('div');
        ghost.className = 'storage-drag-ghost';
        ghost.innerHTML = `
            ${buildCanonicalPortraitSvg(record, {
                size: 80,
                className: 'storage-canonical-portrait storage-canonical-portrait--ghost',
                variant: 'slot',
                includeGlow: true,
            })}
            <div class="storage-drag-ghost__label">${escapeHtml(record.displayName || record.storageDisplay?.label || 'Specimen')}</div>
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    function positionGhost(ghost, clientX, clientY) {
        if (!ghost) {
            return;
        }
        ghost.style.left = `${clientX}px`;
        ghost.style.top = `${clientY}px`;
    }

    function applyArchiveSort(sortKey = 'rarity') {
        activeArchiveSortKey = sortKey;
        // Flash animation on the active chip
        const chip = refs.sortChips?.find((c) => c.dataset.storageSortKey === sortKey);
        if (chip) {
            chip.classList.remove('is-sorting');
            void chip.offsetWidth; // force reflow
            chip.classList.add('is-sorting');
            chip.addEventListener('animationend', () => chip.classList.remove('is-sorting'), { once: true });
        }
        repository.transact((draft) => {
            sortArchiveInSnapshot(draft, { sortKey });
            return draft;
        }, {
            type: 'storage:sort-archive',
            sortKey,
        });
    }

    function openDetail(canonicalId) {
        ensureRoot();
        const snapshot = repository.getSnapshot();
        const record = snapshot.recordsById[canonicalId] || null;
        if (!record || !refs.detailModal) {
            return;
        }

        const detailWasClosed = refs.detailModal.hidden;
        if (detailWasClosed) {
            inspectionBridge?.suspendSourceRuntime?.();
        }

        selectedCanonicalId = canonicalId;
        renderDetail(record);
        refs.detailModal.hidden = false;
        refs.detailModal.removeAttribute('inert');
        applyDetailLayout();
    }

    function closeDetail() {
        if (!refs.detailModal) {
            return;
        }
        const detailWasOpen = !refs.detailModal.hidden;
        selectedCanonicalId = null;
        refs.detailModal.hidden = true;
        refs.detailModal.setAttribute('inert', '');
        detailSandbox.destroy();
        refs.detailContent?.replaceChildren();
        if (detailWasOpen) {
            inspectionBridge?.resumeSourceRuntime?.();
        }
    }

    function renderDetail(record) {
        if (!refs.detailContent || !refs.detailTitle) {
            return;
        }

        const snapshot = repository.getSnapshot();
        const currentPlacement = resolvePlacement(snapshot, selectedCanonicalId);

        refs.detailTitle.textContent = record.displayName || record.storageDisplay?.label || 'Specimen';
        const display = record.storageDisplay || {};
        const genome = record.proceduralCore?.genome || {};
        const rarityTier = display.rarityTier || 'common';

        // Apply rarity theming to the dialog itself
        const dialog = refs.detailModal?.querySelector?.('.storage-detail-modal__dialog');
        if (dialog) {
            dialog.dataset.rarityTier = rarityTier;
        }

        // Tags displayed as overlay badges inside the viewer
        const rarityTag = display.rarity ? `<span class="storage-detail-modal__tag storage-detail-modal__tag--rarity">${escapeHtml(String(display.rarity))}</span>` : '';
        const levelTag = display.level !== undefined ? `<span class="storage-detail-modal__tag storage-detail-modal__tag--level">Nv.${escapeHtml(String(display.level))}</span>` : '';
        const typeTag = (display.typeLabel || record.speciesKey) ? `<span class="storage-detail-modal__tag">${escapeHtml(String(display.typeLabel || record.speciesKey))}</span>` : '';

        detailSandbox.destroy();
        refs.detailContent.innerHTML = `
            <section class="storage-detail-modal__top">
                <div class="storage-detail-modal__viewer-frame">
                    <!-- Rarity accent bar across the top -->
                    <div class="storage-detail-modal__rarity-bar"></div>
                    <!-- Live slime sandbox -->
                    <div class="storage-detail-modal__visual-stage storage-detail-modal__visual-stage--live" data-storage-live-stage></div>
                    <!-- Badges overlaid at the bottom of the viewer -->
                    <div class="storage-detail-modal__viewer-badges">
                        ${rarityTag}${levelTag}${typeTag}
                    </div>
                </div>
                <div class="storage-detail-modal__rename-row">
                    <input class="storage-detail-modal__name-input" type="text" maxlength="32" placeholder="${t('storage.specimen_name_ph')}" value="${escapeHtml(record.displayName || '')}" data-storage-detail-name-input>
                    <button type="button" class="storage-detail-modal__save" data-storage-detail-save-name aria-label="${t('storage.save_name_aria')}">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </section>

            <section class="storage-detail-modal__info-grid">
                <article class="storage-detail-modal__card">
                    <h4>${t('storage.detail.section_appearance')}</h4>
                    <dl class="storage-detail-modal__kv">
                        ${renderKeyValue(t('storage.detail.key_shape'), display.bodyShape || genome.bodyShape)}
                        ${renderKeyValue(t('storage.detail.key_eyes'), genome.eyeStyle)}
                        ${renderKeyValue(t('storage.detail.key_mouth'), genome.mouthStyle)}
                        ${renderKeyValue(t('storage.detail.key_mood'), display.mood || genome.mood)}
                        ${renderKeyValue(t('storage.detail.key_accessory'), display.accessory || genome.accessory)}
                        ${renderKeyValue(t('storage.detail.key_pattern'), genome.colorPattern)}
                        ${genome.rarityScore !== undefined ? renderKeyValue(t('storage.detail.key_rarity_score'), Math.round(genome.rarityScore) + ' / 100') : ''}
                    </dl>
                </article>
                <article class="storage-detail-modal__card">
                    <h4>${t('storage.detail.section_character')}</h4>
                    <dl class="storage-detail-modal__kv">
                        ${renderKeyValue(t('storage.detail.key_archetype'), record.livingState?.cognition?.archetype)}
                        ${renderKeyValue(t('storage.detail.key_consciousness'), record.livingState?.cognition?.consciousnessTier)}
                        ${renderKeyValue(t('storage.detail.key_mood'), record.livingState?.cognition?.baselineMood)}
                        ${renderKeyValue(t('storage.detail.key_cycle'), record.livingState?.continuity?.lifecycleStage)}
                        ${renderKeyValue(t('storage.detail.key_acquired'), record.acquiredAt ? String(record.acquiredAt).slice(0, 10) : null)}
                    </dl>
                </article>
            </section>

            ${Object.keys(record.proceduralCore?.stats || {}).length > 0 ? `
            <section class="storage-detail-modal__stats-section">
                <h4 class="storage-detail-modal__stats-title">${t('storage.detail.section_stats')}</h4>
                <div class="storage-detail-modal__stat-list">${renderStatRows(record.proceduralCore?.stats || {})}</div>
            </section>` : ''}

            ${Object.keys(record.livingState?.cognition?.mentalAxes || {}).length > 0 ? `
            <section class="storage-detail-modal__stats-section">
                <h4 class="storage-detail-modal__stats-title">${t('storage.detail.section_mental')}</h4>
                <div class="storage-detail-modal__stat-list">${renderStatRows(record.livingState?.cognition?.mentalAxes || {})}</div>
            </section>` : ''}

            <section class="storage-detail-modal__actions">
                ${currentPlacement?.kind === 'team' ? `
                    <button type="button" class="storage-detail-modal__action-btn" data-storage-detail-move>
                        <span class="storage-detail-modal__action-icon">📦</span>
                        ${t('storage.action_store_label')}
                    </button>
                ` : `
                    <button type="button" class="storage-detail-modal__action-btn" data-storage-detail-move>
                        <span class="storage-detail-modal__action-icon">🚚</span>
                        ${t('storage.action_move_label') || 'Ranger'}
                    </button>
                `}
                <button type="button" class="storage-detail-modal__action-btn storage-detail-modal__action-btn--danger" data-storage-detail-sell>
                    <span class="storage-detail-modal__action-icon">🛒</span>
                    ${t('storage.sell_label')}
                </button>
            </section>
        `;

        const liveStage = refs.detailContent.querySelector('[data-storage-live-stage]');
        if (liveStage) {
            detailSandbox.mount(liveStage, record);
        }
    }

    function openSellModal({ canonicalId, record }) {
        if (!refs.sellModal || !refs.sellCopy || !canonicalId || !record) {
            return;
        }

        const sellValue = computeSellValue(record);
        pendingSell = { canonicalId, sellValue };

        // Populate subject line with name + rarity badge
        if (refs.sellSubject) {
            const rarityTier = record.storageDisplay?.rarityTier || 'common';
            const rarityLabel = record.storageDisplay?.rarity || '';
            refs.sellSubject.innerHTML = `
                <span class="storage-confirm-modal__subject-name">${escapeHtml(record.displayName || record.storageDisplay?.label || 'Ce slime')}</span>
                ${rarityLabel ? `<span class="storage-confirm-modal__subject-rarity" data-rarity-tier="${escapeHtml(rarityTier)}">${escapeHtml(rarityLabel)}</span>` : ''}
            `;
        }

        refs.sellCopy.textContent = t('storage.irreversible');

        // Show sell value in the confirm button
        const confirmBtn = refs.sellModal.querySelector('[data-storage-sell-confirm]');
        if (confirmBtn) {
            confirmBtn.textContent = `${t('storage.sell_confirm')} (+${sellValue} ◆)`;
        }

        refs.sellModal.hidden = false;
        refs.sellModal.setAttribute('aria-hidden', 'false');
        refs.sellModal.removeAttribute('inert');
    }

    function closeSellModal() {
        pendingSell = null;
        if (!refs.sellModal) {
            return;
        }
        refs.sellModal.hidden = true;
        refs.sellModal.setAttribute('aria-hidden', 'true');
        refs.sellModal.setAttribute('inert', '');
    }

    function confirmSell() {
        if (!pendingSell?.canonicalId) {
            closeSellModal();
            return;
        }

        const canonicalId = pendingSell.canonicalId;
        const sellValue = pendingSell.sellValue || 0;

        if (selectedCanonicalId === canonicalId) {
            closeDetail();
        }

        repository.transact((draft) => {
            removeCanonicalRecordInSnapshot(draft, { canonicalId });
            return draft;
        }, {
            type: 'storage:sell',
            canonicalId,
        });

        if (sellValue > 0 && store) {
            store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: sellValue } });
        }

        closeSellModal();
    }

    // --- BOX SELECTION ---

    function requestBoxSelection() {
        return new Promise((resolve) => {
            pendingBoxSelection = { resolve };
            openBoxModal();
        });
    }

    function confirmBoxInputSelection() {
        if (!refs.boxNumberInput) return;
        const raw = refs.boxNumberInput.value.trim();
        const page = parseInt(raw, 10);
        const snapshot = repository.getSnapshot();
        const maxPages = snapshot.meta?.maxPages || 99;

        // Validate range
        if (!Number.isInteger(page) || page < 1 || page > Math.min(99, maxPages)) {
            showBoxError(t('storage.box_invalid'));
            return;
        }

        // Check if target page is full
        const slotsPerPage = snapshot.meta?.archiveSlotsPerPage || 16;
        const pageSlots = snapshot.pages[String(page)] || [];
        const emptySlot = pageSlots.findIndex((v) => !v);
        const isFull = emptySlot < 0 && pageSlots.length >= slotsPerPage;

        if (isFull) {
            showBoxError(t('storage.box_full_error'));
            return;
        }

        const resolve = pendingBoxSelection?.resolve;
        pendingBoxSelection = null;
        closeBoxModal();
        if (resolve) resolve({ page });
    }

    function showBoxError(msg) {
        if (!refs.boxError) return;
        refs.boxError.textContent = msg;
        refs.boxError.hidden = false;
    }

    function cancelBoxSelection() {
        const resolve = pendingBoxSelection?.resolve;
        pendingBoxSelection = null;
        closeBoxModal();
        if (resolve) resolve(null);
    }

    function openBoxModal() {
        ensureRoot();
        // Reset input and error on open
        if (refs.boxNumberInput) refs.boxNumberInput.value = '';
        if (refs.boxError) { refs.boxError.textContent = ''; refs.boxError.hidden = true; }
        refs.boxModal.hidden = false;
        refs.boxModal.setAttribute('aria-hidden', 'false');
        refs.boxModal.removeAttribute('inert');
        // Auto-focus the input
        setTimeout(() => refs.boxNumberInput?.focus(), 80);
    }

    function closeBoxModal() {
        if (!refs.boxModal) return;
        refs.boxModal.hidden = true;
        refs.boxModal.setAttribute('aria-hidden', 'true');
        refs.boxModal.setAttribute('inert', '');
    }

    function saveDetailName() {
        if (!selectedCanonicalId || !refs.detailContent) {
            return;
        }

        const input = refs.detailContent.querySelector('[data-storage-detail-name-input]');
        const value = String(input?.value || '').trim();
        if (!value) {
            input?.focus();
            return;
        }

        repository.transact((draft) => {
            renameCanonicalRecordInSnapshot(draft, {
                canonicalId: selectedCanonicalId,
                displayName: value,
            });
            return draft;
        }, {
            type: 'storage:rename',
            canonicalId: selectedCanonicalId,
            displayName: value,
        });
    }

    return {
        open,
        close,
        toggle,
        setPage,
        render,
        destroy,
        requestBoxSelection,
        get isOpen() {
            return isOpen;
        },
    };
}

function placementFromSlot(slot) {
    if (!slot) {
        return null;
    }

    return normalizePlacement({
        kind: slot.dataset.slotKind,
        page: slot.dataset.slotPage ? Number(slot.dataset.slotPage) : null,
        slotIndex: Number(slot.dataset.slotIndex),
    });
}

function resolvePlacement(snapshot, canonicalId) {
    if (!snapshot || !canonicalId) return null;
    const teamIndex = (snapshot.teamSlots || []).indexOf(canonicalId);
    if (teamIndex >= 0) return { kind: 'team', slotIndex: teamIndex };
    
    for (const [pageStr, pageSlots] of Object.entries(snapshot.pages || {})) {
        if (!Array.isArray(pageSlots)) continue;
        const archiveIndex = pageSlots.indexOf(canonicalId);
        if (archiveIndex >= 0) return { kind: 'archive', page: parseInt(pageStr, 10), slotIndex: archiveIndex };
    }
    return null;
}

// Fields that are metadata, not display stats
const STAT_META_FIELDS = new Set(['schemaVersion', 'rarityTier', 'rarityScore']);

function renderStatRows(stats) {
    if (!stats || typeof stats !== 'object') {
        return '<div class="storage-detail-modal__stat-row is-empty"><span>—</span></div>';
    }

    const entries = Object.entries(stats)
        .filter(([key, value]) => value !== undefined && !STAT_META_FIELDS.has(key))
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
        return '<div class="storage-detail-modal__stat-row is-empty"><span>—</span></div>';
    }

    return entries.map(([key, value]) => renderStatBar(key, value)).join('');
}

function renderStatBar(label, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return `
            <div class="storage-detail-modal__stat-row">
                <span class="storage-detail-modal__stat-label">${escapeHtml(humanize(label))}</span>
                <span class="storage-detail-modal__stat-value">${escapeHtml(formatValue(value))}</span>
            </div>
        `;
    }

    const percent = Math.max(0, Math.min(100, numeric));
    // Color-coded gradient: teal (high) → blue (mid) → amber (low)
    const barGradient = percent >= 65
        ? 'linear-gradient(90deg,rgba(16,185,129,.55),rgba(52,211,153,.9))'
        : percent >= 30
            ? 'linear-gradient(90deg,rgba(59,130,246,.55),rgba(99,179,237,.9))'
            : 'linear-gradient(90deg,rgba(245,158,11,.55),rgba(251,191,36,.9))';
    return `
        <div class="storage-detail-modal__stat-row">
            <div class="storage-detail-modal__stat-head">
                <span class="storage-detail-modal__stat-label">${escapeHtml(humanize(label))}</span>
                <span class="storage-detail-modal__stat-value">${escapeHtml(formatValue(numeric))}</span>
            </div>
            <div class="storage-detail-modal__stat-track"><span style="width:${percent}%;background:${barGradient}"></span></div>
        </div>
    `;
}

function renderKeyValue(label, value) {
    return `
        <div class="storage-detail-modal__kv-row">
            <dt>${escapeHtml(humanize(label))}</dt>
            <dd>${escapeHtml(formatValue(value))}</dd>
        </div>
    `;
}

function formatValue(value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (Array.isArray(value)) {
        return value.length ? value.join(', ') : '—';
    }

    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (_error) {
            return '[object]';
        }
    }

    return String(value);
}

function humanize(value) {
    return String(value || '')
        .replaceAll(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeCssNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : String(fallback);
}

function normalizeCssPercent(value, fallback) {
    const numeric = Number(value);
    return `${Number.isFinite(numeric) ? numeric : fallback}%`;
}
