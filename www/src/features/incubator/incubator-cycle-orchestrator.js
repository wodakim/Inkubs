const DEFAULT_DWELL_MS = 20000;
const BETWEEN_CYCLES_MS = 320;

export function createIncubatorCycleOrchestrator({ controller, preview, dwellMs = DEFAULT_DWELL_MS }) {
    let isEnabled = false;
    let isPaused = false;
    let meterRaf = 0;
    let dwellTimeout = 0;
    let betweenTimeout = 0;
    let currentDwellDeadlineAt = 0;
    let nextCycleDueAt = 0;

    const intakeMs = Math.max(0, Math.round(controller?.config?.timings?.intakeMs || 0));
    const purgeMs = Math.max(0, Math.round(controller?.config?.timings?.purgeMs || 0));
    const cycleGapMs = purgeMs + BETWEEN_CYCLES_MS + intakeMs;
    const fullCycleMs = cycleGapMs + dwellMs;

    function stopMeterAnimation() {
        if (meterRaf) {
            cancelAnimationFrame(meterRaf);
            meterRaf = 0;
        }
    }

    function clearPendingTimers() {
        if (dwellTimeout) {
            clearTimeout(dwellTimeout);
            dwellTimeout = 0;
        }
        if (betweenTimeout) {
            clearTimeout(betweenTimeout);
            betweenTimeout = 0;
        }
    }

    function setMeter(ratio) {
        controller?.view?.setEnergyMeter?.(ratio);
    }

    function animateMeterDrain() {
        stopMeterAnimation();
        if (!currentDwellDeadlineAt) {
            setMeter(0);
            return;
        }

        const frame = () => {
            if (!isEnabled || isPaused || !currentDwellDeadlineAt) {
                meterRaf = 0;
                return;
            }
            const remainingMs = Math.max(0, currentDwellDeadlineAt - Date.now());
            setMeter(Math.max(0, Math.min(1, remainingMs / Math.max(1, dwellMs))));
            if (remainingMs > 0) {
                meterRaf = requestAnimationFrame(frame);
            } else {
                meterRaf = 0;
            }
        };

        frame();
    }

    async function spawnFreshCandidate({ remainingDwellMs = dwellMs } = {}) {
        if (!isEnabled || isPaused) {
            return;
        }

        nextCycleDueAt = 0;

        const state = controller?.getState?.();
        const candidate = controller?.getCandidate?.();

        if (state === 'error') {
            controller?.resetRuntime?.();
        }

        if (candidate && state === 'suspended') {
            const remainingMs = currentDwellDeadlineAt > 0 ? currentDwellDeadlineAt - Date.now() : remainingDwellMs;
            if (remainingMs > 0) {
                scheduleDwell(remainingMs);
                return;
            }
            controller?.resetRuntime?.();
        }

        if (controller?.getCandidate?.() && controller?.getState?.() === 'staging') {
            try {
                await controller.startIntake();
            } catch (_error) {
                return;
            }
            if (!isEnabled) {
                return;
            }
            scheduleDwell(remainingDwellMs);
            return;
        }

        if (controller?.getState?.() !== 'idle') {
            return;
        }

        const candidatePayload = preview?.createCandidatePayload?.();
        if (!candidatePayload) {
            return;
        }

        controller.stageCandidate(candidatePayload);

        try {
            await controller.startIntake();
        } catch (_error) {
            return;
        }

        if (!isEnabled) {
            return;
        }

        scheduleDwell(remainingDwellMs);
    }

    async function expireCurrentCandidate() {
        if (!isEnabled || isPaused) {
            return;
        }

        stopMeterAnimation();
        currentDwellDeadlineAt = 0;

        const state = controller?.getState?.();
        const candidate = controller?.getCandidate?.();
        if (state !== 'suspended' || !candidate) {
            queueNextCandidate(BETWEEN_CYCLES_MS);
            return;
        }

        preview?.beginAspiration?.();

        try {
            await controller.purgeCurrentCandidate();
        } catch (_error) {
            return;
        }

        if (!isEnabled || isPaused) {
            return;
        }

        queueNextCandidate(BETWEEN_CYCLES_MS);
    }

    function scheduleDwell(durationMs) {
        clearPendingTimers();
        stopMeterAnimation();
        nextCycleDueAt = 0;

        const remainingMs = Math.max(0, Math.round(durationMs));
        currentDwellDeadlineAt = Date.now() + remainingMs;

        if (!isEnabled || isPaused) {
            return;
        }

        if (remainingMs <= 0) {
            void expireCurrentCandidate();
            return;
        }

        animateMeterDrain();
        dwellTimeout = globalThis.setTimeout(() => {
            dwellTimeout = 0;
            void expireCurrentCandidate();
        }, remainingMs);
    }

    function queueNextCandidate(delayMs = 0) {
        clearPendingTimers();
        stopMeterAnimation();
        currentDwellDeadlineAt = 0;

        if (!isEnabled) {
            return;
        }

        const safeDelay = Math.max(0, Math.round(delayMs));
        nextCycleDueAt = Date.now() + safeDelay;

        if (isPaused) {
            return;
        }

        if (safeDelay === 0) {
            nextCycleDueAt = 0;
            void spawnFreshCandidate();
            return;
        }

        setMeter(0.72);
        betweenTimeout = globalThis.setTimeout(() => {
            betweenTimeout = 0;
            nextCycleDueAt = 0;
            void spawnFreshCandidate();
        }, safeDelay);
    }

    function resumeContinuousCycle() {
        if (!isEnabled || isPaused) {
            return;
        }

        const now = Date.now();
        const state = controller?.getState?.();
        const candidate = controller?.getCandidate?.();

        if (state === 'error') {
            controller?.resetRuntime?.();
            queueNextCandidate(0);
            return;
        }

        if (candidate && state === 'suspended') {
            if (currentDwellDeadlineAt > now) {
                scheduleDwell(currentDwellDeadlineAt - now);
                return;
            }

            controller?.resetRuntime?.();

            const elapsedSinceExpiry = currentDwellDeadlineAt > 0 ? Math.max(0, now - currentDwellDeadlineAt) : 0;
            if (fullCycleMs <= 0) {
                queueNextCandidate(0);
                return;
            }

            const cyclePosition = elapsedSinceExpiry % fullCycleMs;
            if (cyclePosition < cycleGapMs) {
                queueNextCandidate(Math.max(0, cycleGapMs - cyclePosition));
                return;
            }

            const elapsedInDwell = cyclePosition - cycleGapMs;
            const remainingDwellMs = Math.max(0, dwellMs - elapsedInDwell);
            void spawnFreshCandidate({ remainingDwellMs });
            return;
        }

        if (!candidate && state === 'idle') {
            if (nextCycleDueAt > now) {
                queueNextCandidate(nextCycleDueAt - now);
                return;
            }
            queueNextCandidate(0);
            return;
        }

        if (candidate && state === 'staging') {
            void spawnFreshCandidate();
            return;
        }

        clearPendingTimers();
        stopMeterAnimation();
    }

    return {
        start() {
            isEnabled = true;
            isPaused = false;
            resumeContinuousCycle();
        },
        pause() {
            isPaused = true;
            clearPendingTimers();
            stopMeterAnimation();
        },
        resume() {
            isEnabled = true;
            isPaused = false;
            resumeContinuousCycle();
        },
        stop() {
            isEnabled = false;
            isPaused = false;
            currentDwellDeadlineAt = 0;
            nextCycleDueAt = 0;
            clearPendingTimers();
            stopMeterAnimation();
            setMeter(0);
        },
        queueNextCandidate(delayMs = 0) {
            queueNextCandidate(delayMs);
        },
        getRemainingDwellMs() {
            return currentDwellDeadlineAt > 0 ? Math.max(0, currentDwellDeadlineAt - Date.now()) : 0;
        },
        isCurrentCandidateOverdue() {
            return currentDwellDeadlineAt > 0 && Date.now() >= currentDwellDeadlineAt;
        },
        get isRunning() {
            return isEnabled && !isPaused;
        },
    };
}
