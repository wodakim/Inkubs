const ALLOWED_TRANSITIONS = Object.freeze({
  idle: ['staging'],
  staging: ['intake', 'purging', 'idle'],
  intake: ['suspended', 'error'],
  suspended: ['purchasePending', 'purging', 'error'],
  purchasePending: ['purchased', 'error'],
  purchased: ['idle'],
  purging: ['purged', 'error'],
  purged: ['idle'],
  error: ['idle']
});

export class IncubatorStateMachine {
  constructor(initialState = 'idle') {
    this.state = initialState;
  }

  getState() {
    return this.state;
  }

  canTransition(nextState) {
    const allowed = ALLOWED_TRANSITIONS[this.state] || [];
    return allowed.includes(nextState);
  }

  transition(nextState) {
    if (!this.canTransition(nextState)) {
      throw new Error(`Illegal incubator state transition: ${this.state} -> ${nextState}`);
    }

    const previousState = this.state;
    this.state = nextState;

    return {
      previousState,
      nextState
    };
  }

  reset() {
    const previousState = this.state;
    this.state = 'idle';

    return {
      previousState,
      nextState: 'idle'
    };
  }
}
