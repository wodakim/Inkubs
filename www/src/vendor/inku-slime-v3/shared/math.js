export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function pickRandom(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

export function safeFinite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
