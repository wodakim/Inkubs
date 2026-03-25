import { t } from '../../i18n/i18n.js';
import { PANEL_MIN_WIDTH, PANEL_MIN_HEIGHT } from './prairie-constants.js';
import { distanceBetween, normalizePanelLayout, saveSession } from './prairie-session.js';
import { screenToWorld, clampCamera, applyEdgeScroll, updateZoom } from './prairie-camera.js';
import { renderDronePanel, applyPanelLayout, hitTestSlime } from './prairie-drone-panel.js';
import { withdrawCanonicalSlime, deployCanonicalSlime, markEntryManipulated } from './prairie-slime-runtime.js';
import { scheduleSessionSave } from './prairie-persistence.js';
import { bindObsInteractions, selectSlimeForObs } from './prairie-obs-panel.js';
import { getNearestInteractiveObject } from './prairie-objects.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';

export function bindInteractions(ctx) {
    if (ctx.interactionsBound || !ctx.canvas || !ctx.droneToggle || !ctx.dronePanel || !ctx.droneTeamGrid || !ctx.droneArchiveGrid || !ctx.minimapCanvas) {
        return;
    }
    ctx.interactionsBound = true;
    
    // Bind the observation panel (loupe/tabs/dragging)
    bindObsInteractions(ctx);

    const closeDrone = () => {
        window.clearTimeout(ctx.dronePanelCloseTimeout);
        ctx.dronePanel.classList.remove('is-open');
        ctx.droneToggle.setAttribute('aria-expanded', 'false');
        ctx.dronePanelCloseTimeout = window.setTimeout(() => {
            if (ctx.dronePanel && !ctx.dronePanel.classList.contains('is-open')) {
                ctx.dronePanel.hidden = true;
            }
        }, 180);
    };

    const openDrone = () => {
        renderDronePanel(ctx);
        applyPanelLayout(ctx);
        window.clearTimeout(ctx.dronePanelCloseTimeout);
        ctx.dronePanel.hidden = false;
        ctx.droneToggle.setAttribute('aria-expanded', 'true');
        window.requestAnimationFrame(() => ctx.dronePanel?.classList.add('is-open'));
    };

    ctx.droneToggle.addEventListener('click', () => {
        if (ctx.dronePanel.hidden) openDrone();
        else closeDrone();
    });
    ctx.droneClose?.addEventListener('click', closeDrone);

    ctx.dronePanelDragHandle?.addEventListener('pointerdown', (event) => {
        if (event.target.closest('[data-prairie-drone-close]') || event.target.closest('[data-prairie-panel-resize]')) return;
        ctx.panelDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: ctx.panelLayout?.offsetX || 0,
            offsetY: ctx.panelLayout?.offsetY || 0,
        };
        ctx.dronePanelDragHandle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }, { passive: false });

    ctx.dronePanelDragHandle?.addEventListener('pointermove', (event) => {
        if (!ctx.panelDrag || ctx.panelDrag.pointerId !== event.pointerId) return;
        ctx.panelLayout = normalizePanelLayout({
            ...ctx.panelLayout,
            offsetX: ctx.panelDrag.offsetX + (event.clientX - ctx.panelDrag.startX),
            offsetY: ctx.panelDrag.offsetY + (event.clientY - ctx.panelDrag.startY),
        });
        applyPanelLayout(ctx);
    }, { passive: true });

    const releasePanelDrag = (event) => {
        if (!ctx.panelDrag || ctx.panelDrag.pointerId !== event.pointerId) return;
        ctx.dronePanelDragHandle?.releasePointerCapture?.(event.pointerId);
        ctx.panelDrag = null;
        saveSession({ activeCanonicalIds: [...ctx.activeCanonicalIds], camera: { ...ctx.camera }, panel: ctx.panelLayout });
    };

    ctx.dronePanelDragHandle?.addEventListener('pointerup', releasePanelDrag, { passive: true });
    ctx.dronePanelDragHandle?.addEventListener('pointercancel', releasePanelDrag, { passive: true });

    ctx.dronePanelResizeHandle?.addEventListener('pointerdown', (event) => {
        ctx.panelResize = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: ctx.panelLayout?.width || PANEL_MIN_WIDTH,
            height: ctx.panelLayout?.height || PANEL_MIN_HEIGHT,
        };
        ctx.dronePanelResizeHandle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }, { passive: false });

    ctx.dronePanelResizeHandle?.addEventListener('pointermove', (event) => {
        if (!ctx.panelResize || ctx.panelResize.pointerId !== event.pointerId) return;
        ctx.panelLayout = normalizePanelLayout({
            ...ctx.panelLayout,
            width: ctx.panelResize.width + (event.clientX - ctx.panelResize.startX),
            height: ctx.panelResize.height + (event.clientY - ctx.panelResize.startY),
        });
        applyPanelLayout(ctx);
    }, { passive: true });

    const releasePanelResize = (event) => {
        if (!ctx.panelResize || ctx.panelResize.pointerId !== event.pointerId) return;
        ctx.dronePanelResizeHandle?.releasePointerCapture?.(event.pointerId);
        ctx.panelResize = null;
        saveSession({ activeCanonicalIds: [...ctx.activeCanonicalIds], camera: { ...ctx.camera }, panel: ctx.panelLayout });
    };

    ctx.dronePanelResizeHandle?.addEventListener('pointerup', releasePanelResize, { passive: true });
    ctx.dronePanelResizeHandle?.addEventListener('pointercancel', releasePanelResize, { passive: true });

    const onDroneSlotClick = (event, mode) => {
        const actionButton = event.target.closest?.('[data-prairie-slot-action]');
        if (!actionButton) return;
        const slot = actionButton.closest?.('[data-storage-slot="true"]');
        if (!slot) return;
        
        const canonicalId = slot.dataset.canonicalId;
        const action = actionButton.dataset.prairieSlotAction;
        if (!canonicalId || action === 'blocked') return;
        
        if (mode === 'team' && action === 'withdraw') {
            withdrawCanonicalSlime(ctx, canonicalId);
        } else if (mode === 'archive' && action === 'deploy') {
            deployCanonicalSlime(ctx, canonicalId);
        }
    };

    ctx.droneTeamGrid.addEventListener('click', (event) => onDroneSlotClick(event, 'team'));
    ctx.droneArchiveGrid.addEventListener('click', (event) => onDroneSlotClick(event, 'archive'));

    ctx.minimapCanvas.addEventListener('pointerdown', (event) => {
        const rect = ctx.minimapCanvas.getBoundingClientRect();
        ctx.camera.x = ((event.clientX - rect.left) / rect.width) * ctx.world.width;
        ctx.camera.y = ((event.clientY - rect.top) / rect.height) * ctx.world.height;
        clampCamera(ctx);
        scheduleSessionSave(ctx, 'prairie_minimap_pan');
    }, { passive: true });

    ctx.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        updateZoom(ctx, ctx.camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08), event.clientX, event.clientY);
        scheduleSessionSave(ctx, 'prairie_zoom');
    }, { passive: false });

    ctx.canvas.addEventListener('pointerdown', (event) => {
        const point = screenToWorld(ctx, event.clientX, event.clientY);
        if (!point) return;
        
        ctx.pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        ctx.canvas.setPointerCapture?.(event.pointerId);
        
        if (ctx.pointers.size === 2) {
            const [first, second] = [...ctx.pointers.values()];
            ctx.pinchAnchor = { distance: distanceBetween(first, second), zoom: ctx.camera.zoom };
            ctx.pointerMode = 'pinch';
            if (ctx.activeDrag) {
                ctx.activeDrag.entry.slime.releaseGrab?.();
                ctx.activeDrag = null;
            }
            return;
        }
        
        const hit = hitTestSlime(ctx, point);
        if (hit) {
            if (ctx.obsLoupeMode || ctx.obsOpen) {
                selectSlimeForObs(ctx, hit.canonicalId);
                return;
            }
            ctx.pointerMode = 'slime-drag';
            ctx.activeDrag = { pointerId: event.pointerId, entry: hit };
            ctx.edgeScrollPointer = { clientX: event.clientX, clientY: event.clientY };
            markEntryManipulated(hit);
            hit.slime.checkGrab?.(point.x, point.y);
            
            ctx._dragStartTime = performance.now();
            ctx._dragStartClientX = event.clientX;
            ctx._dragStartClientY = event.clientY;
            ctx._dragMaxClientDist = 0;
            ctx._dragMaxWorldTension = 0;
            ctx._releaseVelBuf = [];
            
            const _grabCenter = hit.slime.getRawVisualCenter?.();
            ctx._dragWorldStartX = _grabCenter?.x ?? point.x;
            ctx._dragWorldStartY = _grabCenter?.y ?? point.y;
            
            SlimeSoundEngine.playGrab(hit.slime);
            return;
        }
        
        ctx.pointerMode = 'pan';
        ctx.panAnchor = { clientX: event.clientX, clientY: event.clientY, cameraX: ctx.camera.x, cameraY: ctx.camera.y };
    }, { passive: true });

    ctx.canvas.addEventListener('pointermove', (event) => {
        if (!ctx.pointers.has(event.pointerId)) return;
        ctx.pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        
        if (ctx.pointerMode === 'pinch' && ctx.pointers.size >= 2 && ctx.pinchAnchor) {
            const [first, second] = [...ctx.pointers.values()];
            const ratio = Math.max(12, distanceBetween(first, second)) / Math.max(12, ctx.pinchAnchor.distance);
            updateZoom(ctx, ctx.pinchAnchor.zoom * ratio, (first.clientX + second.clientX) * 0.5, (first.clientY + second.clientY) * 0.5);
            scheduleSessionSave(ctx, 'prairie_pinch');
            return;
        }
        
        if (ctx.pointerMode === 'slime-drag' && ctx.activeDrag?.pointerId === event.pointerId) {
            const point = screenToWorld(ctx, event.clientX, event.clientY);
            if (!point) return;
            
            markEntryManipulated(ctx.activeDrag.entry);
            ctx.activeDrag.entry.slime.updateGrab?.(point.x, point.y);
            ctx.edgeScrollPointer = { clientX: event.clientX, clientY: event.clientY };
            
            const dx = event.clientX - ctx._dragStartClientX;
            const dy = event.clientY - ctx._dragStartClientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > ctx._dragMaxClientDist) ctx._dragMaxClientDist = dist;
            
            const slimeCenter = ctx.activeDrag.entry.slime.getRawVisualCenter?.();
            if (slimeCenter) {
                const wdx = point.x - slimeCenter.x;
                const wdy = point.y - slimeCenter.y;
                const tension = Math.sqrt(wdx*wdx + wdy*wdy);
                if (tension > ctx._dragMaxWorldTension) ctx._dragMaxWorldTension = tension;
            }
            
            const now = performance.now();
            ctx._releaseVelBuf.push({ x: point.x, y: point.y, t: now });
            if (ctx._releaseVelBuf.length > 6) ctx._releaseVelBuf.shift();
            
            applyEdgeScroll(ctx, event.clientX, event.clientY);
            return;
        }
        
        if (ctx.pointerMode === 'pan' && ctx.panAnchor) {
            ctx.camera.x = ctx.panAnchor.cameraX - ((event.clientX - ctx.panAnchor.clientX) / ctx.camera.zoom);
            ctx.camera.y = ctx.panAnchor.cameraY - ((event.clientY - ctx.panAnchor.clientY) / ctx.camera.zoom);
            clampCamera(ctx);
            scheduleSessionSave(ctx, 'prairie_pan');
        }
    }, { passive: true });

    const releasePointer = (event) => {
        ctx.pointers.delete(event.pointerId);
        ctx.canvas.releasePointerCapture?.(event.pointerId);
        
        if (ctx.activeDrag?.pointerId === event.pointerId) {
            markEntryManipulated(ctx.activeDrag.entry);
            const dragDuration = performance.now() - ctx._dragStartTime;
            const isPoke = dragDuration < 220 && ctx._dragMaxClientDist < 14;

            if (isPoke) {
                SlimeSoundEngine.playPoke(ctx.activeDrag.entry.slime);
            } else if (ctx._dragMaxWorldTension > 8) {
                let releaseSpeed = 0;
                if (ctx._releaseVelBuf.length >= 2) {
                    const a = ctx._releaseVelBuf[ctx._releaseVelBuf.length - 2];
                    const b = ctx._releaseVelBuf[ctx._releaseVelBuf.length - 1];
                    const dt = Math.max(1, b.t - a.t);
                    const vx = (b.x - a.x) / dt;
                    const vy = (b.y - a.y) / dt;
                    releaseSpeed = Math.sqrt(vx*vx + vy*vy) * 16;
                }
                SlimeSoundEngine.playSpringRelease(ctx._dragMaxWorldTension, releaseSpeed, ctx.activeDrag.entry.slime);
            }
            
            ctx.activeDrag.entry.slime.releaseGrab?.();

            const releaseWorld = ctx._releaseVelBuf.length > 0
                ? { x: ctx._releaseVelBuf[ctx._releaseVelBuf.length - 1].x, y: ctx._releaseVelBuf[ctx._releaseVelBuf.length - 1].y }
                : ctx.activeDrag.entry.slime.getVisualCenter?.() || ctx.activeDrag.entry.slime.getRawVisualCenter?.();
            
            if (releaseWorld) {
                const nearObj = getNearestInteractiveObject(ctx, releaseWorld.x, releaseWorld.y, 130);
                if (nearObj) {
                    ctx.interactionEngine.nudgeTowardObject(
                        ctx.activeDrag.entry.canonicalId,
                        ctx.activeDrag.entry.slime,
                        nearObj
                    );
                }
            }
            
            ctx.activeDrag = null;
            ctx.edgeScrollPointer = null;
            ctx._releaseVelBuf = [];
            scheduleSessionSave(ctx, 'prairie_drag_release');
        }
        
        if (ctx.pointers.size < 2) ctx.pinchAnchor = null;
        if (ctx.pointers.size === 0) {
            ctx.pointerMode = 'idle';
            ctx.panAnchor = null;
        }
    };

    ctx.canvas.addEventListener('pointerup', releasePointer, { passive: true });
    ctx.canvas.addEventListener('pointercancel', releasePointer, { passive: true });
    ctx.canvas.addEventListener('lostpointercapture', releasePointer, { passive: true });
}