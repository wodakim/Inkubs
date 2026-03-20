export function createContentMountController({ refs, store }) {
    const featureFactories = new Map();
    const featureInstances = new Map();
    let activeFeatureId = null;
    let isFeatureMounted = false;

    function getFeature(sectionId) {
        if (!featureInstances.has(sectionId)) {
            const factory = featureFactories.get(sectionId);
            if (typeof factory === 'function') {
                featureInstances.set(sectionId, factory());
            }
        }

        return featureInstances.get(sectionId) ?? null;
    }

    function buildContext(state, previousState) {
        return {
            mount: refs.contentMount,
            state,
            previousState,
        };
    }

    function setActiveFeatureMounted(feature, state, previousState) {
        if (!feature) {
            isFeatureMounted = false;
            return;
        }

        if (isFeatureMounted) {
            feature.resume?.(buildContext(state, previousState));
            return;
        }

        feature.mount?.(buildContext(state, previousState));
        isFeatureMounted = true;
    }

    function suspendActiveFeature(feature, state, previousState) {
        if (!feature || !isFeatureMounted) {
            return;
        }

        feature.suspend?.(buildContext(state, previousState));
        isFeatureMounted = false;
    }

    function activateSection(state, previousState) {
        const nextFeatureId = state.activeSectionId;
        const nextFeature = getFeature(nextFeatureId);
        const previousFeature = activeFeatureId ? getFeature(activeFeatureId) : null;

        refs.contentMount.dataset.activeSection = nextFeatureId;

        if (previousFeature && previousFeature !== nextFeature) {
            previousFeature.suspend?.(buildContext(state, previousState));
            isFeatureMounted = false;
        }

        if (nextFeature && state.isShellActive) {
            setActiveFeatureMounted(nextFeature, state, previousState);
        }

        activeFeatureId = nextFeatureId;
    }

    const unsubscribe = store.subscribe((state, previousState) => {
        if (state.activeSectionId !== previousState.activeSectionId) {
            activateSection(state, previousState);
            return;
        }

        if (state.isShellActive !== previousState.isShellActive) {
            const activeFeature = activeFeatureId ? getFeature(activeFeatureId) : null;
            if (state.isShellActive) {
                setActiveFeatureMounted(activeFeature, state, previousState);
                activeFeature?.syncLayout?.(buildContext(state, previousState));
            } else {
                suspendActiveFeature(activeFeature, state, previousState);
            }
        }
    });

    return {
        registerFeature(sectionId, factory) {
            featureFactories.set(sectionId, factory);
        },
        renderCurrent() {
            const currentState = store.getState();
            activateSection(currentState, currentState);
        },
        syncLayout() {
            if (!store.getState().isShellActive) {
                return;
            }

            const activeFeature = activeFeatureId ? getFeature(activeFeatureId) : null;
            activeFeature?.syncLayout?.(buildContext(store.getState(), store.getState()));
        },
        destroy() {
            unsubscribe();
            featureInstances.forEach((feature) => feature.unmount?.({ mount: refs.contentMount }));
            featureInstances.clear();
        },
    };
}
