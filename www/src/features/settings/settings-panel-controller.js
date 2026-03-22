/**
 * INKÜ — In-Game Settings Panel Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Gère le panneau de paramètres plein-écran (#inku-settings-modal).
 * Mêmes réglages que l'écran titre : son, affichage, qualité graphique,
 * gameplay, langue.
 *
 * Utilise la même clé localStorage que l'écran titre (inku.settings.v1)
 * pour que les paramètres soient partagés entre les deux vues.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getLang, setLang } from '../../i18n/i18n.js';
import {
    getPerformanceTier,
    setPerformanceTier,
    detectAndApplyPerformanceProfile,
} from '../../utils/device-performance-profile.js';

const SK  = 'inku.settings.v1';
const DEF = { master: 80, music: 60, sfx: 90, quality: 'high', fps: false, motion: false, notif: false, vibr: true, touch: true, lang: 'fr' };

function loadSettings() {
    try { return { ...DEF, ...JSON.parse(localStorage.getItem(SK) || '{}') }; } catch { return { ...DEF }; }
}

function saveSettings(s) {
    try { localStorage.setItem(SK, JSON.stringify(s)); } catch { /* storage indisponible */ }
}

export function createSettingsPanelController() {
    const modal = document.getElementById('inku-settings-modal');
    if (!modal) {
        // Panneau absent du DOM — retourner un stub inerte
        return { open() {}, close() {}, destroy() {} };
    }

    let _isOpen  = false;
    let settings = loadSettings();

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const closeBtn      = document.getElementById('igs-close-btn');
    const tierBtns      = modal.querySelectorAll('[data-igs-tier]');
    const autoDetectBtn = document.getElementById('igs-auto-detect');
    const langSeg       = document.getElementById('igs-lang');

    // Sliders [ elementId, settingsKey ]
    const SLIDERS  = [['igs-master', 'master'], ['igs-music', 'music'], ['igs-sfx', 'sfx']];
    // Toggles [ elementId, settingsKey ]
    const TOGGLES  = [['igs-fps', 'fps'], ['igs-motion', 'motion'], ['igs-vibr', 'vibr'], ['igs-touch', 'touch']];

    // ── Sync UI from current settings/tier ───────────────────────────────────
    function _syncUI() {
        settings = loadSettings();

        SLIDERS.forEach(([id, k]) => {
            const el  = document.getElementById(id);
            const val = document.getElementById(id + '-v');
            if (el)  el.value         = settings[k];
            if (val) val.textContent  = settings[k];
        });

        TOGGLES.forEach(([id, k]) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!settings[k];
        });

        const tier = getPerformanceTier();
        tierBtns.forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.igsTier === tier);
        });

        const lang = getLang();
        langSeg?.querySelectorAll('[data-v]').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.v === lang);
        });
    }

    // ── Open / Close ─────────────────────────────────────────────────────────
    function open() {
        if (_isOpen) return;
        _isOpen = true;
        _syncUI();
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        if (!_isOpen) return;
        _isOpen = false;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    // Close button
    function _onClose() { close(); }
    closeBtn?.addEventListener('click', _onClose);

    // Sliders — save on input
    SLIDERS.forEach(([id, k]) => {
        const el  = document.getElementById(id);
        const val = document.getElementById(id + '-v');
        el?.addEventListener('input', () => {
            settings[k] = +el.value;
            if (val) val.textContent = el.value;
            saveSettings(settings);
        });
    });

    // Toggles — save on change
    TOGGLES.forEach(([id, k]) => {
        const el = document.getElementById(id);
        el?.addEventListener('change', () => {
            settings[k] = el.checked;
            saveSettings(settings);
        });
    });

    // Quality tier buttons
    tierBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.igsTier;
            setPerformanceTier(tier);
            tierBtns.forEach(b => b.classList.toggle('is-active', b === btn));
        });
    });

    // Auto-detect
    autoDetectBtn?.addEventListener('click', () => {
        autoDetectBtn.disabled = true;
        detectAndApplyPerformanceProfile()
            .then(() => {
                const tier = getPerformanceTier();
                tierBtns.forEach(b => b.classList.toggle('is-active', b.dataset.igsTier === tier));
            })
            .catch(() => {})
            .finally(() => { autoDetectBtn.disabled = false; });
    });

    // Language segmented control — change triggers page reload
    langSeg?.querySelectorAll('[data-v]').forEach(btn => {
        btn.addEventListener('click', () => {
            const prev = getLang();
            const next = btn.dataset.v;
            if (next === prev) return;

            setLang(next);
            langSeg.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('is-active', b === btn));

            // Show restart overlay (reuse the lang-restart overlay from index.html)
            const overlay = document.getElementById('ts-lang-restart');
            if (overlay) {
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
            }
            setTimeout(() => {
                document.body.style.transition = 'opacity 0.4s';
                document.body.style.opacity    = '0';
            }, 600);
            setTimeout(() => location.reload(), 1050);
        });
    });

    // Escape key
    function _onKeydown(e) {
        if (_isOpen && e.key === 'Escape') { e.preventDefault(); close(); }
    }
    document.addEventListener('keydown', _onKeydown);

    // ── Public API ────────────────────────────────────────────────────────────
    function destroy() {
        closeBtn?.removeEventListener('click', _onClose);
        document.removeEventListener('keydown', _onKeydown);
    }

    return { open, close, destroy };
}
