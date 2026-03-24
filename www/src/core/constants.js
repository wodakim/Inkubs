import { t } from '../i18n/i18n.js';

export const NAV_ITEMS = Object.freeze([
    { index: 0, id: 'prairie', label: t('nav.prairie') },
    { index: 1, id: 'musee',   label: t('nav.musee')   },
    { index: 2, id: 'labo',    label: t('nav.labo')    },
    { index: 3, id: 'bar',     label: t('nav.bar')     },
    { index: 4, id: 'shop',    label: t('nav.shop')    },
]);

export const DEFAULT_ACTIVE_SECTION_ID = 'labo';
export const MODAL_IDS = Object.freeze({ PROFILE: 'profile' });

export const DEFAULT_PLAYER_STATE = Object.freeze({
    roleLabel: t('hud.role'),
    displayName: 'N3O_VNDL',
    avatarKey: 'user',
    levelLabel: 'LVL.0',
    identityLabel: 'ID: INK-774-B',
    levelText: 'Niveau 0',
    xpText: '0 / 10K XP',
    xpProgress: '0%',
    currencies: {
        hexagon: 500,   // enough for ~2 common slimes (~200 each) to start
        sketch: 0,
    },
});
