/**
 * INKÜ — Quest Panel
 * Panneau bottom-sheet affichant les quêtes journalières et définitives.
 * Rendu dynamique, mise à jour sur chaque changement du moteur.
 */

import { t } from '../../i18n/i18n.js';
import { DAILY_POOL, DEFINITIVE_LIST, getDailyById, getDefinitiveById } from './quest-catalogue.js';

const GROUP_LABELS = {
    collection: () => t('quest.group.collection'),
    economy:    () => t('quest.group.economy'),
    level:      () => t('quest.group.level'),
    team:       () => t('quest.group.team'),
    bar:        () => t('quest.group.bar'),
};

function formatNum(n) {
    return Math.floor(n).toLocaleString('fr-FR');
}

function progressPct(value, target) {
    return Math.min(100, Math.round((value / target) * 100));
}

// ─────────────────────────────────────────────────────────────────────────────

export function createQuestPanel({ engine, onClose }) {
    let root = null;
    let bodyEl = null;
    let activeTab = 'daily';
    let unsubscribeEngine = null;

    // ── Build HTML ─────────────────────────────────────────────────────────
    function buildDOM() {
        root = document.createElement('div');
        root.className = 'bar-quest-panel';
        root.setAttribute('aria-label', t('quest.panel.aria'));
        root.hidden = true;

        root.innerHTML = `
            <div class="bar-quest-panel__header">
                <div class="bar-quest-tabs" role="tablist">
                    <button class="bar-quest-tab is-active" data-tab="daily"  role="tab" aria-selected="true">
                        ${t('quest.tab.daily')}
                    </button>
                    <button class="bar-quest-tab" data-tab="definitive" role="tab" aria-selected="false">
                        ${t('quest.tab.definitive')}
                    </button>
                </div>
                <button class="bar-quest-panel__close" data-quest-close aria-label="${t('quest.panel.close_aria')}">✕</button>
            </div>
            <div class="bar-quest-panel__body" data-quest-body></div>
        `;

        bodyEl = root.querySelector('[data-quest-body]');

        root.querySelector('[data-quest-close]').addEventListener('click', close);

        root.querySelectorAll('[data-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                root.querySelectorAll('[data-tab]').forEach((b) => {
                    const active = b.dataset.tab === activeTab;
                    b.classList.toggle('is-active', active);
                    b.setAttribute('aria-selected', String(active));
                });
                render();
            });
        });

        return root;
    }

    // ── Render helpers ─────────────────────────────────────────────────────
    function renderDailyTab() {
        const state = engine.getState();
        const activeIds = state.daily.activeIds;

        if (activeIds.length === 0) {
            bodyEl.innerHTML = `<p class="bar-quest-panel__empty">${t('quest.no_quests')}</p>`;
            return;
        }

        let html = `<p class="bar-quest-panel__day-label">${t('quest.todays_quests')}</p>`;

        for (const id of activeIds) {
            const quest = getDailyById(id);
            if (!quest) continue;
            const { value, target } = engine.getQuestProgress(quest);
            const pct = progressPct(value, target);
            const completed  = state.daily.completedIds.includes(id);
            const claimed    = state.daily.claimedIds.includes(id);

            html += buildQuestCard({
                id,
                kind:      'daily',
                label:     t(quest.labelKey),
                desc:      t(quest.descKey),
                reward:    quest.reward,
                value,
                target,
                pct,
                completed,
                claimed,
            });
        }

        bodyEl.innerHTML = html;
        attachClaimListeners('daily');
    }

    function renderDefinitiveTab() {
        const state = engine.getState();
        const groups = {};

        for (const quest of DEFINITIVE_LIST) {
            if (!groups[quest.group]) groups[quest.group] = [];
            groups[quest.group].push(quest);
        }

        let html = '';

        for (const [group, quests] of Object.entries(groups)) {
            const groupLabel = GROUP_LABELS[group]?.() ?? group;
            html += `<p class="bar-quest-panel__group-label">${groupLabel}</p>`;

            for (const quest of quests) {
                const { value, target } = engine.getQuestProgress(quest);
                const pct = progressPct(value, target);
                const completed  = state.definitive.completedIds.includes(quest.id);
                const claimed    = state.definitive.claimedIds.includes(quest.id);

                html += buildQuestCard({
                    id:       quest.id,
                    kind:     'definitive',
                    trophy:   quest.trophy,
                    label:    t(quest.labelKey),
                    desc:     t(quest.descKey),
                    reward:   quest.reward,
                    value,
                    target,
                    pct,
                    completed,
                    claimed,
                });
            }
        }

        bodyEl.innerHTML = html;
        attachClaimListeners('definitive');
    }

    function buildQuestCard({ id, kind, trophy, label, desc, reward, value, target, pct, completed, claimed }) {
        const statusClass = claimed ? 'is-claimed' : completed ? 'is-completed' : '';
        const progressLabel = target > 1
            ? `<span class="bar-quest-card__progress-label">${formatNum(Math.min(value, target))} / ${formatNum(target)}</span>`
            : '';

        let actionHtml;
        if (claimed) {
            actionHtml = `<span class="bar-quest-card__claimed-badge">✓ ${t('quest.claimed')}</span>`;
        } else if (completed) {
            actionHtml = `<button class="bar-quest-card__claim-btn" data-claim="${id}" data-kind="${kind}">
                ${t('quest.claim')} <span class="bar-quest-card__reward">+${formatNum(reward)} ⬡</span>
            </button>`;
        } else {
            actionHtml = `<span class="bar-quest-card__reward-preview">+${formatNum(reward)} ⬡</span>`;
        }

        return `
            <div class="bar-quest-card ${statusClass}" data-quest-id="${id}">
                <div class="bar-quest-card__left">
                    ${trophy ? `<span class="bar-quest-card__trophy" aria-hidden="true">${trophy}</span>` : ''}
                    <div class="bar-quest-card__text">
                        <p class="bar-quest-card__label">${label}</p>
                        <p class="bar-quest-card__desc">${desc}</p>
                    </div>
                </div>
                <div class="bar-quest-card__right">
                    ${actionHtml}
                </div>
                ${target > 1 ? `
                <div class="bar-quest-card__bar-wrap">
                    ${progressLabel}
                    <div class="bar-quest-card__bar">
                        <div class="bar-quest-card__bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>` : ''}
            </div>
        `;
    }

    function attachClaimListeners(kind) {
        bodyEl.querySelectorAll('[data-claim]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id   = btn.dataset.claim;
                const type = btn.dataset.kind;
                let ok = false;
                if (type === 'daily')      ok = engine.claimDaily(id);
                if (type === 'definitive') ok = engine.claimDefinitive(id);
                if (ok) {
                    animateClaim(btn);
                    render();
                }
            });
        });
    }

    function animateClaim(btn) {
        btn.classList.add('bar-quest-card__claim-btn--flash');
        setTimeout(() => btn.classList.remove('bar-quest-card__claim-btn--flash'), 500);
    }

    function render() {
        if (!bodyEl) return;
        if (activeTab === 'daily') {
            renderDailyTab();
        } else {
            renderDefinitiveTab();
        }
    }

    // ── Open / Close ───────────────────────────────────────────────────────
    function open() {
        if (!root) return;
        engine.checkDailyReset();
        engine.autoComplete();
        render();
        root.hidden = false;
        requestAnimationFrame(() => root.classList.add('is-open'));
    }

    function close() {
        if (!root) return;
        root.classList.remove('is-open');
        root.addEventListener('transitionend', () => {
            root.hidden = true;
        }, { once: true });
        onClose?.();
    }

    function mount(container) {
        buildDOM();
        container.appendChild(root);
        unsubscribeEngine = engine.subscribe(() => {
            if (!root.hidden) render();
        });
    }

    function destroy() {
        unsubscribeEngine?.();
        root?.remove();
        root = null;
        bodyEl = null;
    }

    return { mount, open, close, destroy };
}
