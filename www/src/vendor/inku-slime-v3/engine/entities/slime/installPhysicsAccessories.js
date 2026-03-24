// ═══════════════════════════════════════════════════════════════════════════
//  PHYSICS ACCESSORIES — Verlet-chain dynamic accessories
//
//  Three rare accessories with real per-frame simulation:
//
//  · silk_ribbon    — fabric ribbon draped from slime's back, follows inertia
//  · spectral_tail  — ghost tail with wave locomotion + gravity drag
//  · spring_antenna — springy rod with weighted orb tip, wobbles on movement
//
//  Each accessory stores its chain state on the slime instance and updates
//  it every frame in a dedicated step function called from draw().
// ═══════════════════════════════════════════════════════════════════════════

import { ctx } from '../../../runtime/runtimeState.js';

// ── Verlet chain helpers ──────────────────────────────────────────────────────

/** Integrate one Verlet point: velocity = (pos - old), apply gravity + drag */
function verletStep(pt, gravity, drag) {
    const vx = (pt.x - pt.ox) * drag;
    const vy = (pt.y - pt.oy) * drag;
    pt.ox = pt.x;
    pt.oy = pt.y;
    pt.x += vx;
    pt.y += vy + gravity;
}

/** Constrain two points to a fixed segment length (distance constraint) */
function constrainSegment(a, b, restLen, stiffness = 1) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const diff = (dist - restLen) / dist * stiffness * 0.5;
    b.x -= dx * diff;
    b.y -= dy * diff;
    a.x += dx * diff;
    a.y += dy * diff;
}

// ── Init functions (called once when slime spawns / accessory changes) ────────

export function initPhysicsAccessory(slime) {
    const acc = slime.accessory;
    if (acc === 'silk_ribbon') _initRibbon(slime);
    else if (acc === 'spectral_tail') _initSpectralTail(slime);
    else if (acc === 'spring_antenna') _initSpringAntenna(slime);
}

function _initRibbon(slime) {
    // 8-node verlet chain hanging from slime back
    const N = 10;
    const cx = slime.getRawVisualCenter?.()?.x ?? 0;
    const cy = slime.getRawVisualCenter?.()?.y ?? 0;
    slime._ribbonChain = Array.from({ length: N }, (_, i) => ({
        x: cx, y: cy + i * 6,
        ox: cx, oy: cy + i * 6,
    }));
    // Two parallel chains for ribbon width
    slime._ribbonChainR = Array.from({ length: N }, (_, i) => ({
        x: cx + 3, y: cy + i * 6,
        ox: cx + 3, oy: cy + i * 6,
    }));
    slime._ribbonColor = slime.genome?.hue !== undefined
        ? `hsl(${(slime.genome.hue + 30) % 360},85%,68%)`
        : '#ff88aa';
    slime._ribbonColorDark = slime.genome?.hue !== undefined
        ? `hsl(${(slime.genome.hue + 30) % 360},75%,48%)`
        : '#cc5577';
}

function _initSpectralTail(slime) {
    const N = 14;
    const cx = slime.getRawVisualCenter?.()?.x ?? 0;
    const cy = slime.getRawVisualCenter?.()?.y ?? 0;
    slime._tailChain = Array.from({ length: N }, (_, i) => ({
        x: cx, y: cy + i * 5,
        ox: cx, oy: cy + i * 5,
        phase: i * 0.45,
    }));
    slime._tailHue = slime.genome?.hue ?? 200;
}

function _initSpringAntenna(slime) {
    const cx = slime.getRawVisualCenter?.()?.x ?? 0;
    const cy = slime.getRawVisualCenter?.()?.y ?? 0;
    // 6-segment spring rod + 1 heavy orb tip
    const N = 7;
    slime._antennaChain = Array.from({ length: N }, (_, i) => ({
        x: cx, y: cy - i * 6,
        ox: cx, oy: cy - i * 6,
    }));
    slime._antennaHue = slime.genome?.hue ?? 160;
}

// ── Update + Draw functions (called every frame from draw) ────────────────────

