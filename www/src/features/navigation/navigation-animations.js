function setIconVariant(icon, isActive) {
    if (!icon) {
        return;
    }

    if (isActive) {
        icon.className = icon.className.replace('ph-duotone', 'ph-fill');
        return;
    }

    icon.className = icon.className.replace('ph-fill', 'ph-duotone');
}

function getTargetMetrics(targetElement, navContainer, slimeCursor) {
    if (!targetElement || !navContainer || !slimeCursor) {
        return null;
    }

    const containerRect = navContainer.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const cursorRect = slimeCursor.getBoundingClientRect();
    const relativeLeft = targetRect.left - containerRect.left;
    const slotCenter = relativeLeft + (targetRect.width / 2);
    const cursorWidth = cursorRect.width || slimeCursor.offsetWidth;

    return {
        slotWidth: targetRect.width,
        slotCenter,
        cursorX: slotCenter - (cursorWidth / 2),
        trackX: relativeLeft + 4,
        trackWidth: Math.max(targetRect.width - 8, 0),
        lineX: relativeLeft + 10,
        lineWidth: Math.max(targetRect.width - 20, 0),
    };
}

function runElasticTravel({ slimeCursor, slimeStretch, activeSectionIndex, previousIndex, elasticTimeoutRef }) {
    const delta = activeSectionIndex - previousIndex;
    const distance = Math.abs(delta);
    const direction = delta >= 0 ? 1 : -1;
    const horizontalBoost = Math.min(0.18 + (distance * 0.08), 0.34);
    const verticalBoost = Math.min(0.14 + (distance * 0.05), 0.26);

    slimeCursor.classList.remove('elastic-travel');
    void slimeCursor.offsetWidth;
    slimeCursor.classList.add('elastic-travel');

    slimeStretch.style.transform = `scaleX(${1 + horizontalBoost}) scaleY(${1 - verticalBoost}) rotate(${direction * 4}deg)`;
    clearTimeout(elasticTimeoutRef.current);
    elasticTimeoutRef.current = window.setTimeout(() => {
        slimeStretch.style.transform = 'scaleX(0.94) scaleY(1.08) rotate(0deg)';
        window.setTimeout(() => {
            slimeStretch.style.transform = 'scaleX(1.03) scaleY(0.98) rotate(0deg)';
            window.setTimeout(() => {
                slimeStretch.style.transform = 'scaleX(1) scaleY(1) rotate(0deg)';
            }, 120);
        }, 120);
    }, 135);
}

export function flashNavPress(button) {
    if (!button) {
        return;
    }

    button.classList.add('is-pressed');
    clearTimeout(button._pressFx);
    button._pressFx = window.setTimeout(() => {
        button.classList.remove('is-pressed');
    }, 220);
}

export function applyNavVisualState({ refs, state, previousState, elasticTimeoutRef, options = {} }) {
    const { navButtons, navSlots, slimeCursor, slimeStretch, navContainer, navTrackGlow, navEnergyLine } = refs;
    const { activeSectionIndex } = state;
    const previousIndex = previousState?.activeSectionIndex ?? -1;
    const shouldAnimateTravel = !options.instant && previousIndex !== -1 && previousIndex !== activeSectionIndex;

    if (!navContainer || !slimeCursor || !slimeStretch || !navTrackGlow || !navEnergyLine) {
        return;
    }

    navButtons.forEach((button, index) => {
        const icon = button.querySelector('i');
        const isActive = index === activeSectionIndex;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
        setIconVariant(icon, isActive);
    });

    const activeTarget = navButtons[activeSectionIndex] || navSlots[activeSectionIndex];
    if (activeSectionIndex < 0 || !activeTarget) {
        return;
    }

    const metrics = getTargetMetrics(activeTarget, navContainer, slimeCursor);
    if (!metrics) {
        return;
    }

    const { cursorX, trackX, trackWidth, lineX, lineWidth } = metrics;

    if (options.instant) {
        const cursorTransition = slimeCursor.style.transition;
        const stretchTransition = slimeStretch.style.transition;
        const trackTransition = navTrackGlow.style.transition;
        const lineTransition = navEnergyLine.style.transition;

        slimeCursor.style.transition = 'none';
        slimeStretch.style.transition = 'none';
        navTrackGlow.style.transition = 'none';
        navEnergyLine.style.transition = 'none';

        slimeCursor.style.transform = `translateX(${cursorX}px)`;
        navTrackGlow.style.transform = `translateX(${trackX}px)`;
        navEnergyLine.style.transform = `translateX(${lineX}px) scaleX(1)`;
        navTrackGlow.style.width = `${trackWidth}px`;
        navEnergyLine.style.width = `${lineWidth}px`;
        slimeStretch.style.transform = 'scaleX(1) scaleY(1) rotate(0deg)';

        void slimeCursor.offsetWidth;

        slimeCursor.style.transition = cursorTransition;
        slimeStretch.style.transition = stretchTransition;
        navTrackGlow.style.transition = trackTransition;
        navEnergyLine.style.transition = lineTransition;
        slimeCursor.classList.remove('is-initial-lock');
        slimeCursor.style.visibility = 'visible';
        navContainer.dataset.navReady = 'true';
        return;
    }

    if (shouldAnimateTravel) {
        runElasticTravel({ slimeCursor, slimeStretch, activeSectionIndex, previousIndex, elasticTimeoutRef });
    } else {
        slimeStretch.style.transform = 'scaleX(1) scaleY(1) rotate(0deg)';
    }

    slimeCursor.style.transform = `translateX(${cursorX}px)`;
    slimeCursor.style.visibility = 'visible';
    navTrackGlow.style.transform = `translateX(${trackX}px)`;
    navEnergyLine.style.transform = `translateX(${lineX}px) scaleX(1)`;
    navTrackGlow.style.width = `${trackWidth}px`;
    navEnergyLine.style.width = `${lineWidth}px`;
    navContainer.dataset.navReady = 'true';
}
