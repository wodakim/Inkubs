/**
 * tutorial-state.js — persistence du tutoriel.
 * Clé localStorage : inku.tutorial.v1
 *
 * step  : index de la dernière étape TERMINÉE (-1 = jamais commencé)
 * done  : true quand tout le tuto a été vu (ou explicitement ignoré)
 * langChosen : true quand le joueur a validé le choix de langue
 */

const KEY = 'inku.tutorial.v1';

const DEFAULT = { step: -1, done: false, langChosen: false };

function load() {
    try {
        return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
        return { ...DEFAULT };
    }
}

function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
}

export function getTutorialState()       { return load(); }
export function isTutorialDone()         { return load().done; }
export function isLangChosen()           { return load().langChosen; }

export function setTutorialStep(step)    { save({ ...load(), step }); }
export function markLangChosen()         { save({ ...load(), langChosen: true }); }
export function completeTutorial()       { save({ ...load(), done: true, step: 99 }); }
export function resetTutorial()          { save({ ...DEFAULT }); }

/**
 * Détecte la langue préférée du device.
 * Renvoie 'fr' si le device est en français, 'en' sinon.
 */
export function detectDeviceLang() {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
    return langs.some(l => l.toLowerCase().startsWith('fr')) ? 'fr' : 'en';
}
