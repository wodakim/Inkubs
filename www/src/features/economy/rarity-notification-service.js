/**
 * rarity-notification-service.js
 * Gère les alertes ingame quand un slime rare apparaît dans l'incubateur
 * pendant que le joueur est sur une autre section.
 *
 * Les préférences (enabled, minRarityTier) sont lues depuis le player state.
 * La notification est déclenchée depuis labo-incubator-feature via
 * notifyRareCandidate(rarityTier, store, activeSectionId).
 */

import { t } from '../../i18n/i18n.js';

/** Ordre de priorité des tiers de rareté (du plus bas au plus haut). */
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/**
 * Retourne true si `tier` est supérieur ou égal à `minTier`.
 */
function meetsThreshold(tier, minTier) {
    const tierIdx    = RARITY_ORDER.indexOf(tier);
    const minTierIdx = RARITY_ORDER.indexOf(minTier);
    if (tierIdx < 0 || minTierIdx < 0) {
        return false;
    }
    return tierIdx >= minTierIdx;
}

const TIER_LABELS = {
    common:    t('rarity.common'),
    uncommon:  t('rarity.uncommon'),
    rare:      t('rarity.rare'),
    epic:      t('rarity.epic'),
    legendary: t('rarity.legendary'),
};

const TIER_EMOJIS = {
    common:    '⬡',
    uncommon:  '✦',
    rare:      '◈',
    epic:      '⬡',
    legendary: '★',
};

/**
 * Vérifie et déclenche une notification si les conditions sont réunies.
 *
 * @param {string} rarityTier     - tier du candidat qui vient d'apparaître
 * @param {object} store          - le state store
 * @param {string} activeSectionId - section actuellement visible par le joueur
 */
export async function notifyRareCandidate(rarityTier, store, activeSectionId) {
    // Pas de notification si le joueur est déjà sur le labo
    if (activeSectionId === 'labo') {
        return;
    }

    const player = store?.getState?.()?.player;
    const settings = player?.notificationSettings;

    // Notifications désactivées ou non configurées
    if (!settings?.enabled) {
        return;
    }

    const minTier = settings.minRarityTier || 'rare';
    if (!meetsThreshold(rarityTier, minTier)) {
        return;
    }

    const label = TIER_LABELS[rarityTier] || rarityTier;
    const emoji = TIER_EMOJIS[rarityTier] || '⬡';

    // Affichage via la notification popup (enrichie, pas juste un toast)
    showRarityNotification({ tier: rarityTier, label, emoji });
}

/** Affiche le popup de notification de rareté. */
function showRarityNotification({ tier, label, emoji }) {
    // Supprime toute notification existante avant d'en créer une nouvelle
    document.querySelector('.rarity-alert-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = `rarity-alert-popup rarity-alert-popup--${tier}`;
    popup.setAttribute('role', 'alert');
    popup.setAttribute('aria-live', 'assertive');
    popup.innerHTML = `
        <div class="rarity-alert-popup__inner">
            <span class="rarity-alert-popup__emoji" aria-hidden="true">${emoji}</span>
            <div class="rarity-alert-popup__text">
                <span class="rarity-alert-popup__eyebrow">${t('notif.title')}</span>
                <span class="rarity-alert-popup__message">${t('notif.body').replace('{label}', `<strong>${label}</strong>`)}</span>
            </div>
            <button type="button" class="rarity-alert-popup__close" aria-label="${t('notif.close')}">✕</button>
        </div>
    `;

    // Fermeture manuelle
    popup.querySelector('.rarity-alert-popup__close').addEventListener('click', () => {
        dismissNotification(popup);
    });

    // Fermeture au clic sur la notification (nav vers le labo)
    popup.querySelector('.rarity-alert-popup__inner').addEventListener('click', (event) => {
        if (event.target.closest('.rarity-alert-popup__close')) {
            return;
        }
        dismissNotification(popup);
        // Navigate to labo
        const laboBtn = document.querySelector('[data-section-id="labo"]');
        laboBtn?.click();
    });

    document.body.appendChild(popup);

    // Auto-dismiss après 8 secondes
    const timer = setTimeout(() => dismissNotification(popup), 8000);
    popup._dismissTimer = timer;
}

function dismissNotification(popup) {
    if (!popup || !popup.isConnected) {
        return;
    }
    clearTimeout(popup._dismissTimer);
    popup.classList.add('rarity-alert-popup--leaving');
    popup.addEventListener('animationend', () => popup.remove(), { once: true });
    // Fallback si l'animation ne fire pas
    setTimeout(() => popup.remove(), 400);
}
