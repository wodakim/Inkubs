import { t } from '../../i18n/i18n.js';
import { renderStorageSlots } from '../storage/storage-grid-renderer.js';
import { listRecords, findRecordById, getActiveEntries } from './prairie-slime-runtime.js';
import { MAX_ACTIVE_TRUE_ENGINE } from './prairie-constants.js';
import { normalizePanelLayout } from './prairie-session.js';

export function applyPanelLayout(ctx) {
    if (!ctx.dronePanel) return;
    ctx.panelLayout = normalizePanelLayout(ctx.panelLayout || {});
    ctx.dronePanel.style.setProperty('--prairie-panel-width', `${ctx.panelLayout.width}px`);
    ctx.dronePanel.style.setProperty('--prairie-panel-height', `${ctx.panelLayout.height}px`);
    ctx.dronePanel.style.setProperty('--prairie-panel-offset-x', `${ctx.panelLayout.offsetX}px`);
    ctx.dronePanel.style.setProperty('--prairie-panel-offset-y', `${ctx.panelLayout.offsetY}px`);
}

export function renderDronePanel(ctx) {
    if (!ctx.droneTeamGrid || !ctx.droneArchiveGrid) return;

    const records = listRecords(ctx);
    const activeSet = new Set(ctx.activeCanonicalIds);
    const teamEntries = Array.from({ length: MAX_ACTIVE_TRUE_ENGINE }, (_, slotIndex) => {
        const canonicalId = ctx.activeCanonicalIds[slotIndex] || null;
        const record = canonicalId ? findRecordById(ctx, canonicalId) || ctx.runtimeById.get(canonicalId)?.record || null : null;
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

    renderStorageSlots({ container: ctx.droneTeamGrid, records: teamEntries, slotClassName: 'storage-slot storage-slot--team prairie-drone__slot prairie-drone__slot--team' });
    renderStorageSlots({ container: ctx.droneArchiveGrid, records: archiveEntries, slotClassName: 'storage-slot storage-slot--archive prairie-drone__slot prairie-drone__slot--archive' });

    const decorate = (container, mode) => {
        [...container.querySelectorAll('[data-storage-slot="true"]')].forEach((slot) => {
            const canonicalId = slot.dataset.canonicalId;
            if (!canonicalId) return;
            const action = document.createElement('button');
            action.type = 'button';
            action.className = `prairie-drone__slot-action prairie-drone__slot-action--${mode === 'team' ? 'withdraw' : 'deploy'}`;
            action.dataset.prairieSlotAction = mode === 'team' ? 'withdraw' : 'deploy';
            action.innerHTML = mode === 'team'
                ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
                : '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5.5 4,8 8.5,2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            action.setAttribute('aria-label', mode === 'team' ? t('prairie.remove_slime_aria') : t('prairie.deploy_slime_aria'));
            if (mode === 'archive' && ctx.activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE) {
                action.disabled = true;
                action.dataset.prairieSlotAction = 'blocked';
                action.classList.add('is-blocked');
            }
            slot.appendChild(action);
        });
    };

    decorate(ctx.droneTeamGrid, 'team');
    decorate(ctx.droneArchiveGrid, 'archive');

    if (ctx.droneCap) {
        ctx.droneCap.textContent = String(ctx.activeCanonicalIds.length); 
        const capPill = ctx.root?.querySelector('[data-prairie-cap-pill]'); 
        if (capPill) capPill.textContent = ctx.activeCanonicalIds.length > 0 ? String(ctx.activeCanonicalIds.length) : '·';
    }
    if (ctx.droneArchiveHint) {
        ctx.droneArchiveHint.textContent = ctx.activeCanonicalIds.length >= MAX_ACTIVE_TRUE_ENGINE ? 'MAX' : '';
    }
    if (ctx.emptyState) {
        ctx.emptyState.hidden = records.length > 0;
    }
}

export function renderMinimap(ctx) {
    if (!ctx.minimapCanvas || !ctx.viewport) return;
    const context = ctx.minimapCanvas.getContext('2d');
    if (!context) return;
    const width = ctx.minimapCanvas.width;
    const height = ctx.minimapCanvas.height;
    
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(4, 11, 18, 0.9)';
    context.fillRect(0, 0, width, height);
    
    const padding = 8;
    const scale = Math.min((width - padding * 2) / ctx.world.width, (height - padding * 2) / ctx.world.height);
    const mapWidth = ctx.world.width * scale;
    const mapHeight = ctx.world.height * scale;
    const offsetX = (width - mapWidth) * 0.5;
    const offsetY = (height - mapHeight) * 0.5;
    
    context.fillStyle = 'rgba(66, 126, 123, 0.25)';
    context.fillRect(offsetX, offsetY, mapWidth, mapHeight);
    context.fillStyle = 'rgba(63, 126, 91, 0.8)';
    context.fillRect(offsetX, offsetY + ctx.world.groundY * scale, mapWidth, Math.max(2, mapHeight - ctx.world.groundY * scale));
    context.strokeStyle = 'rgba(155, 255, 190, 0.85)';
    context.lineWidth = 1.4;
    context.strokeRect(offsetX, offsetY, mapWidth, mapHeight);
    
    const viewWorldWidth = ctx.viewport.clientWidth / ctx.camera.zoom;
    const viewWorldHeight = ctx.viewport.clientHeight / ctx.camera.zoom;
    context.strokeStyle = 'rgba(184, 248, 255, 0.95)';
    context.strokeRect(
        offsetX + (ctx.camera.x - viewWorldWidth * 0.5) * scale,
        offsetY + (ctx.camera.y - viewWorldHeight * 0.5) * scale,
        viewWorldWidth * scale,
        viewWorldHeight * scale,
    );
    
    for (const entry of getActiveEntries(ctx)) {
        const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
        if (!center) continue;
        context.fillStyle = 'rgba(92, 255, 122, 0.95)';
        context.beginPath();
        context.arc(offsetX + center.x * scale, offsetY + center.y * scale, 3.5, 0, Math.PI * 2);
        context.fill();
    }
    
    for (const obj of ctx.prairieObjects) {
        if (!obj.interactive) continue;
        const dotColor = obj.type === 'ball' ? 'rgba(255,200,80,0.7)'
            : obj.type === 'rock' ? 'rgba(140,140,160,0.5)'
            : obj.type === 'flower' ? 'rgba(255,120,180,0.5)'
            : obj.type === 'bench' ? 'rgba(180,140,90,0.65)'
            : 'rgba(180,180,120,0.35)';
        context.fillStyle = dotColor;
        context.beginPath();
        context.arc(offsetX + obj.x * scale, offsetY + (obj.y || ctx.world.groundY) * scale, 1.8, 0, Math.PI * 2);
        context.fill();
    }
}

export function hitTestSlime(ctx, worldPoint) {
    let best = null;
    let bestDistance = Infinity;
    for (const entry of getActiveEntries(ctx)) {
        const slime = entry.slime;
        if (slime.genome?.isInstable && slime.genome.instabilityMass === 'gaseous' && !slime._instableGrounded) continue;
        for (const node of slime.nodes || []) {
            const distance = Math.hypot(node.x - worldPoint.x, node.y - worldPoint.y);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = entry;
            }
        }
    }
    if (!best) return null;
    return bestDistance <= best.slime.baseRadius * 1.45 ? best : null;
}