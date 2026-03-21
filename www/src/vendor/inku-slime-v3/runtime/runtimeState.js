export let canvas = null;
export let ctx = null;
export let viewportWidth = 0;
export let viewportHeight = 0;
export let worldWidth = 0;
export let worldHeight = 0;
export let currentSlime = null;
export const particles = [];
export const inputState = { left: false, right: false, jumpQueued: false };

/** Qualité de rendu des slimes — mis à jour par device-performance-profile */
export let renderQuality = {
    subsurface:  true,
    rarityAura:  true,
    bodyOverlay: true,
    highlights:  true,
    rimLight:    true,
};

export function setCanvas(nextCanvas, nextCtx) {
  canvas = nextCanvas;
  ctx = nextCtx;
}

export function setViewport(nextWidth, nextHeight) {
  viewportWidth = nextWidth;
  viewportHeight = nextHeight;
}

export function setWorldBounds(nextWidth, nextHeight) {
  worldWidth = nextWidth;
  worldHeight = nextHeight;
}

export function setCurrentSlime(slime) {
  currentSlime = slime;
}

export function pushParticle(particle) {
  particles.push(particle);
}

export function clearParticles() {
  particles.length = 0;
}

export function setRenderQuality(settings) {
  renderQuality = { ...renderQuality, ...settings };
}
