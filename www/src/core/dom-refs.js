export function getDomRefs(root = document) {
    const navButtons = Array.from(root.querySelectorAll('[data-nav-index]'));
    const navSlots = Array.from(root.querySelectorAll('[data-nav-slot]'));
    const modals = Array.from(root.querySelectorAll('[data-modal]'));

    return {
        root,
        shell: root.querySelector('[data-app-shell]'),
        contentShell: root.querySelector('[data-content-shell]'),
        contentMount: root.querySelector('[data-content-mount]'),
        navContainer: root.querySelector('[data-nav-container]'),
        navButtons,
        navSlots,
        slimeCursor: root.getElementById('slime-cursor'),
        slimeStretch: root.getElementById('slime-stretch'),
        navTrackGlow: root.getElementById('nav-track-glow'),
        navEnergyLine: root.getElementById('nav-energy-line'),
        modals,
        profileModal: root.getElementById('profile-modal'),
        profileCard: root.getElementById('profile-card'),
        profileToggleButtons: Array.from(root.querySelectorAll('[data-modal-trigger="profile"], [data-action="toggle-profile-modal"]')),
        profileCloseButtons: Array.from(root.querySelectorAll('[data-action="close-profile-modal"]')),
        dustCanvas: root.getElementById('dust-canvas'),
        hudPlayerName: root.querySelector('[data-player-name]'),
        hudPlayerRole: root.querySelector('[data-player-role]'),
        hudPlayerLevel: root.querySelector('[data-player-level]'),
        modalPlayerName: root.querySelector('[data-modal-player-name]'),
        modalPlayerId: root.querySelector('[data-modal-player-id]'),
        modalPlayerLevelLabel: root.querySelector('[data-modal-player-level-label]'),
        modalPlayerXp: root.querySelector('[data-modal-player-xp]'),
        modalPlayerXpBar: root.querySelector('[data-modal-player-xp-bar]'),
        currencyValues: {
            hexagon: root.querySelector('[data-currency-value="hexagon"]'),
            sketch: root.querySelector('[data-currency-value="sketch"]'),
        },
    };
}
