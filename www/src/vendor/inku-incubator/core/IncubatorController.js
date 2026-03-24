import { DEFAULT_INCUBATOR_CONFIG } from '../config/defaultConfig.js';
import { deepMerge } from '../utils/deepMerge.js';
import { EventBus } from './EventBus.js';
import { INCUBATOR_EVENTS } from './IncubatorEvents.js';
import { IncubatorStateMachine } from './IncubatorStateMachine.js';
import { adaptCandidate } from '../domain/EntityCandidateAdapter.js';
import { computeCanonicalPrice } from '../domain/PricingPolicy.js';
import { IncubatorView } from '../render/IncubatorView.js';
import stylesheetText from '../styles/incubator.css.js';

export class IncubatorController {
  constructor({ mountTarget, documentRef = document, config = {} }) {
    if (!mountTarget) {
      throw new Error('mountTarget is required to initialize the incubator.');
    }

    this.mountTarget = mountTarget;
    this.documentRef = documentRef;
    this.config = deepMerge(DEFAULT_INCUBATOR_CONFIG, config);
    this.events = new EventBus();
    this.stateMachine = new IncubatorStateMachine('idle');
    this.hostElement = null;
    this.view = null;
    this.currentCandidate = null;
    this.isBusy = false;
    this.isDestroyed = false;
    this.pendingTimeouts = new Set();
  }


