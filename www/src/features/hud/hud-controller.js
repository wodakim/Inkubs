const AVATAR_KEYS = new Set(['user', 'robot', 'alien', 'skull', 'ghost', 'flame', 'crown', 'cat']);

function resolveAvatarClass(key) {
    return `ph-fill ph-${AVATAR_KEYS.has(key) ? key : 'user'}`;
}

export function createHudController({ refs, store }) {
    function render(player) {
        refs.hudPlayerRole.textContent = player.roleLabel;
        refs.hudPlayerName.textContent = player.displayName;
        refs.hudPlayerLevel.textContent = player.levelLabel;
        refs.modalPlayerName.textContent = player.displayName;
        refs.modalPlayerId.textContent = player.identityLabel;
        refs.modalPlayerLevelLabel.textContent = player.levelText;
        refs.modalPlayerXp.textContent = player.xpText;
        refs.modalPlayerXpBar.style.width = player.xpProgress;
        refs.currencyValues.hexagon.textContent = Math.floor(player.currencies.hexagon).toLocaleString('fr-FR');
        refs.currencyValues.sketch.textContent = String(player.currencies.sketch);

        const avatarClass = resolveAvatarClass(player.avatarKey);
        if (refs.hudPlayerAvatarIcon) refs.hudPlayerAvatarIcon.className = `${avatarClass} text-emerald text-xl`;
        if (refs.modalPlayerAvatarIcon) refs.modalPlayerAvatarIcon.className = `${avatarClass} text-emerald text-6xl`;
    }

    render(store.getState().player);

    const unsubscribe = store.subscribe((state, previousState) => {
        if (state.player !== previousState.player) {
            render(state.player);
        }
    });

    return {
        hydratePlayer(player) {
            store.dispatch({
                type: 'HYDRATE_PLAYER',
                payload: player,
            });
        },
        /** Affiche ou masque le taux de revenu passif total sous la balance. */
        updateIncomeRate(ratePerMin) {
            if (!refs.hudIncomeRate) {
                return;
            }
            if (!ratePerMin || ratePerMin <= 0) {
                refs.hudIncomeRate.hidden = true;
                return;
            }
            refs.hudIncomeRate.textContent = `+${ratePerMin.toFixed(1)}/min`;
            refs.hudIncomeRate.hidden = false;
        },
        destroy() {
            unsubscribe();
        },
    };
}
