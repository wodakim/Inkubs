import { buildCanonicalPortraitSvg } from './storage-canonical-visual-renderer.js';

export function renderStorageSlots({ container, records = [], slotClassName = 'storage-slot' }) {
    if (!container) {
        return;
    }

    container.replaceChildren();

    records.forEach((entry) => {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = slotClassName;
        slot.dataset.storageSlot = 'true';
        slot.dataset.slotState = entry.record ? 'occupied' : 'empty';
        slot.dataset.slotKind = entry.placement?.kind || 'archive';
        slot.dataset.slotIndex = String(entry.placement?.slotIndex ?? 0);
        if (entry.placement?.kind === 'archive') {
            slot.dataset.slotPage = String(entry.placement?.page ?? 1);
        }
        if (entry.canonicalId) {
            slot.dataset.canonicalId = entry.canonicalId;
        }

        if (!entry.record) {
            slot.setAttribute('aria-label', 'Emplacement vide');
            slot.innerHTML = `
                <span class="storage-slot__empty-marker" aria-hidden="true">+</span>
                <span class="storage-slot__foot-shadow"></span>
            `;
            container.appendChild(slot);
            return;
        }

        const display = entry.record.storageDisplay || {};
        const label = escapeHtml(display.label || entry.record.displayName || 'Specimen');
        const portrait = buildCanonicalPortraitSvg(entry.record, {
            size: 72,
            className: 'storage-canonical-portrait storage-canonical-portrait--slot',
            variant: 'slot',
            includeGlow: true,
        });

        const rarityLabel = display.rarity || '';
        const rarityClass = rarityLabel
            ? 'storage-slot__rarity storage-slot__rarity--' + rarityLabel.toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e').replace(/è/g, 'e')
            : '';
        const rarityBadge = rarityLabel
            ? `<span class="${escapeHtml(rarityClass)}" aria-label="Rareté : ${escapeHtml(rarityLabel)}">${escapeHtml(rarityLabel)}</span>`
            : '';

        slot.setAttribute('aria-label', `${label}, niveau ${display.level ?? 1}, ${rarityLabel || 'Commun'}`);
        slot.dataset.rarityTier = (entry.record.proceduralCore?.genome?.rarityTier || entry.record.storageDisplay?.rarityTier || 'common');
        slot.innerHTML = `
            <span class="storage-slot__badge">LVL ${display.level ?? 1}</span>
            ${rarityBadge}
            <div class="storage-slot__presence">
                <div class="storage-slot__preview">
                    ${portrait}
                </div>
                <div class="storage-slot__nameplate">${label}</div>
            </div>
            <span class="storage-slot__foot-shadow"></span>
        `;
        container.appendChild(slot);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
