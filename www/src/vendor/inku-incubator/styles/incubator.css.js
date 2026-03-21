const stylesheetText = `
:host {
  display: block;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.inku-incubator {
  --inku-accent-hue: 190;
  --inku-accent-rgb: 56, 189, 248;
  --inku-liquid-level: 1;
  --inku-bg: #020617;
  --inku-panel: #111827;
  --inku-metal-1: #0f172a;
  --inku-metal-2: #4b5563;
  --inku-metal-3: #030712;
  --inku-glass: rgba(34, 211, 238, 0.06);
  --inku-glass-border: rgba(31, 41, 55, 0.9);
  --inku-text: rgba(226, 232, 240, 0.94);
  --inku-subtle: rgba(148, 163, 184, 0.88);
  --inku-action: hsl(var(--inku-accent-hue) 88% 56%);
  position: relative;
  display: flex;
  justify-content: center;
  width: min(100%, 860px);
  min-height: 840px;
  margin: 0 auto;
  color: var(--inku-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.frame {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6rem;
  padding: 1.4rem 1.2rem 2rem;
}

.ambient-halo {
  position: absolute;
  inset: 12% 22%;
  border-radius: 999px;
  background: radial-gradient(circle at center, hsla(var(--inku-accent-hue) 85% 55% / 0.18), transparent 68%);
  filter: blur(50px);
  opacity: 0.9;
  pointer-events: none;
}

.display-panel {
  position: relative;
  width: min(72vw, 340px);
  min-width: 240px;
  padding: 6px;
  overflow: hidden;
  border-radius: 12px 12px 8px 8px;
  border: 3px solid #1a2535;
  border-bottom-width: 6px;
  background: #0a0f1a;
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.7),
    inset 0 0 0 1px rgba(255,255,255,0.04),
    0 0 0 1px rgba(0,0,0,0.8);
  text-align: left;
}

/* Outer screen bezel effect */
.display-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%);
  pointer-events: none;
  z-index: 10;
}

/* CRT pixel/scanline overlay */
.display-panel__crt-overlay {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  pointer-events: none;
  z-index: 8;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.18) 2px,
      rgba(0, 0, 0, 0.18) 4px
    );
  mix-blend-mode: multiply;
}

/* Pixel grid texture */
.display-panel__crt-overlay::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0px, transparent 1px, transparent 3px);
  opacity: 0.6;
}

.display-panel__glass,
.display-panel__scanline {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Curved glass sheen */
.display-panel__glass::before {
  content: "";
  position: absolute;
  inset: 6px;
  border-radius: 6px;
  background: linear-gradient(160deg, rgba(255,255,255,0.07) 0%, transparent 50%);
  z-index: 9;
}

/* Moving scanline beam */
.display-panel__scanline::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: hsla(var(--inku-accent-hue) 100% 68% / 0.25);
  box-shadow: 0 0 8px hsla(var(--inku-accent-hue) 100% 68% / 0.3);
  animation: inkuScanline 6s linear infinite;
  z-index: 9;
}

/* Inner screen — the actual display surface */
.display-panel__screen {
  position: relative;
  z-index: 2;
  padding: 0.55rem 0.75rem 0.6rem;
  border-radius: 6px;
  background:
    linear-gradient(180deg, #020d08 0%, #010a14 100%);
  border: 1px solid rgba(0, 255, 100, 0.08);
  box-shadow:
    inset 0 0 20px rgba(0, 255, 120, 0.04),
    inset 0 2px 8px rgba(0,0,0,0.6);
  font-family: 'Courier New', 'Lucida Console', monospace;
  image-rendering: pixelated;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

/* Top row: label left, blinker right */
.display-panel__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.22rem;
  border-bottom: 1px solid hsla(var(--inku-accent-hue) 80% 40% / 0.2);
}

.display-panel__label {
  font-size: 0.58rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: hsla(var(--inku-accent-hue) 70% 55% / 0.65);
  font-family: 'Courier New', monospace;
}

.display-panel__blinker {
  font-size: 0.58rem;
  color: hsla(var(--inku-accent-hue) 80% 65% / 0.9);
  transition: opacity 0.1s;
  font-family: 'Courier New', monospace;
}

/* Status line */
.display-panel__status {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsla(var(--inku-accent-hue) 90% 72% / 0.95);
  text-shadow: 0 0 8px hsla(var(--inku-accent-hue) 100% 68% / 0.5);
  font-family: 'Courier New', monospace;
  line-height: 1.2;
}

.display-panel__divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, hsla(var(--inku-accent-hue) 60% 40% / 0.25), transparent);
  margin: 0;
}

/* Candidate info — horizontal layout for mobile */
.display-panel__candidate-row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 0.5rem;
  row-gap: 0.12rem;
  align-items: start;
}

.display-panel__candidate-name {
  grid-column: 1;
  grid-row: 1;
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(220, 255, 230, 0.96);
  text-shadow: 0 0 10px hsla(var(--inku-accent-hue) 80% 65% / 0.4);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* Price — top right, prominent */
.display-panel__candidate-price {
  grid-column: 2;
  grid-row: 1 / 3;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding-left: 0.4rem;
  border-left: 1px solid hsla(var(--inku-accent-hue) 40% 35% / 0.2);
}

.display-panel__price-label {
  font-size: 0.48rem;
  letter-spacing: 0.2em;
  color: rgba(148, 163, 184, 0.5);
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  line-height: 1;
}

.display-panel__price-value {
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(250, 220, 100, 0.95);
  text-shadow: 0 0 8px rgba(250, 200, 50, 0.35);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  line-height: 1.2;
}

/* Rarity + pattern — bottom left */
.display-panel__candidate-meta {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.display-panel__candidate-rarity {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
}

.display-panel__candidate-pattern {
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  color: rgba(148, 163, 184, 0.6);
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.display-panel__idle-hint {
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  color: hsla(var(--inku-accent-hue) 40% 45% / 0.5);
  font-family: 'Courier New', monospace;
  text-align: center;
  padding: 0.15rem 0;
  animation: inkuIdlePulse 3s ease-in-out infinite;
}

@keyframes inkuIdlePulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}

/* ── Mobile overrides (≤480px) ── */
@media (max-width: 480px) {
  .display-panel {
    width: min(82vw, 300px);
    min-width: 200px;
    padding: 5px;
  }

  .display-panel__screen {
    padding: 0.45rem 0.6rem 0.5rem;
    gap: 0.22rem;
  }

  .display-panel__label {
    font-size: 0.52rem;
    letter-spacing: 0.2em;
  }

  .display-panel__status {
    font-size: 0.65rem;
    letter-spacing: 0.07em;
  }

  .display-panel__candidate-name {
    font-size: 0.72rem;
    letter-spacing: 0.07em;
  }

  .display-panel__price-value {
    font-size: 0.78rem;
  }

  .display-panel__candidate-rarity {
    font-size: 0.52rem;
  }

  .display-panel__candidate-pattern {
    font-size: 0.48rem;
  }

  .display-panel__idle-hint {
    font-size: 0.56rem;
    letter-spacing: 0.16em;
  }
}

.chassis {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(82px, 126px) minmax(248px, 320px) minmax(82px, 140px);
  align-items: end;
  gap: clamp(0.14rem, 0.8vw, 0.55rem);
}

.vessel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.7));
}

.cap,
.base {
  width: min(100%, 280px);
  background: linear-gradient(90deg, var(--inku-metal-1), var(--inku-metal-2), var(--inku-metal-1));
}

.cap {
  height: 58px;
  border-bottom: 2px solid rgba(3, 7, 18, 0.95);
  border-radius: 32px 32px 0 0;
  position: relative;
}

.cap::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 10px;
  width: 44%;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: hsla(var(--inku-accent-hue) 70% 55% / 0.22);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.cap::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, hsla(var(--inku-accent-hue) 60% 38% / 0.48), transparent);
}

.glass-column {
  position: relative;
  width: min(100%, 280px);
  /* Hauteur fixe : l'incubateur est un canvas 560×720px mis à l'échelle
     par CSS transform — vh est inapproprié car il change dynamiquement
     (barre d'adresse mobile) et provoque un reflow qui décale tout l'incubateur. */
  height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-inline: 4px solid var(--inku-glass-border);
  background: linear-gradient(90deg, rgba(8, 47, 73, 0.86), rgba(34, 211, 238, 0.05), rgba(8, 47, 73, 0.86));
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 50px rgba(6, 182, 212, 0.18);
}

.glass-column {
  isolation: isolate;
}

.glass-reflection {
  position: absolute;
  inset: 0 auto 0 16%;
  width: 36%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  transform: skewX(14deg);
  pointer-events: none;
}

.scanner-beam {
  position: absolute;
  top: 12%;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, hsla(var(--inku-accent-hue) 72% 45% / 0.58), transparent);
  box-shadow: 0 0 10px hsla(var(--inku-accent-hue) 72% 45% / 0.45);
}

.candidate-bay {
  position: absolute;
  inset: 13% 12% 34% 12%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.candidate-placeholder {
  max-width: 180px;
  padding: 0.65rem 0.85rem;
  border: 1px dashed hsla(var(--inku-accent-hue) 60% 58% / 0.35);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.36);
  color: rgba(203, 213, 225, 0.75);
  text-align: center;
  font-size: 0.82rem;
}

.liquid-layer {
  position: relative;
  z-index: 1;
  height: calc(var(--inku-liquid-level) * 200%);
  background: linear-gradient(90deg, rgba(14, 116, 144, 0.58), rgba(103, 232, 249, 0.12), rgba(14, 116, 144, 0.58));
  border-top: 1px solid rgba(186, 230, 253, 0.26);
}

.liquid-sheen {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 10px;
  background: linear-gradient(180deg, rgba(165, 243, 252, 0.35), transparent);
  filter: blur(1px);
}

.liquid-depth {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22%;
  background: linear-gradient(180deg, transparent, rgba(8, 47, 73, 0.88));
}

.tube-front-glass {
  position: absolute;
  inset: 0 -4px 0 -4px;
  z-index: 4;
  pointer-events: auto;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.035) 6%, rgba(255,255,255,0.012) 13%, transparent 21%, transparent 79%, rgba(255,255,255,0.012) 87%, rgba(255,255,255,0.035) 94%, rgba(255,255,255,0.14) 100%),
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018) 12%, transparent 34%, transparent 82%, rgba(8,47,73,0.2) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(165,243,252,0.16),
    inset 0 0 28px rgba(56,189,248,0.07);
}

.tube-front-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.028) 15%, transparent 34%, transparent 72%, rgba(8,47,73,0.3) 100%),
    radial-gradient(135% 92% at 50% 3%, rgba(255,255,255,0.13), transparent 30%);
  pointer-events: none;
}

.tube-front-glass::after {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 1px solid rgba(165,243,252,0.28);
  border-bottom: 1px solid rgba(8,47,73,0.45);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    inset 0 -1px 0 rgba(8,47,73,0.25);
  pointer-events: none;
}

.tube-front-glass__spec {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.045) 4%, transparent 16%, transparent 84%, rgba(255,255,255,0.045) 96%, rgba(255,255,255,0.12) 100%),
    radial-gradient(66% 100% at 50% 16%, rgba(255,255,255,0.08), transparent 70%);
  filter: blur(0.2px);
  opacity: 0.62;
  pointer-events: none;
}

.tube-front-glass__rim {
  position: absolute;
  inset: 0 4px;
  border-left: 1px solid rgba(165,243,252,0.16);
  border-right: 1px solid rgba(165,243,252,0.16);
  box-shadow:
    inset 12px 0 18px rgba(255,255,255,0.02),
    inset -12px 0 18px rgba(255,255,255,0.02),
    inset 0 0 22px rgba(56,189,248,0.06);
  pointer-events: none;
}

.tube-front-glass__tap-ripple {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(186,230,253,0.78);
  box-shadow: 0 0 18px rgba(103,232,249,0.34), inset 0 0 8px rgba(255,255,255,0.22);
  background: radial-gradient(circle, rgba(255,255,255,0.14), rgba(165,243,252,0.04) 55%, transparent 75%);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.22);
  pointer-events: none;
}

.tube-front-glass__tap-ripple.is-active {
  animation: inkuGlassTapRipple 380ms cubic-bezier(0.18, 0.7, 0.2, 1) forwards;
}

.incubator-suction-port {
  position: absolute;
  left: 50%;
  top: -2px;
  width: 30%;
  height: 22px;
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.incubator-suction-port::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 0;
  width: 100%;
  height: 12px;
  transform: translateX(-50%);
  border-radius: 0 0 999px 999px;
  background: linear-gradient(180deg, rgba(165,243,252,0.78), rgba(34,211,238,0.1));
  filter: blur(1px);
  box-shadow: 0 0 18px rgba(103,232,249,0.42);
}

.glass-column[data-aspirating="true"] .tube-front-glass::before {
  background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(165,243,252,0.08) 16%, transparent 34%, transparent 70%, rgba(8,47,73,0.42) 100%);
}

.incubator-inlet-port {
  position: absolute;
  left: 50%;
  bottom: -2px;
  width: 26%;
  height: 18px;
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.incubator-inlet-port::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 100%;
  height: 10px;
  transform: translateX(-50%);
  border-radius: 999px 999px 0 0;
  background: linear-gradient(180deg, rgba(34,211,238,0.06), rgba(165,243,252,0.62));
  filter: blur(1px);
  box-shadow: 0 0 14px rgba(103,232,249,0.28);
}

.glass-column[data-extruding="true"] .tube-front-glass::before {
  background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.022) 13%, transparent 32%, transparent 74%, rgba(8,47,73,0.26) 100%), radial-gradient(120% 80% at 50% 98%, rgba(165,243,252,0.18), transparent 24%);
}

.bubble {
  position: absolute;
  bottom: 0;
  border-radius: 999px;
  background: rgba(165, 243, 252, 0.6);
  box-shadow: 0 0 10px rgba(165, 243, 252, 0.25);
  opacity: 0;
}

.bubble--1 { left: 22%; width: 10px; height: 10px; animation: inkuRise 4s ease-in infinite; }
.bubble--2 { left: 48%; width: 6px; height: 6px; animation: inkuRiseAlt 3.5s ease-in infinite 1s; }
.bubble--3 { left: 74%; width: 12px; height: 12px; animation: inkuRise 5s ease-in infinite 2s; }
.bubble--4 { left: 84%; width: 8px; height: 8px; animation: inkuRiseAlt 4.5s ease-in infinite 0.5s; }
.bubble--5 { left: 34%; width: 4px; height: 4px; animation: inkuRise 3.8s ease-in infinite 1.5s; }

.base {
  position: relative;
  height: 112px;
  padding-top: 16px;
  border-top: 2px solid hsla(var(--inku-accent-hue) 60% 35% / 0.4);
  border-radius: 0 0 38px 38px;
}

.base__line {
  width: 68%;
  height: 2px;
  margin: 0 auto 12px;
  background: linear-gradient(90deg, transparent, rgba(3, 7, 18, 0.9), transparent);
}

.base__vent {
  margin-inline: auto;
  background: rgba(2, 6, 23, 0.96);
  border-radius: 999px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
}

.base__vent--lg {
  width: 42%;
  height: 10px;
  margin-bottom: 10px;
}

.base__vent--sm {
  width: 28%;
  height: 6px;
}

.base__shadow {
  position: absolute;
  left: 50%;
  bottom: 6px;
  width: 72%;
  height: 16px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.65);
  filter: blur(4px);
}

.cap,
.base,
.console,
.console-body,
.side-module {
  overflow: hidden;
}

.cap::after,
.base::after,
.console::before,
.console-body::after,
.side-module::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cap::after,
.base::after {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), transparent 18%, transparent 72%, rgba(0,0,0,0.18) 100%),
    repeating-linear-gradient(100deg, rgba(255,255,255,0.025) 0 2px, rgba(255,255,255,0) 2px 10px);
  mix-blend-mode: screen;
  opacity: 0.28;
}

.console::before,
.console-body::after,
.side-module::before {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06), transparent 14%, transparent 82%, rgba(0,0,0,0.16) 100%),
    repeating-linear-gradient(96deg, rgba(255,255,255,0.022) 0 2px, rgba(255,255,255,0) 2px 12px);
  opacity: 0.22;
}

.aux-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.42rem;
}

.aux-panel--left,
.aux-panel--right {
  perspective: 560px;
}

.aux-panel--left {
  align-items: flex-end;
  margin-right: -10px;
  position: relative;
}

.storage-console-trigger {
  position: absolute;
  inset: 0;
  z-index: 6;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.storage-console-trigger:focus-visible {
  outline: 2px solid hsla(var(--inku-accent-hue) 85% 64% / 0.7);
  outline-offset: 4px;
  border-radius: 18px;
}

.storage-console-readout {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.22rem;
  padding: 0.2rem;
  color: rgba(191, 219, 254, 0.92);
  text-align: center;
}

.storage-console-readout__label,
.storage-console-readout__value {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.storage-console-readout__label {
  font-size: 0.62rem;
  color: hsla(var(--inku-accent-hue) 82% 68% / 0.88);
}

.storage-console-readout__value {
  font-size: 0.72rem;
  font-weight: 700;
}

.aux-panel--right {
  align-items: flex-start;
  margin-left: -12px;
}

.side-module {
  position: relative;
  align-self: center;
  width: 48px;
  padding: 0.52rem 0.38rem;
  border-radius: 14px;
  border: 1px solid rgba(100, 116, 139, 0.55);
  background: linear-gradient(135deg, rgba(55, 65, 81, 0.95), rgba(17, 24, 39, 0.98));
  box-shadow: 5px 12px 18px rgba(0, 0, 0, 0.48);
}

.side-module__meter {
  position: relative;
  width: 100%;
  height: 64px;
  padding: 2px;
  display: flex;
  align-items: end;
  border-radius: 8px;
  border: 1px solid hsla(var(--inku-accent-hue) 40% 35% / 0.35);
  background: rgba(2, 6, 23, 0.94);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8);
}

.side-module__meter-fill {
  width: 100%;
  height: 100%;
  transform-origin: bottom center;
  background: linear-gradient(180deg, hsla(var(--inku-accent-hue) 100% 72% / 0.95), hsla(var(--inku-accent-hue) 86% 44% / 0.72));
  box-shadow: 0 0 8px hsla(var(--inku-accent-hue) 100% 70% / 0.32);
  border-radius: 6px;
}

.side-module__toggle {
  width: 22px;
  height: 22px;
  margin: 0.45rem auto 0;
  display: block;
  border: 2px solid rgba(0, 0, 0, 0.7);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(75, 85, 99, 0.94), rgba(15, 23, 42, 0.98));
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.55),
    inset 0 1px 2px rgba(255,255,255,0.1);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 200ms ease, background 200ms ease;
  position: relative;
  overflow: hidden;
}

/* Glint on the LED */
.side-module__toggle::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 3px;
  width: 8px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.35);
  pointer-events: none;
}

/* Green = can buy */
.inku-incubator[data-meter-state="allowed"] .side-module__toggle {
  background: linear-gradient(180deg, #4ade80, #16a34a);
  border-color: #052e16;
  box-shadow:
    0 2px 4px rgba(0,0,0,0.55),
    0 0 12px rgba(74, 222, 128, 0.55),
    inset 0 1px 2px rgba(255,255,255,0.2);
  animation: inkuLedPulse 2.5s ease-in-out infinite;
}

/* Red = cannot buy */
.inku-incubator[data-meter-state="blocked"] .side-module__toggle {
  background: linear-gradient(180deg, #f87171, #dc2626);
  border-color: #450a0a;
  box-shadow:
    0 2px 4px rgba(0,0,0,0.55),
    0 0 10px rgba(248, 113, 113, 0.45),
    inset 0 1px 2px rgba(255,255,255,0.15);
}

@keyframes inkuLedPulse {
  0%, 100% { box-shadow: 0 2px 4px rgba(0,0,0,0.55), 0 0 10px rgba(74, 222, 128, 0.45), inset 0 1px 2px rgba(255,255,255,0.2); }
  50%       { box-shadow: 0 2px 4px rgba(0,0,0,0.55), 0 0 20px rgba(74, 222, 128, 0.75), inset 0 1px 2px rgba(255,255,255,0.2); }
}

.console {
  width: 100%;
  min-height: 84px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(107, 114, 128, 0.95), rgba(55, 65, 81, 0.96));
  box-shadow: inset 0 5px 10px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.console--radar {
  border-radius: 18px 18px 0 0;
  transform-origin: bottom center;
  transform: rotateX(38deg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.console--gauges {
  border-radius: 18px 18px 0 0;
  transform-origin: bottom center;
  transform: rotateX(38deg);
  padding: 1rem 1rem 0.7rem;
}

.console-body {
  min-height: 116px;
  padding: 0.9rem;
  border-top: 2px solid rgba(75, 85, 99, 0.84);
  border-inline: 1px solid rgba(17, 24, 39, 0.96);
  border-bottom: 1px solid rgba(17, 24, 39, 0.96);
  background: linear-gradient(180deg, rgba(55, 65, 81, 0.98), rgba(2, 6, 23, 0.98));
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.05);
}

.console-body--actions {
  min-height: 160px;
}

.aux-panel--left .console,
.aux-panel--left .console-body,
.aux-panel--right .console,
.aux-panel--right .console-body,
.aux-panel--right .side-module {
  position: relative;
}

.aux-panel--left .console::after,
.aux-panel--left .console-body::after,
.aux-panel--right .console::after,
.aux-panel--right .console-body::after,
.aux-panel--right .side-module::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 20px;
  height: 12px;
  transform: translateY(-50%);
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  border-bottom: 1px solid rgba(15, 23, 42, 0.94);
  background: linear-gradient(90deg, rgba(75, 85, 99, 0.96), rgba(31, 41, 55, 0.98));
  box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.05), inset 0 -2px 3px rgba(0, 0, 0, 0.4);
}

.aux-panel--left .console::after,
.aux-panel--left .console-body::after {
  right: -14px;
  border-radius: 0 8px 8px 0;
}

.aux-panel--right .console::after,
.aux-panel--right .console-body::after,
.aux-panel--right .side-module::after {
  left: -14px;
  border-radius: 8px 0 0 8px;
  background: linear-gradient(90deg, rgba(31, 41, 55, 0.98), rgba(75, 85, 99, 0.96));
}

.aux-panel--left .console-body::before,
.aux-panel--right .console-body::before {
  content: "";
  position: absolute;
  top: 12px;
  bottom: 12px;
  width: 6px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(75, 85, 99, 0.94), rgba(17, 24, 39, 0.98));
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.06), inset 0 -2px 3px rgba(0, 0, 0, 0.45);
}

.aux-panel--left .console-body::before {
  right: -8px;
}

.aux-panel--right .console-body::before {
  left: -8px;
}

.radar {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 1px solid hsla(var(--inku-accent-hue) 50% 34% / 0.4);
  background: rgba(2, 6, 23, 0.42);
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.35);
}

.radar__ring,
.radar__cross,
.radar__ping {
  position: absolute;
}

.radar__ring {
  inset: 25%;
  border-radius: 999px;
  border: 1px solid hsla(var(--inku-accent-hue) 60% 52% / 0.34);
}

.radar__cross--h {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-50%);
  background: hsla(var(--inku-accent-hue) 40% 45% / 0.4);
}

.radar__cross--v {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: hsla(var(--inku-accent-hue) 40% 45% / 0.4);
}

.radar__ping {
  top: 11px;
  left: 14px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: hsla(var(--inku-accent-hue) 100% 65% / 0.95);
  box-shadow: 0 0 8px hsla(var(--inku-accent-hue) 100% 65% / 0.56);
  animation: inkuPulse 1.8s ease-in-out infinite;
}

.gauge-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.gauge-strip__bar {
  height: 42px;
  padding: 1px;
  display: flex;
  align-items: end;
  border-radius: 4px;
  border: 1px solid rgba(31, 41, 55, 0.92);
  background: rgba(2, 6, 23, 0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
}

.gauge-strip__bar::before {
  content: "";
  width: 100%;
  border-radius: 2px;
  background: linear-gradient(180deg, hsla(var(--inku-accent-hue) 100% 72% / 0.9), hsla(var(--inku-accent-hue) 68% 32% / 0.78));
}

.gauge-strip__bar--1::before { height: 60%; }
.gauge-strip__bar--2::before { height: 90%; }
.gauge-strip__bar--3::before { height: 40%; }

.console-divider {
  width: 100%;
  height: 6px;
  margin-top: 0.7rem;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.85);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.55);
}

.purchase-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.25rem;
  border-radius: 12px;
  border: 1px solid rgba(30, 41, 59, 0.86);
  background: rgba(2, 6, 23, 0.88);
  box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.84);
}

.purchase-panel__label {
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.82);
}

.purchase-panel__price {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
}

.purchase-panel__candidate {
  min-height: 2.5em;
  font-size: 0.88rem;
  color: rgba(203, 213, 225, 0.88);
}

.purchase-panel__meta {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
  min-height: 1.4em;
}

.purchase-panel__rarity-badge {
  font-size: 0.56rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(200,220,240,0.8);
  transition: color 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
}

.purchase-panel__rarity-badge[data-tier="uncommon"] {
  color: #a5d6a7;
  border-color: rgba(76,175,80,0.4);
}
.purchase-panel__rarity-badge[data-tier="rare"] {
  color: #90caf9;
  border-color: rgba(33,150,243,0.45);
}
.purchase-panel__rarity-badge[data-tier="epic"] {
  color: #ce93d8;
  border-color: rgba(156,39,176,0.5);
  box-shadow: 0 0 8px rgba(156,39,176,0.3);
  animation: incubator-rarity-pulse-epic 2.8s ease-in-out infinite;
}
.purchase-panel__rarity-badge[data-tier="legendary"] {
  color: #ffcc02;
  border-color: rgba(255,152,0,0.6);
  box-shadow: 0 0 12px rgba(255,152,0,0.4);
  animation: incubator-rarity-pulse-legendary 2s ease-in-out infinite;
}

@keyframes incubator-rarity-pulse-epic {
  0%, 100% { box-shadow: 0 0 6px rgba(156,39,176,0.28); }
  50%       { box-shadow: 0 0 14px rgba(156,39,176,0.6); }
}
@keyframes incubator-rarity-pulse-legendary {
  0%, 100% { box-shadow: 0 0 8px rgba(255,152,0,0.35); }
  50%       { box-shadow: 0 0 20px rgba(255,200,0,0.7); }
}

.purchase-panel__pattern-badge {
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(148,163,184,0.6);
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
}
.purchase-panel__pattern-badge[data-pattern="galaxy_swirl"],
.purchase-panel__pattern-badge[data-pattern="aurora"],
.purchase-panel__pattern-badge[data-pattern="prismatic"],
.purchase-panel__pattern-badge[data-pattern="void_rift"],
.purchase-panel__pattern-badge[data-pattern="crystal_facets"] {
  color: rgba(186,104,200,0.8);
  border-color: rgba(186,104,200,0.2);
}

.purchase-panel__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
}

.action-button {
  min-height: 40px;
  padding: 0.65rem 0.9rem;
  border-radius: 10px;
  border: 1px solid transparent;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: transform 120ms ease, opacity 120ms ease, border-color 120ms ease;
}

.action-button:disabled,
.side-module__toggle:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.action-button--primary {
  background: linear-gradient(180deg, hsla(var(--inku-accent-hue) 100% 68% / 0.95), hsla(var(--inku-accent-hue) 72% 42% / 0.82));
  color: #04111d;
}

.action-button--secondary {
  border-color: rgba(71, 85, 105, 0.85);
  background: rgba(15, 23, 42, 0.95);
  color: rgba(226, 232, 240, 0.92);
}

.action-button:hover:not(:disabled),
.side-module__toggle:hover:not(:disabled) {
  transform: translateY(-1px);
}

.is-pulsing {
  animation: inkuPress 220ms ease-out;
}

.fallback-candidate {
  width: 120px;
  display: grid;
  place-items: center;
  gap: 0.65rem;
  text-align: center;
  color: rgba(226, 232, 240, 0.95);
}

.fallback-candidate__core {
  width: 84px;
  height: 84px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 38% 32%, rgba(255,255,255,0.4), transparent 22%),
    radial-gradient(circle at center, hsla(var(--inku-accent-hue) 100% 72% / 0.96), hsla(var(--inku-accent-hue) 76% 42% / 0.72));
  box-shadow:
    0 0 24px hsla(var(--inku-accent-hue) 100% 68% / 0.36),
    inset 0 -14px 20px rgba(0, 0, 0, 0.22);
}

.fallback-candidate__label {
  font-size: 0.78rem;
  font-weight: 600;
}

.inku-incubator[data-phase="intake"] .fallback-candidate,
.inku-incubator[data-phase="purging"] .fallback-candidate {
  animation: inkuCandidateTravel 820ms ease-in-out infinite alternate;
}

.inku-incubator[data-phase="purchasePending"] .fallback-candidate__core,
.inku-incubator[data-phase="purchased"] .fallback-candidate__core {
  animation: inkuApproval 420ms ease-in-out infinite alternate;
}



.inku-incubator[data-meter-state="allowed"] .side-module__meter-fill {
  background: linear-gradient(180deg, rgba(134,239,172,0.98), rgba(34,197,94,0.72));
  box-shadow: 0 0 10px rgba(74,222,128,0.28);
}

.inku-incubator[data-meter-state="blocked"] .side-module__meter-fill {
  background: linear-gradient(180deg, rgba(248,113,113,0.98), rgba(220,38,38,0.72));
  box-shadow: 0 0 10px rgba(248,113,113,0.24);
}

.inku-incubator[data-integration-embed-mode="true"] {
  width: 560px;
  min-height: 720px;
}

.inku-incubator[data-integration-embed-mode="true"] .frame {
  gap: 1.15rem;
  padding: 1.0rem 0.4rem 1.1rem;
}

.inku-incubator[data-integration-embed-mode="true"] .display-panel {
  width: 340px;
  min-width: 340px;
  align-self: center;
  margin-inline: auto;
}

.inku-incubator[data-integration-embed-mode="true"] .chassis {
  width: 528px;
  margin-inline: auto;
  grid-template-columns: 116px 296px 116px;
  justify-content: center;
  gap: 0;
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel {
  gap: 0;
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel--left {
  align-items: stretch;
  margin-right: -4px;
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel--right {
  align-items: stretch;
  margin-left: -4px;
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel--left::before,
.inku-incubator[data-integration-embed-mode="true"] .aux-panel--right::before {
  content: "";
  position: absolute;
  top: 58%;
  width: 22px;
  height: 12px;
  transform: translateY(-50%);
  border-top: 1px solid rgba(148, 163, 184, 0.24);
  border-bottom: 1px solid rgba(15, 23, 42, 0.96);
  background: linear-gradient(180deg, rgba(100, 116, 139, 0.96), rgba(30, 41, 59, 0.98));
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.08), inset 0 -2px 3px rgba(0,0,0,0.38);
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel--left::before {
  right: -8px;
  border-radius: 0 8px 8px 0;
}

.inku-incubator[data-integration-embed-mode="true"] .aux-panel--right::before {
  left: -8px;
  border-radius: 8px 0 0 8px;
}

.inku-incubator[data-integration-embed-mode="true"] .console,
.inku-incubator[data-integration-embed-mode="true"] .console-body,
.inku-incubator[data-integration-embed-mode="true"] .side-module {
  width: 100%;
}

.inku-incubator[data-integration-embed-mode="true"] .console {
  min-height: 78px;
  border-top-color: rgba(165, 180, 252, 0.18);
  background: linear-gradient(180deg, rgba(99, 111, 132, 0.98), rgba(52, 65, 86, 0.98));
}

.inku-incubator[data-integration-embed-mode="true"] .console--radar,
.inku-incubator[data-integration-embed-mode="true"] .console--gauges {
  transform: rotateX(22deg);
}

.inku-incubator[data-integration-embed-mode="true"] .console-body {
  min-height: 126px;
  padding: 0.8rem;
  border-top: 0;
  background: linear-gradient(180deg, rgba(62, 73, 93, 0.98), rgba(4, 9, 21, 0.98));
}

.inku-incubator[data-integration-embed-mode="true"] .storage-console-readout {
  gap: 0.16rem;
}

.inku-incubator[data-integration-embed-mode="true"] .storage-console-readout__label {
  font-size: 0.58rem;
}

.inku-incubator[data-integration-embed-mode="true"] .storage-console-readout__value {
  font-size: 0.68rem;
}

.inku-incubator[data-integration-embed-mode="true"] .console-body--actions {
  position: relative;
  min-height: 126px;
  padding: 0;
}

.inku-incubator[data-integration-embed-mode="true"] .purchase-panel {
  display: none;
}

.inku-incubator[data-integration-embed-mode="true"] .console-body--actions::after {
  content: "";
  position: absolute;
  inset: 14px 12px;
  border-radius: 12px;
  border: 1px solid rgba(44, 58, 84, 0.96);
  background:
    linear-gradient(180deg, rgba(7, 15, 30, 0.98), rgba(3, 8, 21, 0.98)),
    linear-gradient(180deg, rgba(81, 97, 122, 0.18), transparent);
  box-shadow: inset 0 8px 18px rgba(255,255,255,0.03), inset 0 -8px 16px rgba(0,0,0,0.42);
}

.inku-incubator[data-integration-embed-mode="true"] .console-body--actions::before {
  content: "";
  position: absolute;
  left: 22px;
  right: 22px;
  top: 28px;
  height: 2px;
  background: linear-gradient(90deg, transparent, hsla(var(--inku-accent-hue) 70% 54% / 0.46), transparent);
  box-shadow: 0 0 8px hsla(var(--inku-accent-hue) 75% 55% / 0.24);
}

.inku-incubator[data-integration-embed-mode="true"] .side-module {
  align-self: center;
  width: 54px;
  padding: 0.4rem 0.34rem 0.36rem;
  border-radius: 14px;
  margin-bottom: 6rem;
  right: 2rem;
}

.inku-incubator[data-integration-embed-mode="true"] .side-module__meter {
  height: 54px;
  border-radius: 7px;
}

.inku-incubator[data-integration-embed-mode="true"] .side-module__toggle {
  width: 16px;
  height: 16px;
  margin: 0.32rem auto 0;
  text-indent: -9999px;
  overflow: hidden;
}

.inku-incubator[data-integration-embed-mode="true"] .side-module::after {
  top: 64%;
}

@media (max-width: 430px) {
  .inku-incubator[data-integration-embed-mode="true"] .display-panel {
    width: 308px;
    min-width: 308px;
  }

  .inku-incubator[data-integration-embed-mode="true"] .chassis {
    width: 500px;
    grid-template-columns: 102px 296px 102px;
  }

  .inku-incubator[data-integration-embed-mode="true"] .cap,
  .inku-incubator[data-integration-embed-mode="true"] .base,
  .inku-incubator[data-integration-embed-mode="true"] .glass-column {
    width: 272px;
  }

  .inku-incubator[data-integration-embed-mode="true"] .candidate-bay {
    inset: 11% 10% 31% 10%;
  }

  .inku-incubator[data-integration-embed-mode="true"] .side-module {
    margin-bottom: 5.2rem;
    right: 1.5rem;
  }
}

@media (max-width: 760px) {
  .inku-incubator:not([data-integration-embed-mode="true"]) {
    min-height: auto;
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .chassis {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 1rem;
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .aux-panel {
    width: min(100%, 320px);
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .aux-panel--left {
    order: 2;
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .vessel {
    order: 1;
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .aux-panel--right {
    order: 3;
  }

  .inku-incubator:not([data-integration-embed-mode="true"]) .display-panel {
    width: min(88vw, 320px);
  }
}

@keyframes inkuGlassTapRipple {
  0% { opacity: 0.88; transform: translate(-50%, -50%) scale(0.18); }
  65% { opacity: 0.46; transform: translate(-50%, -50%) scale(5.8); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(7.1); }
}

@keyframes inkuRise {
  0% { transform: translateY(0) scale(0.8); opacity: 0; }
  10% { opacity: 0.85; }
  90% { opacity: 0.85; transform: translateY(-240px) scale(1.1) translateX(3px); }
  100% { transform: translateY(-260px) scale(1.2); opacity: 0; }
}

@keyframes inkuRiseAlt {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  10% { opacity: 0.65; }
  90% { opacity: 0.65; transform: translateY(-220px) scale(0.92) translateX(-3px); }
  100% { transform: translateY(-250px) scale(1); opacity: 0; }
}

@keyframes inkuScanline {
  0% { transform: translateY(-100%); opacity: 0; }
  10% { opacity: 0.5; }
  90% { opacity: 0.5; }
  100% { transform: translateY(100%); opacity: 0; }
}

@keyframes inkuPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.18); opacity: 0.72; }
}

@keyframes inkuPress {
  0% { transform: scale(1); }
  50% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

@keyframes inkuCandidateTravel {
  from { transform: translateY(0) scale(0.98); }
  to { transform: translateY(-22px) scale(1.03); }
}

@keyframes inkuApproval {
  from { filter: saturate(1) brightness(1); }
  to { filter: saturate(1.3) brightness(1.15); }
}
.inku-incubator[data-integration-hide-actions="true"] .purchase-panel__actions,
.inku-incubator[data-integration-hide-actions="true"] .purchase-panel__price {
  display: none;
}

.inku-incubator[data-integration-hide-actions="true"] .console-body--actions {
  min-height: 124px;
}

.inku-incubator[data-integration-hide-actions="true"] .purchase-panel {
  justify-content: flex-start;
  gap: 0.45rem;
}

`;

export default stylesheetText;
