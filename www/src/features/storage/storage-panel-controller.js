import { renderStorageSlots } from './storage-grid-renderer.js';
import { buildCanonicalPortraitSvg } from './storage-canonical-visual-renderer.js';
import { sortArchiveInSnapshot } from './storage-sort-service.js';
import { clampPageNumber } from './storage-pagination-service.js';
import { moveOrSwapCanonicalInSnapshot, normalizePlacement, renameCanonicalRecordInSnapshot, removeCanonicalRecordInSnapshot } from './storage-slot-operations.js';
import { createCanonicalInspectionSandbox } from './storage-canonical-inspection-sandbox.js';

const LONG_PRESS_MS = 260;
const PRESS_CANCEL_DISTANCE_PX = 10;
const STORAGE_PANEL_SESSION_KEY = 'inku.storage.panel.session.v1';
const PANEL_MIN_WIDTH = 286;
const PANEL_MAX_WIDTH = 520;
const PANEL_MIN_HEIGHT = 320;
const PANEL_MAX_HEIGHT = 760;
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

export function createStoragePanelController({ mountTarget, repository, inspectionBridge = null, onVisibilityChange = null, floatingPanel = false }) {
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
    let activePress = null;
    let activeDrag = null;
    let pendingSell = null;
    let panelLayout = normalizePanelLayout(loadPanelSession());
    let panelDrag = null;
    let panelResize = null;
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
        panelResize = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originWidth: panelLayout.width,
            originHeight: panelLayout.height,
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
            panelLayout.width  = panelResize.originWidth  + (event.clientX - panelResize.startX);
            panelLayout.height = panelResize.originHeight + (event.clientY - panelResize.startY);
            // Normalize clamps both size and offset after resize
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

    function buildRoot() {
        root = document.createElement('section');
        root.className = floatingPanel ? 'storage-panel storage-panel--floating' : 'storage-panel';
        root.classList.remove('is-open');
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="storage-panel__surface">
                <header class="storage-panel__header" data-storage-panel-drag-handle>
                    <div>
                        <p class="storage-panel__eyebrow">Collection</p>
                        <h2 class="storage-panel__title">Archive</h2>
                    </div>
                    <button type="button" class="storage-panel__close" data-storage-close aria-label="Fermer l'archive">×</button>
                </header>

                <div class="storage-panel__body" data-storage-scroll-body>

                    <!-- ── ÉQUIPE ACTIVE ────────────────────────────── -->
                    <div class="storage-team-showcase">
                        <div class="storage-team-showcase__label">
                            <span class="storage-team-showcase__dot"></span>
                            Équipe active
                        </div>
                        <div class="storage-team-showcase__slots storage-team-grid" data-storage-team-grid></div>
                    </div>

                    <!-- ── PC BOX ─────────────────────────────────── -->
                    <div class="storage-pc-box">

                        <!-- Nav row : prev · box name · next · sort -->
                        <div class="storage-pc-box__nav-row" role="toolbar" aria-label="Navigation et tri">
                            <button type="button" class="storage-pc-box__nav-btn" data-storage-prev aria-label="Boîte précédente">
                                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true"><path d="M6.5 1.5L1.5 7L6.5 12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </button>
                            <div class="storage-pc-box__box-title">
                                <span class="storage-pc-box__box-word">Boîte</span>
                                <span class="storage-pc-box__box-num" data-storage-page-number>1</span>
                                <span class="storage-pc-box__box-label" data-storage-page-label style="display:none"></span>
                                <div class="storage-pc-box__fill">
                                    <div class="storage-pc-box__fill-track">
                                        <div class="storage-pc-box__fill-bar" data-storage-fill-bar></div>
                                    </div>
                                    <span class="storage-pc-box__fill-count" data-storage-fill-count>0/16</span>
                                </div>
                            </div>
                            <button type="button" class="storage-pc-box__nav-btn" data-storage-next aria-label="Boîte suivante">
                                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true"><path d="M1.5 1.5L6.5 7L1.5 12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </button>
                            <div class="storage-pc-box__sort-chips">
                                <button type="button" class="storage-pc-box__sort-btn is-active" data-storage-sort-key="rarity">Rareté</button>
                                <button type="button" class="storage-pc-box__sort-btn" data-storage-sort-key="level">Niv.</button>
                                <button type="button" class="storage-pc-box__sort-btn" data-storage-sort-key="type">Type</button>
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

                ${floatingPanel ? '<button type="button" class="storage-panel__resize-handle" data-storage-panel-resize aria-label="Redimensionner le storage"></button>' : ''}
            </div>

            <button type="button" class="storage-sell-zone" data-storage-sell-zone aria-label="Panier de revente">
                <span class="storage-sell-zone__icon" aria-hidden="true">🛒</span>
                <span class="storage-sell-zone__label">Revendre</span>
            </button>

            <div class="storage-confirm-modal" data-storage-sell-modal hidden aria-hidden="true">
                <div class="storage-confirm-modal__backdrop" data-storage-sell-cancel></div>
                <section class="storage-confirm-modal__dialog" aria-label="Confirmer la revente">
                    <h3 class="storage-confirm-modal__title">Confirmer la revente</h3>
                    <p class="storage-confirm-modal__copy" data-storage-sell-copy>Ce slime sera retiré du stockage canonique.</p>
                    <div class="storage-confirm-modal__actions">
                        <button type="button" class="storage-confirm-modal__button storage-confirm-modal__button--secondary" data-storage-sell-cancel>Annuler</button>
                        <button type="button" class="storage-confirm-modal__button storage-confirm-modal__button--danger" data-storage-sell-confirm>Revendre</button>
                    </div>
                </section>
            </div>

            <div class="storage-detail-modal" data-storage-detail-modal hidden aria-hidden="true">
                <div class="storage-detail-modal__backdrop" data-storage-detail-close></div>
                <section class="storage-detail-modal__dialog" aria-label="Dossier du slime">
                    <header class="storage-detail-modal__header">
                        <div>
                            <p class="storage-detail-modal__eyebrow">Profil</p>
                            <h3 class="storage-detail-modal__title" data-storage-detail-title>Specimen</h3>
                        </div>
                        <button type="button" class="storage-detail-modal__close" data-storage-detail-close aria-label="Fermer le dossier">×</button>
                    </header>
                    <div class="storage-detail-modal__content" data-storage-detail-content></div>
                </section>
            </div>
        `;

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
            sellZone: root.querySelector('[data-storage-sell-zone]'),
            sellModal: root.querySelector('[data-storage-sell-modal]'),
            sellCopy: root.querySelector('[data-storage-sell-copy]'),
            sortChips: [...root.querySelectorAll('[data-storage-sort-key]')],
            dragHandle: root.querySelector('[data-storage-panel-drag-handle]'),
            resizeHandle: root.querySelector('[data-storage-panel-resize]'),
        };

        refs.closeButton?.addEventListener('click', close);
        refs.dragHandle?.addEventListener('pointerdown', onPanelDragStart);
        refs.resizeHandle?.addEventListener('pointerdown', onPanelResizeStart);
        refs.sellZone?.addEventListener('click', (event) => event.preventDefault());
        refs.prevButton?.addEventListener('click', () => setPage(currentPage - 1));
        refs.nextButton?.addEventListener('click', () => setPage(currentPage + 1));
        root.addEventListener('click', onRootClick);
        root.addEventListener('keydown', onRootKeyDown);
        root.addEventListener('pointerdown', onPointerDown);

        mountTarget.appendChild(root);
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

        refs.pageLabel.textContent = `Page ${currentPage}`;
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

    function open() {
        ensureRoot();
        isOpen = true;
        root.hidden = false;
        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');
        // Re-normalize every time the panel opens — catches stale
        // localStorage offsets from a different viewport size
        panelLayout = normalizePanelLayout(panelLayout || {});
        applyPanelLayout();
        refs.sellZone && (refs.sellZone.hidden = false);
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
        refs.sellZone && (refs.sellZone.hidden = true);
        isOpen = false;
        root.classList.remove('is-open');
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
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
        detailSandbox.destroy();
        root?.remove();
        refs = {};
        root = null;
        isOpen = false;
        selectedCanonicalId = null;
        pendingSell = null;
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
        }
    }

    function onRootClick(event) {
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

        const sortTrigger = event.target.closest?.('[data-storage-sort-key]');
        if (sortTrigger) {
            applyArchiveSort(sortTrigger.dataset.storageSortKey || 'rarity');
        }
    }

    function onPointerDown(event) {
        if (!isOpen || event.button > 0) {
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
    }

    function updateDrag(event) {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
        }

        positionGhost(activeDrag.ghost, event.clientX, event.clientY);
        const hitElement = document.elementFromPoint(event.clientX, event.clientY);
        const sellZone = hitElement?.closest?.('[data-storage-sell-zone]') || null;
        setActiveSellTarget(sellZone);
        const targetSlot = sellZone ? null : (hitElement?.closest?.('[data-storage-slot="true"]') || null);
        setActiveDropTarget(targetSlot);
    }

    function finishDrag(event) {
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
        }

        const hitElement = document.elementFromPoint(event.clientX, event.clientY);
        const sellZone = hitElement?.closest?.('[data-storage-sell-zone]') || null;
        const dropTarget = sellZone ? null : (hitElement?.closest?.('[data-storage-slot="true"]') || activeDrag.activeTargetElement);
        const sourcePlacement = activeDrag.sourcePlacement;
        const sourceCanonicalId = activeDrag.sourceCanonicalId;
        const targetPlacement = placementFromSlot(dropTarget);

        if (sellZone && sourceCanonicalId) {
            const snapshot = repository.getSnapshot();
            const record = snapshot.recordsById[sourceCanonicalId] || null;
            clearDrag();
            cancelPress();
            if (record) {
                openSellModal({ canonicalId: sourceCanonicalId, record });
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
        refs.sellZone?.classList.remove('is-drag-target');
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

    function setActiveSellTarget(sellZoneElement) {
        if (!activeDrag || !refs.sellZone) {
            return;
        }

        refs.sellZone.classList.toggle('is-drag-target', Boolean(sellZoneElement));
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
        refs.detailModal.setAttribute('aria-hidden', 'false');
    }

    function closeDetail() {
        if (!refs.detailModal) {
            return;
        }
        const detailWasOpen = !refs.detailModal.hidden;
        selectedCanonicalId = null;
        refs.detailModal.hidden = true;
        refs.detailModal.setAttribute('aria-hidden', 'true');
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

        refs.detailTitle.textContent = record.displayName || record.storageDisplay?.label || 'Specimen';
        const display = record.storageDisplay || {};
        const genome = record.proceduralCore?.genome || {};

        // Tags: rarity + level only (mood already shown below)
        const rarityTag = display.rarity ? `<span class="storage-detail-modal__tag storage-detail-modal__tag--rarity">${escapeHtml(String(display.rarity))}</span>` : '';
        const levelTag = display.level !== undefined ? `<span class="storage-detail-modal__tag storage-detail-modal__tag--level">Nv.${escapeHtml(String(display.level))}</span>` : '';
        const typeTag = (display.typeLabel || record.speciesKey) ? `<span class="storage-detail-modal__tag">${escapeHtml(String(display.typeLabel || record.speciesKey))}</span>` : '';

        detailSandbox.destroy();
        refs.detailContent.innerHTML = `
            <section class="storage-detail-modal__top">
                <div class="storage-detail-modal__viewer-frame">
                    <div class="storage-detail-modal__visual-stage storage-detail-modal__visual-stage--live" data-storage-live-stage></div>
                </div>
                <div class="storage-detail-modal__identity-strip">
                    <div class="storage-detail-modal__tag-row">
                        ${rarityTag}${levelTag}${typeTag}
                    </div>
                    <div class="storage-detail-modal__rename-row">
                        <input class="storage-detail-modal__name-input" type="text" maxlength="32" placeholder="Nom du spécimen…" value="${escapeHtml(record.displayName || '')}" data-storage-detail-name-input>
                        <button type="button" class="storage-detail-modal__save" data-storage-detail-save-name aria-label="Sauvegarder le nom">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                </div>
            </section>

            <section class="storage-detail-modal__info-grid">
                <article class="storage-detail-modal__card">
                    <h4>Apparence</h4>
                    <dl class="storage-detail-modal__kv">
                        ${renderKeyValue('Forme', display.bodyShape || genome.bodyShape)}
                        ${renderKeyValue('Yeux', genome.eyeStyle)}
                        ${renderKeyValue('Bouche', genome.mouthStyle)}
                        ${renderKeyValue('Humeur', display.mood || genome.mood)}
                        ${renderKeyValue('Accessoire', display.accessory || genome.accessory)}
                        ${renderKeyValue('Motif couleur', genome.colorPattern)}
                        ${genome.rarityScore !== undefined ? renderKeyValue('Score rareté', Math.round(genome.rarityScore) + ' / 100') : ''}
                    </dl>
                </article>
                <article class="storage-detail-modal__card">
                    <h4>Caractère</h4>
                    <dl class="storage-detail-modal__kv">
                        ${renderKeyValue('Archétype', record.livingState?.cognition?.archetype)}
                        ${renderKeyValue('Conscience', record.livingState?.cognition?.consciousnessTier)}
                        ${renderKeyValue('Humeur', record.livingState?.cognition?.baselineMood)}
                        ${renderKeyValue('Cycle', record.livingState?.continuity?.lifecycleStage)}
                        ${renderKeyValue('Acquis', record.acquiredAt ? String(record.acquiredAt).slice(0, 10) : null)}
                    </dl>
                </article>
            </section>

            ${Object.keys(record.proceduralCore?.stats || {}).length > 0 ? `
            <section class="storage-detail-modal__stats-section">
                <h4 class="storage-detail-modal__stats-title">Statistiques</h4>
                <div class="storage-detail-modal__stat-list">${renderStatRows(record.proceduralCore?.stats || {})}</div>
            </section>` : ''}

            ${Object.keys(record.livingState?.cognition?.mentalAxes || {}).length > 0 ? `
            <section class="storage-detail-modal__stats-section">
                <h4 class="storage-detail-modal__stats-title">Axes mentaux</h4>
                <div class="storage-detail-modal__stat-list">${renderStatRows(record.livingState?.cognition?.mentalAxes || {})}</div>
            </section>` : ''}
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

        pendingSell = {
            canonicalId,
        };
        refs.sellCopy.textContent = `${record.displayName || record.storageDisplay?.label || 'Ce slime'} sera retiré du stockage canonique.`;
        refs.sellModal.hidden = false;
        refs.sellModal.setAttribute('aria-hidden', 'false');
    }

    function closeSellModal() {
        pendingSell = null;
        if (!refs.sellModal) {
            return;
        }
        refs.sellModal.hidden = true;
        refs.sellModal.setAttribute('aria-hidden', 'true');
    }

    function confirmSell() {
        if (!pendingSell?.canonicalId) {
            closeSellModal();
            return;
        }

        const canonicalId = pendingSell.canonicalId;
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

        closeSellModal();
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
    return `
        <div class="storage-detail-modal__stat-row">
            <div class="storage-detail-modal__stat-head">
                <span class="storage-detail-modal__stat-label">${escapeHtml(humanize(label))}</span>
                <span class="storage-detail-modal__stat-value">${escapeHtml(formatValue(numeric))}</span>
            </div>
            <div class="storage-detail-modal__stat-track"><span style="width:${percent}%"></span></div>
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
