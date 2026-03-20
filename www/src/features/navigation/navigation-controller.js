import { NAV_ITEMS } from '../../core/constants.js';
import { createListenerRegistry } from '../../core/listener-registry.js';
import { applyNavVisualState, flashNavPress } from './navigation-animations.js';

export function createNavigationController({ refs, store }) {
    const elasticTimeoutRef = { current: null };
    const listeners = createListenerRegistry();
    const navIndexById = new Map(NAV_ITEMS.map((item) => [item.id, item.index]));
    let transitionTimeout = 0;

    function setActiveSectionByIndex(targetIndex) {
        const target = NAV_ITEMS[targetIndex];
        if (!target || !store.getState().isShellActive) {
            return;
        }

        store.dispatch({
            type: 'NAVIGATE_TO_SECTION',
            payload: { index: targetIndex },
        });

        if (store.getState().activeSectionIndex !== targetIndex) {
            return;
        }

        window.clearTimeout(transitionTimeout);
        transitionTimeout = window.setTimeout(() => {
            store.dispatch({
                type: 'SET_NAV_TRANSITIONING',
                payload: { value: false },
            });
        }, 620);
    }

    function syncLayout(options = {}) {
        applyNavVisualState({
            refs,
            state: store.getState(),
            previousState: { activeSectionIndex: -1 },
            elasticTimeoutRef,
            options,
        });
    }

    refs.navButtons.forEach((button) => {
        const targetIndex = Number(button.dataset.navIndex);

        listeners.listen(button, 'pointerdown', (event) => {
            if (!event.isPrimary || event.button > 0) {
                return;
            }
            flashNavPress(button);
        }, { passive: true });

        listeners.listen(button, 'click', (event) => {
            event.stopPropagation();
            setActiveSectionByIndex(targetIndex);
        });
    });

    const unsubscribe = store.subscribe((state, previousState, action) => {
        if (state.activeSectionIndex === previousState.activeSectionIndex) {
            return;
        }

        if (action?.type === 'NAVIGATE_TO_SECTION' || action?.type === 'PATCH_STATE') {
            applyNavVisualState({ refs, state, previousState, elasticTimeoutRef });
        }
    });

    return {
        setActiveSectionByIndex,
        setActiveSectionById(sectionId) {
            const targetIndex = navIndexById.get(sectionId);
            if (typeof targetIndex === 'number') {
                setActiveSectionByIndex(targetIndex);
            }
        },
        syncLayout,
        primeInitialLayout() {
            applyNavVisualState({
                refs,
                state: store.getState(),
                previousState: { activeSectionIndex: -1 },
                elasticTimeoutRef,
                options: { instant: true },
            });
        },
        destroy() {
            clearTimeout(transitionTimeout);
            clearTimeout(elasticTimeoutRef.current);
            listeners.disposeAll();
            unsubscribe();
        },
    };
}
