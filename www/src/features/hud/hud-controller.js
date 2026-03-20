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
        refs.currencyValues.hexagon.textContent = String(player.currencies.hexagon);
        refs.currencyValues.sketch.textContent = String(player.currencies.sketch);
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
        destroy() {
            unsubscribe();
        },
    };
}