export function updateAndDrawPhysicsAccessory(slime, visualX, visualY) {
    const acc = slime.accessory;
    if (acc === 'silk_ribbon') _updateDrawRibbon(slime, visualX, visualY);
    else if (acc === 'spectral_tail') _updateDrawSpectralTail(slime, visualX, visualY);
    else if (acc === 'spring_antenna') _updateDrawSpringAntenna(slime, visualX, visualY);
}

// ── SILK RIBBON ───────────────────────────────────────────────────────────────
function _updateDrawRibbon(slime, visualX, visualY) {
    if (!slime._ribbonChain) _initRibbon(slime);

    const chain  = slime._ribbonChain;
    const chainR = slime._ribbonChainR;
    const N = chain.length;
    const SEG = 5.5;

    // Anchor: find point on slime surface at ~top-back
    const anchor = slime.getSurfaceAnchor?.(-0.18, -0.7, visualX, visualY);
    const ax = anchor ? anchor.x - anchor.normalX * 2 : visualX;
    const ay = anchor ? anchor.y - anchor.normalY * 2 : visualY - slime.baseRadius * 0.6;

    // Compute surface normal direction to offset the two parallel chains
    const perpX = anchor ? -anchor.normalY : 0;
    const perpY = anchor ? anchor.normalX : 0;
    const halfW = 2.5;

    // Pin the two root nodes to the anchor
    chain[0].x  = ax - perpX * halfW;
    chain[0].y  = ay - perpY * halfW;
    chain[0].ox = chain[0].x;
    chain[0].oy = chain[0].y;
    chainR[0].x  = ax + perpX * halfW;
    chainR[0].y  = ay + perpY * halfW;
    chainR[0].ox = chainR[0].x;
    chainR[0].oy = chainR[0].y;

    // Integrate (skip root)
    const GRAVITY = 0.22;
    const DRAG    = 0.87;
    for (let i = 1; i < N; i++) {
        verletStep(chain[i],  GRAVITY, DRAG);
        verletStep(chainR[i], GRAVITY, DRAG);
    }

    // Distance constraints — multiple relaxation iterations for stiffness
    for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < N - 1; i++) {
            constrainSegment(chain[i],  chain[i+1],  SEG, 0.9);
            constrainSegment(chainR[i], chainR[i+1], SEG, 0.9);
            // Cross-links to keep width consistent
            constrainSegment(chain[i], chainR[i], halfW * 2, 0.7);
        }
        constrainSegment(chain[N-1], chainR[N-1], halfW * 2, 0.7);
        // Re-pin root each iter
        chain[0].x  = ax - perpX * halfW;  chain[0].y  = ay - perpY * halfW;
        chainR[0].x = ax + perpX * halfW;  chainR[0].y = ay + perpY * halfW;
    }

    // ── Draw ribbon as filled polygon between the two chains ──────────────────
    ctx.save();
    ctx.globalAlpha = 0.92;

    // Build path along left chain then back along right
    ctx.beginPath();
    ctx.moveTo(chain[0].x, chain[0].y);
    for (let i = 1; i < N; i++) {
        const prev = chain[i-1];
        const curr = chain[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(chain[N-1].x, chain[N-1].y);
    // Across the tip
    ctx.lineTo(chainR[N-1].x, chainR[N-1].y);
    // Back along right chain
    for (let i = N - 2; i >= 0; i--) {
        const prev = chainR[i+1];
        const curr = chainR[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.closePath();

    // Gradient along ribbon length
    const tipX = (chain[N-1].x + chainR[N-1].x) / 2;
    const tipY = (chain[N-1].y + chainR[N-1].y) / 2;
    const rg = ctx.createLinearGradient(ax, ay, tipX, tipY);
    rg.addColorStop(0,   slime._ribbonColor     ?? '#ff88aa');
    rg.addColorStop(0.45, slime._ribbonColor    ?? '#ff88aa');
    rg.addColorStop(1,   slime._ribbonColorDark ?? '#cc5577');
    ctx.fillStyle = rg;
    ctx.fill();

    // Edge stroke
    ctx.strokeStyle = slime._ribbonColorDark ?? '#cc5577';
    ctx.lineWidth   = 0.8;
    ctx.globalAlpha = 0.5;
    ctx.stroke();

    // Fabric sheen — thin highlight line down the center
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
        const mx = (chain[i].x + chainR[i].x) / 2;
        const my = (chain[i].y + chainR[i].y) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    // Tail bow knot
    ctx.globalAlpha = 0.95;
    const bx = (chain[N-1].x + chainR[N-1].x) / 2;
    const by = (chain[N-1].y + chainR[N-1].y) / 2;
    const bowG = ctx.createRadialGradient(bx, by, 0, bx, by, 5);
    bowG.addColorStop(0, slime._ribbonColor     ?? '#ff88aa');
    bowG.addColorStop(1, slime._ribbonColorDark ?? '#cc5577');
    ctx.fillStyle = bowG;
    ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(bx - 1.2, by - 1.2, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
}

// ── SPECTRAL TAIL ─────────────────────────────────────────────────────────────
function _updateDrawSpectralTail(slime, visualX, visualY) {
    if (!slime._tailChain) _initSpectralTail(slime);

    const chain = slime._tailChain;
    const N = chain.length;
    const now = performance.now() * 0.001;

    // Anchor: bottom-back of slime
    const anchor = slime.getSurfaceAnchor?.(0.1, 0.85, visualX, visualY);
    const ax = anchor?.x ?? visualX;
    const ay = anchor?.y ?? (visualY + slime.baseRadius * 0.7);

    chain[0].x  = ax;
    chain[0].y  = ay;
    chain[0].ox = ax;
    chain[0].oy = ay;

    const GRAVITY = 0.08;
    const DRAG    = 0.90;
    const SEG     = 5.5;
    const WAVE_AMP = 1.6;

    for (let i = 1; i < N; i++) {
        // Gentle lateral wave to give the tail a serpentine ripple
        const wave = Math.sin(now * 2.2 + chain[i].phase) * WAVE_AMP * (i / N);
        verletStep(chain[i], GRAVITY, DRAG);
        chain[i].x += wave * 0.15;
    }

    // Constraints
    for (let iter = 0; iter < 2; iter++) {
        for (let i = 0; i < N - 1; i++) {
            constrainSegment(chain[i], chain[i+1], SEG, 0.85);
        }
        chain[0].x = ax; chain[0].y = ay;
    }

    // ── Draw ghost tail — tapered, semi-transparent, hue-shifted ─────────────
    ctx.save();
    const hue = slime._tailHue;

    for (let i = 0; i < N - 1; i++) {
        const t  = i / (N - 1);        // 0 = root, 1 = tip
        const t2 = (i + 1) / (N - 1);
        const r  = Math.max(0.5, (1 - t)  * 9);   // radius tapers to 0 at tip
        const r2 = Math.max(0.5, (1 - t2) * 9);
        const alpha = (1 - t * 0.75) * 0.62;

        const a = chain[i];
        const b = chain[i + 1];

        // Compute perpendicular to segment for ribbon shape
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const px = -dy / len;
        const py =  dx / len;

        ctx.beginPath();
        ctx.moveTo(a.x + px * r,  a.y + py * r);
        ctx.lineTo(b.x + px * r2, b.y + py * r2);
        ctx.lineTo(b.x - px * r2, b.y - py * r2);
        ctx.lineTo(a.x - px * r,  a.y - py * r);
        ctx.closePath();

        const sg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        sg.addColorStop(0, `hsla(${hue},80%,72%,${alpha})`);
        sg.addColorStop(1, `hsla(${(hue+40)%360},70%,80%,${alpha * 0.6})`);
        ctx.fillStyle = sg;
        ctx.fill();
    }

    // Inner glow core line
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = `hsl(${hue},100%,90%)`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(chain[0].x, chain[0].y);
    for (let i = 1; i < N; i++) {
        const prev = chain[i-1];
        const curr = chain[i];
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x+curr.x)/2, (prev.y+curr.y)/2);
    }
    ctx.stroke();

    // Glowing tip
    const tip = chain[N-1];
    ctx.globalAlpha = 0.6;
    ctx.shadowColor = `hsl(${hue},100%,80%)`;
    ctx.shadowBlur = 8;
    ctx.fillStyle = `hsl(${hue},90%,90%)`;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
    ctx.restore();
}

// ── SPRING ANTENNA ────────────────────────────────────────────────────────────
function _updateDrawSpringAntenna(slime, visualX, visualY) {
    if (!slime._antennaChain) _initSpringAntenna(slime);

    const chain = slime._antennaChain;
    const N = chain.length;
    const SEG = 6;
    const DRAG    = 0.82;
    const GRAVITY = -0.04;   // slight anti-gravity (antenna stands up)

    // Anchor at top of slime
    const anchor = slime.getSurfaceAnchor?.(0, -1, visualX, visualY);
    const ax = anchor?.x ?? visualX;
    const ay = anchor?.y ?? (visualY - slime.baseRadius * 0.95);

    chain[0].x = ax; chain[0].y = ay;
    chain[0].ox = ax; chain[0].oy = ay;

    // Integrate — tip has more mass (heavier drag)
    for (let i = 1; i < N; i++) {
        const tipFactor = i === N - 1 ? 0.72 : DRAG;
        verletStep(chain[i], GRAVITY, tipFactor);
    }

    // Constraints with angle bias (spring prefers upright)
    for (let iter = 0; iter < 4; iter++) {
        for (let i = 0; i < N - 1; i++) {
            constrainSegment(chain[i], chain[i+1], SEG, 0.95);
            // Angular spring: pull each node toward the one above it (upright bias)
            if (i > 0) {
                const bias = 0.04;
                const idealX = chain[i-1].x + (chain[i].x - chain[i-1].x) * 0.98;
                const idealY = chain[i-1].y - SEG;
                chain[i].x += (idealX - chain[i].x) * bias;
                chain[i].y += (idealY - chain[i].y) * bias;
            }
        }
        chain[0].x = ax; chain[0].y = ay;
    }

    // ── Draw spring coil + orb ────────────────────────────────────────────────
    ctx.save();
    const hue = slime._antennaHue;

    // Coil — zig-zag between chain nodes to mimic a spring
    const COILS = 3;  // number of spring coils per segment
    ctx.strokeStyle = `hsl(${hue},60%,55%)`;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.9;

    ctx.beginPath();
    ctx.moveTo(chain[0].x, chain[0].y);
    for (let i = 0; i < N - 1; i++) {
        const a = chain[i];
        const b = chain[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const px = -dy / len * 3.5;
        const py =  dx / len * 3.5;

        for (let c = 0; c < COILS; c++) {
            const t1 = (c) / COILS;
            const t2 = (c + 0.5) / COILS;
            const side = c % 2 === 0 ? 1 : -1;
            // Interpolated mid-point with perpendicular offset
            const mx = a.x + dx * t2;
            const my = a.y + dy * t2;
            ctx.lineTo(a.x + dx * t1, a.y + dy * t1);
            ctx.lineTo(mx + px * side, my + py * side);
        }
        ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // Orb tip — gradient sphere with glow
    const tip = chain[N - 1];
    const orbR = 7;
    ctx.globalAlpha = 1;
    ctx.shadowColor = `hsl(${hue},100%,75%)`;
    ctx.shadowBlur = 12;

    const og = ctx.createRadialGradient(tip.x - 2, tip.y - 2, 0, tip.x, tip.y, orbR);
    og.addColorStop(0, `hsl(${hue},90%,88%)`);
    og.addColorStop(0.5, `hsl(${hue},80%,62%)`);
    og.addColorStop(1, `hsl(${hue},70%,38%)`);
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Specular
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(tip.x - 2.5, tip.y - 2.5, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(tip.x + 1.5, tip.y + 2, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.lineCap = 'butt';
    ctx.restore();
}