  delay(ms) {
    if (!ms || this.isDestroyed) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeoutId = globalThis.setTimeout(() => {
        this.pendingTimeouts.delete(timeoutId);
        resolve();
      }, ms);
      this.pendingTimeouts.add(timeoutId);
    });
  }

  clearPendingTimeouts() {
    this.pendingTimeouts.forEach((timeoutId) => globalThis.clearTimeout(timeoutId));
    this.pendingTimeouts.clear();
  }

  mount() {
    if (this.hostElement) {
      return this;
    }

    this.isDestroyed = false;

    this.hostElement = this.documentRef.createElement('div');
    this.hostElement.className = 'inku-incubator-host';
    this.mountTarget.appendChild(this.hostElement);

    this.view = new IncubatorView({
      documentRef: this.documentRef,
      hostElement: this.hostElement,
      stylesheetText,
      config: this.config
    });

    this.view.mount();
    this.view.bindActions({
      onBuy: () => {
        void this.purchaseCurrentCandidate();
      },
      onPurge: () => {
        void this.purgeCurrentCandidate();
      },
      onOpenStorage: () => {
        if (typeof this.config.hooks.onOpenStorage === 'function') {
          this.config.hooks.onOpenStorage(this);
        }
      }
    });

    this.emit(INCUBATOR_EVENTS.READY, { controller: this });
    return this;
  }

  on(eventName, listener) {
    return this.events.on(eventName, listener);
  }

  getState() {
    return this.stateMachine.getState();
  }

  setAcquireState(state = 'blocked') {
    this.view?.setEnergyMeterState(state);
  }

  getCandidate() {
    return this.currentCandidate;
  }

  setTheme(partialTheme) {
    this.config = deepMerge(this.config, { theme: partialTheme });
  }

  stageCandidate(rawCandidate) {
    this.assertMounted();
    this.assertState('idle');

    const candidate = adaptCandidate(rawCandidate, (normalizedCandidate) => {
      const customComputePrice = this.config.hooks.computePrice;
      if (typeof customComputePrice === 'function') {
        return customComputePrice(normalizedCandidate, this.config.pricing);
      }

      return computeCanonicalPrice(normalizedCandidate, this.config.pricing);
    });

    this.currentCandidate = candidate;
    this.transition('staging');
    this.view.updateCandidate(candidate);
    this.view.updatePrice(candidate.price);
    this.emit(INCUBATOR_EVENTS.CANDIDATE_ATTACHED, { candidate });
    this.emit(INCUBATOR_EVENTS.PRICE_UPDATED, { candidate, price: candidate.price });

    return candidate;
  }

  async startIntake() {
    this.assertMounted();
    this.assertNotBusy();
    this.assertState('staging');

    this.isBusy = true;
    this.view?.setButtonsEnabled(false);

    try {
      const candidate = this.ensureCandidate();
      this.transition('intake');
      this.emit(INCUBATOR_EVENTS.FLOW_STARTED, { candidate, flow: 'intake' });

      this.renderCandidate(candidate);
      await this.delay(this.config.timings.intakeMs);
      if (this.isDestroyed || !this.view) return;

      this.transition('suspended');
      this.view?.setEnergyMeter(0.92);
      this.emit(INCUBATOR_EVENTS.FLOW_COMPLETED, { candidate, flow: 'intake' });
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.isBusy = false;
      this.view?.setButtonsEnabled(true);
    }
  }

  async purchaseCurrentCandidate() {
    this.assertMounted();
    this.assertNotBusy();

    if (this.getState() === 'staging') {
      await this.startIntake();
    }

    this.assertState('suspended');
    this.isBusy = true;
    this.view?.setButtonsEnabled(false);

    try {
      const candidate = this.ensureCandidate();
      this.transition('purchasePending');
      this.emit(INCUBATOR_EVENTS.PURCHASE_REQUESTED, { candidate, price: candidate.price });

      if (typeof this.config.hooks.resolvePurchase === 'function') {
        const purchaseResult = await this.config.hooks.resolvePurchase(candidate, this);
        if (purchaseResult === false) {
          // Purchase aborted (e.g. insufficient funds) — return to suspended so the
          // countdown keeps running and the slime is NOT refreshed.
          this.transition('suspended');
          return;
        }
      }

      await this.delay(this.config.timings.purchaseMs);
      if (this.isDestroyed || !this.view) return;
      this.transition('purchased');
      this.emit(INCUBATOR_EVENTS.PURCHASE_COMPLETED, { candidate, price: candidate.price });
      this.resetRuntime();
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.isBusy = false;
      this.view?.setButtonsEnabled(true);
    }
  }

  async purgeCurrentCandidate() {
    this.assertMounted();
    this.assertNotBusy();
    this.assertCandidateAvailable();

    const state = this.getState();
    if (state === 'staging') {
      // Purge from staging supports the future “reject before full suspension” case.
    } else if (state !== 'suspended') {
      throw new Error(`Cannot purge candidate from state: ${state}`);
    }

    this.isBusy = true;
    this.view?.setButtonsEnabled(false);

    try {
      const candidate = this.ensureCandidate();
      this.transition('purging');
      this.view.setEnergyMeter(0.25);
      this.emit(INCUBATOR_EVENTS.PURGE_STARTED, { candidate });

      if (typeof this.config.hooks.resolvePurge === 'function') {
        await this.config.hooks.resolvePurge(candidate, this);
      }

      await this.delay(this.config.timings.purgeMs);
      if (this.isDestroyed || !this.view) return;
      this.transition('purged');
      this.emit(INCUBATOR_EVENTS.PURGE_COMPLETED, { candidate });
      this.resetRuntime();
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.isBusy = false;
      this.view?.setButtonsEnabled(true);
    }
  }

  resetRuntime() {
    if (this.isDestroyed) return;
    this.clearRenderedCandidate();
    this.currentCandidate = null;
    this.view.updateCandidate(null);
    this.view.updatePrice(null);
    this.view.setEnergyMeter(0.75);
    this.transitionToIdle();
  }

  destroy() {
    this.isDestroyed = true;
    this.clearPendingTimeouts();
    this.view?.destroy();
    this.hostElement?.remove();
    this.events.clear();
    this.hostElement = null;
    this.view = null;
    this.currentCandidate = null;
    this.isBusy = false;
  }

  transition(nextState) {
    const transition = this.stateMachine.transition(nextState);
    const payload = {
      ...transition,
      state: nextState,
      candidate: this.currentCandidate
    };

    const statusLabel = this.config.ui.statusLabels[nextState] || nextState;
    this.view?.updateState({ phase: nextState, statusLabel });

    if (typeof this.config.hooks.onStateChange === 'function') {
      this.config.hooks.onStateChange(payload, this);
    }

    this.emit(INCUBATOR_EVENTS.STATE_CHANGED, payload);
  }

  transitionToIdle() {
    const resetInfo = this.stateMachine.reset();
    const payload = {
      ...resetInfo,
      state: 'idle',
      candidate: null
    };

    this.view?.updateState({
      phase: 'idle',
      statusLabel: this.config.ui.statusLabels.idle
    });

    if (typeof this.config.hooks.onStateChange === 'function') {
      this.config.hooks.onStateChange(payload, this);
    }

    this.emit(INCUBATOR_EVENTS.STATE_CHANGED, payload);
  }

  renderCandidate(candidate) {
    if (this.isDestroyed) return;
    this.clearRenderedCandidate();

    const { renderCandidate } = this.config.hooks;
    if (typeof renderCandidate === 'function') {
      renderCandidate(this.view.getCandidateBay(), candidate, this);
      return;
    }

    const node = this.documentRef.createElement('div');
    node.dataset.incubatorRenderedCandidate = 'true';
    node.className = 'fallback-candidate';
    node.innerHTML = `
      <div class="fallback-candidate__core"></div>
      <div class="fallback-candidate__label">${candidate.displayName}</div>
    `;
    this.view?.getCandidateBay()?.appendChild(node);
  }

  clearRenderedCandidate() {
    if (!this.view || this.isDestroyed) {
      return;
    }

    if (typeof this.config.hooks.clearCandidate === 'function') {
      this.config.hooks.clearCandidate(this.view.getCandidateBay(), this);
    }

    this.view.clearCandidateBay();
  }

  emit(eventName, payload) {
    this.events.emit(eventName, payload);
  }

  ensureCandidate() {
    if (!this.currentCandidate) {
      throw new Error('No candidate is currently loaded in the incubator.');
    }

    return this.currentCandidate;
  }

  assertMounted() {
    if (!this.view) {
      throw new Error('Incubator must be mounted before use.');
    }
  }

  assertState(expectedState) {
    const currentState = this.getState();
    if (currentState !== expectedState) {
      throw new Error(`Expected incubator state "${expectedState}" but got "${currentState}".`);
    }
  }

  assertNotBusy() {
    if (this.isBusy) {
      throw new Error('Incubator is processing another action.');
    }
  }

  assertCandidateAvailable() {
    if (!this.currentCandidate) {
      throw new Error('No candidate is available for this operation.');
    }
  }

  handleError(error) {
    const payload = {
      error,
      state: this.getState(),
      candidate: this.currentCandidate
    };

    if (this.stateMachine.canTransition('error')) {
      this.transition('error');
    }

    if (typeof this.config.hooks.onError === 'function') {
      this.config.hooks.onError(payload, this);
    }

    this.emit(INCUBATOR_EVENTS.ERROR, payload);
  }
}
