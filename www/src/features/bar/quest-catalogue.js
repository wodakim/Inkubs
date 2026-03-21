/**
 * INKÜ — Quest Catalogue
 * Définitions de toutes les quêtes (pool journalier + liste définitive).
 *
 * Types de quêtes :
 *   bar_talk      — parler au barman
 *   visit_section — visiter une section (section: 'prairie'|'labo'|…)
 *   earn          — gagner X Inkübits dans la journée
 *   buy           — acheter X Inkübs dans la journée
 *   collection    — posséder au moins X Inkübs (snapshot)
 *   team_size     — avoir au moins X Inkübs dans l'équipe (snapshot)
 *   max_level     — avoir un Inkübs de niveau ≥ X (snapshot)
 *   total_earned  — avoir gagné X Inkübits au total (compteur cumulatif)
 */

// ── Pool journalier (3 piochés aléatoirement chaque jour) ─────────────────
export const DAILY_POOL = [
    {
        id:      'daily_bar_talk',
        type:    'bar_talk',
        reward:  20,
        labelKey: 'quest.d.bar_talk.label',
        descKey:  'quest.d.bar_talk.desc',
    },
    {
        id:      'daily_prairie',
        type:    'visit_section',
        section: 'prairie',
        reward:  25,
        labelKey: 'quest.d.prairie.label',
        descKey:  'quest.d.prairie.desc',
    },
    {
        id:      'daily_labo',
        type:    'visit_section',
        section: 'labo',
        reward:  20,
        labelKey: 'quest.d.labo.label',
        descKey:  'quest.d.labo.desc',
    },
    {
        id:      'daily_earn_100',
        type:    'earn',
        target:  100,
        reward:  50,
        labelKey: 'quest.d.earn_100.label',
        descKey:  'quest.d.earn_100.desc',
    },
    {
        id:      'daily_earn_300',
        type:    'earn',
        target:  300,
        reward:  120,
        labelKey: 'quest.d.earn_300.label',
        descKey:  'quest.d.earn_300.desc',
    },
    {
        id:      'daily_buy',
        type:    'buy',
        target:  1,
        reward:  75,
        labelKey: 'quest.d.buy.label',
        descKey:  'quest.d.buy.desc',
    },
    {
        id:      'daily_team_1',
        type:    'team_size',
        target:  1,
        reward:  40,
        labelKey: 'quest.d.team_1.label',
        descKey:  'quest.d.team_1.desc',
    },
    {
        id:      'daily_team_4',
        type:    'team_size',
        target:  4,
        reward:  80,
        labelKey: 'quest.d.team_4.label',
        descKey:  'quest.d.team_4.desc',
    },
    {
        id:      'daily_col_3',
        type:    'collection',
        target:  3,
        reward:  40,
        labelKey: 'quest.d.col_3.label',
        descKey:  'quest.d.col_3.desc',
    },
    {
        id:      'daily_lvl_3',
        type:    'max_level',
        target:  3,
        reward:  60,
        labelKey: 'quest.d.lvl_3.label',
        descKey:  'quest.d.lvl_3.desc',
    },
];

// ── Quêtes définitives (trophées, une seule fois) ─────────────────────────
export const DEFINITIVE_LIST = [
    // — Collection —
    {
        id: 'def_first',    group: 'collection', type: 'collection',   target: 1,
        reward: 100,   trophy: '🥚',
        labelKey: 'quest.v.first.label', descKey: 'quest.v.first.desc',
    },
    {
        id: 'def_col5',     group: 'collection', type: 'collection',   target: 5,
        reward: 300,   trophy: '🌱',
        labelKey: 'quest.v.col5.label',  descKey: 'quest.v.col5.desc',
    },
    {
        id: 'def_col10',    group: 'collection', type: 'collection',   target: 10,
        reward: 750,   trophy: '🌿',
        labelKey: 'quest.v.col10.label', descKey: 'quest.v.col10.desc',
    },
    {
        id: 'def_col25',    group: 'collection', type: 'collection',   target: 25,
        reward: 2000,  trophy: '🌳',
        labelKey: 'quest.v.col25.label', descKey: 'quest.v.col25.desc',
    },
    {
        id: 'def_col50',    group: 'collection', type: 'collection',   target: 50,
        reward: 5000,  trophy: '🌲',
        labelKey: 'quest.v.col50.label', descKey: 'quest.v.col50.desc',
    },
    // — Économie —
    {
        id: 'def_e1k',      group: 'economy',    type: 'total_earned', target: 1000,
        reward: 150,   trophy: '💰',
        labelKey: 'quest.v.e1k.label',   descKey: 'quest.v.e1k.desc',
    },
    {
        id: 'def_e5k',      group: 'economy',    type: 'total_earned', target: 5000,
        reward: 500,   trophy: '💵',
        labelKey: 'quest.v.e5k.label',   descKey: 'quest.v.e5k.desc',
    },
    {
        id: 'def_e10k',     group: 'economy',    type: 'total_earned', target: 10000,
        reward: 1500,  trophy: '💎',
        labelKey: 'quest.v.e10k.label',  descKey: 'quest.v.e10k.desc',
    },
    {
        id: 'def_e50k',     group: 'economy',    type: 'total_earned', target: 50000,
        reward: 5000,  trophy: '👑',
        labelKey: 'quest.v.e50k.label',  descKey: 'quest.v.e50k.desc',
    },
    {
        id: 'def_e999k',    group: 'economy',    type: 'total_earned', target: 999999,
        reward: 50000, trophy: '🏆',
        labelKey: 'quest.v.e999k.label', descKey: 'quest.v.e999k.desc',
    },
    // — Niveau —
    {
        id: 'def_lvl5',     group: 'level',      type: 'max_level',    target: 5,
        reward: 200,   trophy: '⭐',
        labelKey: 'quest.v.lvl5.label',  descKey: 'quest.v.lvl5.desc',
    },
    {
        id: 'def_lvl10',    group: 'level',      type: 'max_level',    target: 10,
        reward: 500,   trophy: '🌟',
        labelKey: 'quest.v.lvl10.label', descKey: 'quest.v.lvl10.desc',
    },
    {
        id: 'def_lvl20',    group: 'level',      type: 'max_level',    target: 20,
        reward: 2000,  trophy: '💫',
        labelKey: 'quest.v.lvl20.label', descKey: 'quest.v.lvl20.desc',
    },
    {
        id: 'def_lvl50',    group: 'level',      type: 'max_level',    target: 50,
        reward: 10000, trophy: '🔥',
        labelKey: 'quest.v.lvl50.label', descKey: 'quest.v.lvl50.desc',
    },
    {
        id: 'def_lvl99',    group: 'level',      type: 'max_level',    target: 99,
        reward: 25000, trophy: '🎯',
        labelKey: 'quest.v.lvl99.label', descKey: 'quest.v.lvl99.desc',
    },
    // — Équipe —
    {
        id: 'def_team4',    group: 'team',       type: 'team_size',    target: 4,
        reward: 300,   trophy: '🤝',
        labelKey: 'quest.v.team4.label', descKey: 'quest.v.team4.desc',
    },
    // — Bar —
    {
        id: 'def_bar',      group: 'bar',        type: 'bar_talk',     target: 1,
        reward: 100,   trophy: '🍺',
        labelKey: 'quest.v.bar.label',   descKey: 'quest.v.bar.desc',
    },
];

export function getDailyById(id) {
    return DAILY_POOL.find((q) => q.id === id) ?? null;
}

export function getDefinitiveById(id) {
    return DEFINITIVE_LIST.find((q) => q.id === id) ?? null;
}
