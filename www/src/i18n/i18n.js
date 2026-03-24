/**
 * INKÜ — i18n utility v1.0
 * Lecture de la langue depuis inku.settings.v1 dans localStorage.
 * Fournit t(key), getLang(), setLang(), applyTranslations(root).
 */

import { TRANSLATIONS } from './translations.js';

const SETTINGS_KEY = 'inku.settings.v1';

/** Retourne la langue active ('fr' ou 'en'). */
export function getLang() {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return s.lang === 'en' ? 'en' : 'fr';
    } catch {
        return 'fr';
    }
}

/** Persiste la langue dans les settings. */
export function setLang(lang) {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        s.lang = lang === 'en' ? 'en' : 'fr';
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch { /* storage indisponible */ }
}

/** Traduit une clé. Retourne la valeur FR en fallback, ou la clé brute. */
export function t(key) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.fr;
    return dict[key] ?? TRANSLATIONS.fr[key] ?? key;
}

/**
 * Applique toutes les traductions aux éléments du DOM portant data-i18n,
 * data-i18n-placeholder ou data-i18n-aria dans `root`.
 */
export function applyTranslations(root = document) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.fr;

    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = dict[key] ?? TRANSLATIONS.fr[key];
        if (val === undefined) return;
        // innerHTML si la valeur contient du balisage HTML
        if (val.includes('<')) {
            el.innerHTML = val;
        } else {
            el.textContent = val;
        }
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const val = dict[key] ?? TRANSLATIONS.fr[key];
        if (val !== undefined) el.placeholder = val;
    });

    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.dataset.i18nAria;
        const val = dict[key] ?? TRANSLATIONS.fr[key];
        if (val !== undefined) el.setAttribute('aria-label', val);
    });
}
