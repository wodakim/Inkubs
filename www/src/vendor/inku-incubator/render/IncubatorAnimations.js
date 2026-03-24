export function applyPhaseVisuals(root, phase) {
  root.dataset.phase = phase;
}

export function setLiquidLevel(root, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  root.style.setProperty('--inku-liquid-level', String(clamped));
}

export function setAccentHue(root, hue) {
  root.style.setProperty('--inku-accent-hue', String(hue));
}

export function pulseAction(node) {
  if (!node) {
    return;
  }

  node.classList.remove('is-pulsing');
  void node.offsetWidth;
  node.classList.add('is-pulsing');
}
