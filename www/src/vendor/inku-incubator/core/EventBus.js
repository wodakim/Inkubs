export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    const bucket = this.listeners.get(eventName);
    if (!bucket) {
      return;
    }

    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const bucket = this.listeners.get(eventName);
    if (!bucket) {
      return;
    }

    for (const listener of bucket) {
      listener(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}
