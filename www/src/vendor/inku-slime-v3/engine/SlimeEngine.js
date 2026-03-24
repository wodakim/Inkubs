import { ensureCanvasPolyfills } from '../shared/canvasPolyfills.js';
import {
  ctx,
  currentSlime,
  inputState,
  particles,
  setCanvas,
  setCurrentSlime,
  setViewport,
  setWorldBounds,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  clearParticles,
} from '../runtime/runtimeState.js';
import { Slime } from './entities/Slime.js';

function updateKeyState(code, isDown) {
  if (code === 'ArrowLeft') inputState.left = isDown;
  if (code === 'ArrowRight') inputState.right = isDown;
  if (code === 'ArrowUp' && isDown) inputState.jumpQueued = true;
}

function getPointerPos(e) {
  if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

export class SlimeEngine {
  constructor({
    canvas,
    windowRef = globalThis.window,
    interactive = false,
    showContainmentBox = false,
    autoExposeDebugBridge = false,
    autoResize = true,
    viewportWidth = null,
    viewportHeight = null,
    worldWidth = null,
    worldHeight = null,
    spawnOnInit = true,
    pointerTarget = null,
  }) {
    if (!canvas) {
      throw new Error('SlimeEngine requires a canvas.');
    }

    ensureCanvasPolyfills();
    const context = canvas.getContext('2d', { alpha: true });
    setCanvas(canvas, context);
    this.canvas = canvas;
    this.ctx = context;
    this.windowRef = windowRef;
    this.interactive = interactive;
    this.showContainmentBox = showContainmentBox;
    this.autoExposeDebugBridge = autoExposeDebugBridge;
    this.autoResize = autoResize;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.explicitWorldWidth = worldWidth;
    this.explicitWorldHeight = worldHeight;
    this.spawnOnInit = spawnOnInit;
    this.pointerTarget = pointerTarget || canvas;
    this.rafId = 0;
    this.boundLoop = this.gameLoop.bind(this);
    this.resize = this.resize.bind(this);
    this.cleanupCallbacks = [];
    this.camera = { x: Number.NaN, y: Number.NaN, zoom: 1 };

    if (this.interactive) {
      this.registerEvents();
    }

    this.resize();
    if (this.spawnOnInit) {
      this.spawnSlime();
    }

    if (this.autoExposeDebugBridge) {
      this.exposeDebugBridge();
    }
  }

  addListener(target, type, listener, options) {
    if (!target || typeof target.addEventListener !== 'function') {
      return;
    }
    target.addEventListener(type, listener, options);
    this.cleanupCallbacks.push(() => target.removeEventListener(type, listener, options));
  }

  resize() {
    // Re-bind global rendering context to this engine's canvas.
    // Multiple SlimeEngine instances (labo + prairie) share the same global ctx
    // from runtimeState.js. When the prairie mounts it overrides ctx with its own
    // canvas; calling resize() here ensures the correct canvas is restored before
    // the game loop runs.
    setCanvas(this.canvas, this.ctx);

    const nextWidth = Math.max(1, Math.round(
      this.viewportWidth
      || this.canvas.clientWidth
      || this.canvas.width
      || this.windowRef?.innerWidth
      || 1
    ));
    const nextHeight = Math.max(1, Math.round(
      this.viewportHeight
      || this.canvas.clientHeight
      || this.canvas.height
      || this.windowRef?.innerHeight
      || 1
    ));
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    setViewport(nextWidth, nextHeight);

    const nextWorldWidth = Math.max(1, Math.round(this.explicitWorldWidth || nextWidth));
    const nextWorldHeight = Math.max(1, Math.round(this.explicitWorldHeight || nextHeight));
    setWorldBounds(nextWorldWidth, nextWorldHeight);

    if (!Number.isFinite(this.camera.x) || !Number.isFinite(this.camera.y)) {
      this.camera.x = nextWorldWidth * 0.5;
      this.camera.y = nextWorldHeight * 0.5;
    }
  }

  setWorldBounds(nextWidth, nextHeight) {
    this.explicitWorldWidth = Math.max(1, Math.round(nextWidth || this.canvas.width || 1));
    this.explicitWorldHeight = Math.max(1, Math.round(nextHeight || this.canvas.height || 1));
    setWorldBounds(this.explicitWorldWidth, this.explicitWorldHeight);
  }

  setCamera({ x = this.camera.x, y = this.camera.y, zoom = this.camera.zoom } = {}) {
    const safeZoom = Number.isFinite(zoom) ? Math.max(0.1, zoom) : this.camera.zoom;
    this.camera.x = Number.isFinite(x) ? x : this.camera.x;
    this.camera.y = Number.isFinite(y) ? y : this.camera.y;
    this.camera.zoom = safeZoom;
  }

  getCamera() {
    return { ...this.camera };
  }

  screenToWorld(clientX, clientY, rect = this.canvas.getBoundingClientRect?.()) {
    if (!rect || !rect.width || !rect.height) {
      return null;
    }

    const localX = ((clientX - rect.left) / rect.width) * (viewportWidth || this.canvas.width || 1);
    const localY = ((clientY - rect.top) / rect.height) * (viewportHeight || this.canvas.height || 1);
    const zoom = Number.isFinite(this.camera.zoom) ? this.camera.zoom : 1;

    return {
      x: this.camera.x + (localX - (viewportWidth || this.canvas.width || 1) * 0.5) / zoom,
      y: this.camera.y + (localY - (viewportHeight || this.canvas.height || 1) * 0.5) / zoom,
    };
  }

  worldToScreen(worldX, worldY) {
    const zoom = Number.isFinite(this.camera.zoom) ? this.camera.zoom : 1;
    return {
      x: ((worldX - this.camera.x) * zoom) + (viewportWidth || this.canvas.width || 1) * 0.5,
      y: ((worldY - this.camera.y) * zoom) + (viewportHeight || this.canvas.height || 1) * 0.5,
    };
  }

  spawnSlime(options = {}) {
    const slime = new Slime(options);
    setCurrentSlime(slime);
    return slime;
  }

  clearSlime() {
    setCurrentSlime(null);
    clearParticles();
  }

  applyVerticalImpulse(amount = 0) {
    if (!currentSlime || !Number.isFinite(amount) || amount === 0) {
      return;
    }
    for (const pt of currentSlime.nodes) {
      if (!Number.isFinite(pt.y)) continue;
      pt.oldY = pt.y - amount;
    }
  }

  getCurrentSlime() {
    return currentSlime;
  }

  exposeDebugBridge() {
    if (!this.windowRef) {
      return;
    }
    this.windowRef.__slimeDebug = {
      respawn: (options = {}) => this.metrics(this.spawnSlime(options)),
      step: (frames = 1) => {
        const count = Math.max(1, Math.floor(frames));
        for (let i = 0; i < count; i++) {
          if (currentSlime) currentSlime.update();
        }
        return this.metrics();
      },
      playAction: (action, duration = 900, intensity = 1) => {
        if (!currentSlime) return null;
        currentSlime.triggerAction(action, duration, intensity);
        return this.metrics();
      },
      clearAction: () => {
        if (!currentSlime) return null;
        currentSlime.clearAction();
        return this.metrics();
      },
      metrics: () => this.metrics(),
      snapshot: () => currentSlime ? currentSlime.exportCanonicalSnapshot() : null,
      livingState: () => currentSlime ? currentSlime.exportLivingStateSnapshot() : null,
      claimPayload: (options = {}) => currentSlime ? currentSlime.exportCanonicalClaimPayload(options) : null,
      bindCanonicalClaim: (canonicalRecord) => {
        if (!currentSlime) return null;
        return currentSlime.bindCanonicalClaim(canonicalRecord);
      },
      remember: (kind, payload = {}, options = {}) => {
        if (!currentSlime) return null;
        currentSlime.remember(kind, payload, options);
        return currentSlime.exportLivingStateSnapshot();
      },
      recordEvent: (eventType, payload = {}, options = {}) => {
        if (!currentSlime) return null;
        return currentSlime.recordEvent(eventType, payload, options);
      }
    };
  }

  metrics() {
    if (!currentSlime) return null;
    const center = currentSlime.getRawVisualCenter();
    const box = currentSlime.getBoxBounds();
    let grounded = 0;
    let sumVx = 0;
    for (const pt of currentSlime.nodes) {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.oldX) || !Number.isFinite(pt.y)) continue;
      if (pt.y >= box.bottom - 1.5) grounded++;
      sumVx += (pt.x - pt.oldX);
    }
    return {
      centerX: center.x,
      centerY: center.y,
      groundedRatio: grounded / currentSlime.nodes.length,
      avgVx: sumVx / currentSlime.nodes.length,
      type: currentSlime.type,
      bodyShape: currentSlime.bodyShape,
      friction: currentSlime.friction,
      rigidity: currentSlime.rigidity,
      groundVelocityRetention: currentSlime.groundVelocityRetention,
      groundedRatioExact: currentSlime.getGroundedRatio(),
      locomotionState: currentSlime.locomotionState,
      actionState: currentSlime.actionState,
      facing: currentSlime.facing,
      stats: currentSlime.stats,
      runtimeId: currentSlime.identity.runtimeId,
      proceduralSeed: currentSlime.identity.proceduralSeed,
      proceduralFingerprint: currentSlime.identity.proceduralFingerprint,
      canonicalStatus: currentSlime.identity.canonical.status,
      canonicalId: currentSlime.identity.canonical.canonicalId,
      continuityStage: currentSlime.livingState?.continuity?.lifecycleStage || null,
      memoryCount: currentSlime.livingState?.memoryLedger?.counters?.totalMemories || 0,
      significantMemoryCount: currentSlime.livingState?.memoryLedger?.counters?.significantMemories || 0
    };
  }

  registerEvents() {
    const pointerTarget = this.pointerTarget || this.canvas;
    this.addListener(this.windowRef, 'resize', this.resize);
    this.addListener(pointerTarget, 'mousedown', (e) => {
      const point = this.screenToWorld(getPointerPos(e).x, getPointerPos(e).y, this.canvas.getBoundingClientRect?.());
      if (currentSlime && point) currentSlime.checkGrab(point.x, point.y);
    });
    this.addListener(pointerTarget, 'mousemove', (e) => {
      const point = this.screenToWorld(getPointerPos(e).x, getPointerPos(e).y, this.canvas.getBoundingClientRect?.());
      if (currentSlime && point) currentSlime.updateGrab(point.x, point.y);
    });
    this.addListener(pointerTarget, 'mouseup', () => { if (currentSlime) currentSlime.releaseGrab(); });
    this.addListener(pointerTarget, 'mouseleave', () => { if (currentSlime) currentSlime.releaseGrab(); });

    this.addListener(pointerTarget, 'touchstart', (e) => {
      const point = this.screenToWorld(getPointerPos(e).x, getPointerPos(e).y, this.canvas.getBoundingClientRect?.());
      if (currentSlime && point) currentSlime.checkGrab(point.x, point.y);
    }, { passive: false });
    this.addListener(pointerTarget, 'touchmove', (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      const point = this.screenToWorld(getPointerPos(e).x, getPointerPos(e).y, this.canvas.getBoundingClientRect?.());
      if (currentSlime && point) currentSlime.updateGrab(point.x, point.y);
    }, { passive: false });
    this.addListener(pointerTarget, 'touchend', () => { if (currentSlime) currentSlime.releaseGrab(); });
    this.addListener(pointerTarget, 'touchcancel', () => { if (currentSlime) currentSlime.releaseGrab(); });

    this.addListener(this.windowRef, 'keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp') {
        e.preventDefault();
        updateKeyState(e.code, true);
        return;
      }
      if (!currentSlime) return;
      const actionMap = { KeyA: 'attack', KeyH: 'hurt', KeyO: 'observe', KeyF: 'flee', KeyQ: 'question', KeyS: 'study' };
      if (actionMap[e.code]) {
        e.preventDefault();
        currentSlime.triggerAction(actionMap[e.code]);
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        currentSlime.clearAction();
      }
    });

    this.addListener(this.windowRef, 'keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        updateKeyState(e.code, false);
      }
    });

    this.addListener(this.windowRef, 'blur', () => {
      inputState.left = false;
      inputState.right = false;
      inputState.jumpQueued = false;
    });
  }

  gameLoop() {
    // Safety guard: if the global ctx has been re-assigned to a different canvas
    // (e.g. prairie called setCanvas after this engine was suspended), abort this
    // frame silently. This prevents the incubator slime from drawing itself onto
    // the prairie canvas when the player navigates back to the prairie.
    if (ctx && ctx.canvas !== this.canvas) {
      this.rafId = requestAnimationFrame(this.boundLoop);
      return;
    }
    const viewWidth = viewportWidth || this.canvas.width || 1;
    const viewHeight = viewportHeight || this.canvas.height || 1;
    const zoom = Number.isFinite(this.camera.zoom) ? this.camera.zoom : 1;
    const translateX = (viewWidth * 0.5) - ((Number.isFinite(this.camera.x) ? this.camera.x : (worldWidth || viewWidth) * 0.5) * zoom);
    const translateY = (viewHeight * 0.5) - ((Number.isFinite(this.camera.y) ? this.camera.y : (worldHeight || viewHeight) * 0.5) * zoom);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ctx.setTransform(zoom, 0, 0, zoom, translateX, translateY);

    if (currentSlime) {
      currentSlime.update();
      if (this.showContainmentBox) {
        currentSlime.drawContainmentBox();
      }
      currentSlime.draw();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      if (p.life <= 0) particles.splice(i, 1);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  start() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  destroy() {
    this.stop();
    this.cleanupCallbacks.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    this.cleanupCallbacks.length = 0;
    clearParticles();
    setCurrentSlime(null);
  }
}
