export const NAV_ITEMS = Object.freeze([
    { index: 0, id: 'prairie', label: 'Prairie' },
    { index: 1, id: 'musee', label: 'Musée' },
    { index: 2, id: 'labo', label: 'Labo' },
    { index: 3, id: 'bar', label: 'Bar' },
    { index: 4, id: 'shop', label: 'Shop' },
]);

export const DEFAULT_ACTIVE_SECTION_ID = 'labo';
export const MODAL_IDS = Object.freeze({ PROFILE: 'profile' });

export const DEFAULT_PLAYER_STATE = Object.freeze({
    roleLabel: 'Docteur',
    displayName: 'N3O_VNDL',
    levelLabel: 'LVL.0',
    identityLabel: 'ID: INK-774-B',
    levelText: 'Niveau 0',
    xpText: '0 / 10K XP',
    xpProgress: '0%',
    currencies: {
        hexagon: 0,
        sketch: 0,
    },
});
