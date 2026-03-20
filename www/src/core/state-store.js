import { DEFAULT_ACTIVE_SECTION_ID, DEFAULT_PLAYER_STATE, NAV_ITEMS } from './constants.js';

const navIndexById = new Map(NAV_ITEMS.map((item) => [item.id, item.index]));

function resolveNavTarget(payload = {}, currentState) {
    if (typeof payload.index === 'number' && NAV_ITEMS[payload.index]) {
        return NAV_ITEMS[payload.index];
    }

    if (typeof payload.sectionId === 'string') {
        const targetIndex = navIndexById.get(payload.sectionId);
        if (typeof targetIndex === 'number') {
            return NAV_ITEMS[targetIndex];
        }
    }

    const fallbackIndex = navIndexById.get(currentState.activeSectionId);
    return NAV_ITEMS[fallbackIndex] ?? NAV_ITEMS[navIndexById.get(DEFAULT_ACTIVE_SECTION_ID)] ?? NAV_ITEMS[0];
}

function reduceState(state, action) {
    switch (action.type) {
        case 'NAVIGATE_TO_SECTION': {
            const target = resolveNavTarget(action.payload, state);
            if (!target || target.id === state.activeSectionId) {
                return state;
            }

            return {
                ...state,
                previousSectionId: state.activeSectionId,
                activeSectionId: target.id,
                activeSectionIndex: target.index,
                isNavTransitioning: true,
            };
        }

        case 'SET_NAV_TRANSITIONING':
            if (state.isNavTransitioning === Boolean(action.payload?.value)) {
                return state;
            }
            return {
                ...state,
                isNavTransitioning: Boolean(action.payload?.value),
            };

        case 'OPEN_MODAL': {
            const modalId = action.payload?.modalId;
            if (!modalId) {
                return state;
            }

            const filteredStack = state.openModalStack.filter((id) => id !== modalId);
            return {
                ...state,
                openModalStack: [...filteredStack, modalId],
            };
        }

        case 'CLOSE_MODAL': {
            const modalId = action.payload?.modalId;
            if (!modalId) {
                if (state.openModalStack.length === 0) {
                    return state;
                }
                return {
                    ...state,
                    openModalStack: state.openModalStack.slice(0, -1),
                };
            }

            return {
                ...state,
                openModalStack: state.openModalStack.filter((id) => id !== modalId),
            };
        }

        case 'SET_SHELL_ACTIVE':
            if (state.isShellActive === Boolean(action.payload?.value)) {
                return state;
            }
            return {
                ...state,
                isShellActive: Boolean(action.payload?.value),
            };

        case 'SET_BOOTSTRAPPED':
            if (state.isBootstrapped === Boolean(action.payload?.value)) {
                return state;
            }
            return {
                ...state,
                isBootstrapped: Boolean(action.payload?.value),
            };

        case 'HYDRATE_PLAYER': {
            const player = {
                ...state.player,
                ...action.payload,
                currencies: {
                    ...state.player.currencies,
                    ...(action.payload?.currencies ?? {}),
                },
            };

            return {
                ...state,
                player,
            };
        }

        default:
            return state;
    }
}

export function createStateStore(initialState = {}) {
    let state = Object.freeze({
        activeSectionId: DEFAULT_ACTIVE_SECTION_ID,
        activeSectionIndex: navIndexById.get(DEFAULT_ACTIVE_SECTION_ID) ?? 0,
        previousSectionId: null,
        openModalStack: [],
        isNavTransitioning: false,
        isShellActive: true,
        isBootstrapped: false,
        player: { ...DEFAULT_PLAYER_STATE, currencies: { ...DEFAULT_PLAYER_STATE.currencies } },
        ...initialState,
        player: {
            ...DEFAULT_PLAYER_STATE,
            ...(initialState.player ?? {}),
            currencies: {
                ...DEFAULT_PLAYER_STATE.currencies,
                ...(initialState.player?.currencies ?? {}),
            },
        },
    });

    const subscribers = new Set();

    function getState() {
        return state;
    }

    function notify(nextState, previousState, action) {
        subscribers.forEach((subscriber) => subscriber(nextState, previousState, action));
    }

    function dispatch(action) {
        const nextState = Object.freeze(reduceState(state, action));
        if (nextState === state) {
            return state;
        }

        const previousState = state;
        state = nextState;
        notify(state, previousState, action);
        return state;
    }

    function patchState(patch, meta = { type: 'PATCH_STATE' }) {
        const nextPartial = typeof patch === 'function' ? patch(state) : patch;
        const nextState = Object.freeze({
            ...state,
            ...nextPartial,
            player: nextPartial?.player
                ? {
                    ...state.player,
                    ...nextPartial.player,
                    currencies: {
                        ...state.player.currencies,
                        ...(nextPartial.player.currencies ?? {}),
                    },
                }
                : state.player,
        });

        if (nextState === state) {
            return state;
        }

        const previousState = state;
        state = nextState;
        notify(state, previousState, meta);
        return state;
    }

    function subscribe(subscriber) {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
    }

    return {
        getState,
        dispatch,
        patchState,
        subscribe,
    };
}
