import { ctx } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';
import { getPerformanceTier } from '../../utils/device-performance-profile.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export function getNearestInteractiveObject(state, worldX, worldY, maxDist = 80) {
    let best = null, bestDist = maxDist;
    for (const obj of state.prairieObjects) {
        if (!obj.interactive) continue;
        const d = Math.hypot(obj.x - worldX, (obj.y || state.world.groundY) - worldY);
        if (d < bestDist) { bestDist = d; best = obj; }
    }
    return best;
}

// ── Core Object Management ─────────────────────────────────────────────────

export function buildPrairieObjects(state) {
    if (!state.world || state.world.width < 100) return;
    const rng = seededRandom(42 + Math.round(state.world.width));
    state.prairieObjects = [];
    const gY = state.world.groundY;
    const wL = state.world.left + 60;
    const wR = state.world.right - 60;
    const wSpan = wR - wL;

    // Grass tufts
    const grassCount = Math.round(wSpan / 45);
    for (let i = 0; i < grassCount; i++) {
        const x = wL + rng() * wSpan;
        const h = 8 + rng() * 18;
        const blades = 2 + Math.floor(rng() * 4);
        state.prairieObjects.push({
            type: 'grass', x, y: gY, height: h, blades,
            hue: 110 + rng() * 40, alpha: 0.35 + rng() * 0.3,
            sway: rng() * Math.PI * 2, swaySpeed: 0.0008 + rng() * 0.001,
            interactive: false,
        });
    }

    // Flowers
    const flowerCount = 5 + Math.floor(rng() * 6);
    for (let i = 0; i < flowerCount; i++) {
        const x = wL + 80 + rng() * (wSpan - 160);
        state.prairieObjects.push({
            type: 'flower', x, y: gY,
            petalHue: rng() * 360, petalCount: 4 + Math.floor(rng() * 4),
            size: 10 + rng() * 14, stemH: 22 + rng() * 20,
            sway: rng() * Math.PI * 2, swaySpeed: 0.001 + rng() * 0.0008,
            interactive: true, interactRadius: 50,
        });
    }

    // Rocks
    const rockCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < rockCount; i++) {
        const x = wL + 100 + rng() * (wSpan - 200);
        const w = 28 + rng() * 40;
        const h = 16 + rng() * 24;
        state.prairieObjects.push({
            type: 'rock', x, y: gY, w, h,
            hue: 180 + rng() * 50, lightness: 22 + rng() * 15,
            roughness: rng(),
            interactive: true, interactRadius: w * 0.8,
            solid: true,
        });
    }

    // Balls
    const ballCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < ballCount; i++) {
        const x = wL + 120 + rng() * (wSpan - 240);
        const radius = 7 + rng() * 6;
        state.prairieObjects.push({
            type: 'ball', x, y: gY - radius, radius,
            vx: 0, vy: 0,
            hue: rng() * 360, saturation: 60 + rng() * 30,
            interactive: true, interactRadius: radius * 2.5,
            throwable: true, grabbed: false,
        });
    }

    // Mushrooms
    const mushCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < mushCount; i++) {
        const x = wL + 80 + rng() * (wSpan - 160);
        state.prairieObjects.push({
            type: 'mushroom', x, y: gY,
            capHue: rng() > 0.5 ? (350 + rng() * 20) : (30 + rng() * 30),
            capW: 14 + rng() * 12, capH: 8 + rng() * 8,
            stemH: 10 + rng() * 12, dots: Math.floor(rng() * 5),
            interactive: true, interactRadius: 40,
        });
    }

    // Tree stumps
    const stumpCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < stumpCount; i++) {
        const x = wL + 200 + rng() * (wSpan - 400);
        state.prairieObjects.push({
            type: 'stump', x, y: gY,
            w: 40 + rng() * 30, h: 25 + rng() * 20,
            rings: 2 + Math.floor(rng() * 3),
            interactive: true, interactRadius: 60,
        });
    }

    // Benches
    const benchCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < benchCount; i++) {
        const x = wL + 250 + rng() * (wSpan - 500);
        state.prairieObjects.push({
            type: 'bench', x, y: gY,
            w: 68 + rng() * 20, h: 18,
            legH: 20 + rng() * 6,
            woodHue: 28 + rng() * 12,
            _sitters: new Set(),
            _sitterCount: 0,
            interactive: true, interactRadius: 80,
        });
    }

    // Puddles
    const puddleCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < puddleCount; i++) {
        const x = wL + 100 + rng() * (wSpan - 200);
        state.prairieObjects.push({
            type: 'puddle', x, y: gY + 2,
            w: 35 + rng() * 40, h: 4 + rng() * 4,
            interactive: true, interactRadius: 45,
        });
    }

    // Giant Tree
    state.prairieObjects.push({
        type: 'tree', x: state.world.width * 0.5, y: gY - 2000, w: 280,
        interactive: false,
    });

    // Terrarium House
    const houseY = gY - 800;
    const houseW = 1800;
    const houseH = 500;
    const houseX = state.world.width * 0.5 - houseW * 0.5;
    state.prairieObjects.push({
        type: 'terrarium', x: houseX, y: houseY, w: houseW, h: 35, houseH: houseH,
        interactive: false,
    });

    // Jump Ball
    state.prairieObjects.push({
        type: 'jump_ball', x: state.world.width * 0.5, y: houseY - houseH + 80, r: 45,
        interactive: true,
    });

    // Teleporters
    const teleX = wL + wSpan * 0.25;
    const houseTeleX = houseX + 120;
    state.prairieObjects.push({ type: 'teleporter', x: teleX, y: gY, targetX: houseTeleX, targetY: houseY - 80, interactive: true });
    state.prairieObjects.push({ type: 'teleporter', x: houseTeleX, y: houseY - 35, targetX: teleX, targetY: gY - 80, interactive: true });

    // Trampoline
    state.prairieObjects.push({
        type: 'trampoline', x: wL + wSpan * 0.75, y: gY, w: 100, h: 25,
        interactive: true,
    });

    // Small round bushes
    const bushCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < bushCount; i++) {
        const x = wL + 60 + rng() * (wSpan - 120);
        const r = 8 + rng() * 8;
        const leafHue = 105 + rng() * 30;
        state.prairieObjects.push({
            type: 'bush', x, y: gY, r, leafHue, interactive: false,
        });
    }

    // Berry bushes
    const BERRY_TYPES = ['red', 'blue', 'yellow'];
    const berryBushCount = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < berryBushCount; i++) {
        const x = wL + 80 + rng() * (wSpan - 160);
        const berryType = BERRY_TYPES[Math.floor(rng() * BERRY_TYPES.length)];
        const maxBerries = 3 + Math.floor(rng() * 5);
        state.prairieObjects.push({
            type: 'berry_bush', x, y: gY, berryType,
            berryCount: maxBerries, maxBerries, r: 12 + rng() * 8, leafHue: 110 + rng() * 25,
            _lastRegrowAt: 0, _lastEatenAt: 0, interactive: true, interactRadius: 60,
        });
    }

    // Birds
    const birdCount = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < birdCount; i++) {
        const x = wL + 120 + rng() * (wSpan - 240);
        state.prairieObjects.push({
            type: 'bird', x, y: gY, state: 'landed', vx: 0, vy: 0,
            hue: 20 + rng() * 340, size: 7 + rng() * 5, _spawnX: x,
            _nextLandAt: 0, _startledAt: 0, _capturedAt: 0, alertRadius: 110 + rng() * 40,
            interactive: true, interactRadius: 55,
        });
    }

    // Pebble clusters
    const pebbleGroupCount = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < pebbleGroupCount; i++) {
        const x = wL + 40 + rng() * (wSpan - 80);
        const count = 2 + Math.floor(rng() * 3);
        const pebbles = [];
        for (let j = 0; j < count; j++) {
            pebbles.push({ dx: (j - count * 0.5) * (6 + rng() * 5), r:  Math.max(2, 2 + rng() * 4), hue: 170 + rng() * 60, l: 28 + rng() * 18 });
        }
        state.prairieObjects.push({ type: 'pebbles', x, y: gY, pebbles, interactive: false });
    }

    state.prairieObjects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

export function updatePrairieObjects(state) {
    const now = performance.now();
    for (const obj of state.prairieObjects) {
        if (obj.type === 'ball' && !obj.grabbed) {
            obj.vy += 0.4;
            obj.vx *= 0.97;
            obj.x += obj.vx;
            obj.y += obj.vy;
            const floorY = state.world.groundY - obj.radius;
            if (obj.y > floorY) {
                obj.y = floorY; obj.vy *= -0.35; obj.vx *= 0.85;
                if (Math.abs(obj.vy) < 0.5) obj.vy = 0;
            }
            if (obj.x < state.world.left + obj.radius) { obj.x = state.world.left + obj.radius; obj.vx = Math.abs(obj.vx) * 0.5; }
            if (obj.x > state.world.right - obj.radius) { obj.x = state.world.right - obj.radius; obj.vx = -Math.abs(obj.vx) * 0.5; }
        }

        if (obj.type === 'berry_bush' && obj.berryCount < obj.maxBerries) {
            const REGROW_INTERVAL = 30000;
            if (now - obj._lastRegrowAt > REGROW_INTERVAL) {
                obj._lastRegrowAt = now;
                obj.berryCount = Math.min(obj.maxBerries, obj.berryCount + 1);
            }
        }

        if (obj.type === 'bird') {
            _updateBird(state, obj, now);
        }
    }
}

function _updateBird(state, bird, now) {
    switch (bird.state) {
        case 'landed': {
            let startled = false;
            for (const entry of state.runtimeById.values()) {
                const slime = entry.slime;
                const diet = slime.genome?.dietType || 'omnivore';
                if (diet === 'herbivore') continue;
                const brain = slime._prairieBrain;
                if (!brain) continue;
                const sc = slime.getRawVisualCenter?.() || slime.getVisualCenter?.() || { x: 0, y: 0 };
                const d = Math.hypot(sc.x - bird.x, sc.y - bird.y);
                if (d < bird.alertRadius) {
                    const movingFast = Math.abs(slime._aiSpeedMul || 0) > 0.8 && brain.behavior !== 'hunt_bird';
                    if (movingFast) { startled = true; break; }
                }
            }
            if (startled) { bird.state = 'startled'; bird._startledAt = now; }
            break;
        }
        case 'startled': {
            bird.vx = (Math.random() - 0.5) * 6; bird.vy = -4 - Math.random() * 3; bird.state = 'flying';
            break;
        }
        case 'flying': {
            bird.x += bird.vx; bird.y += bird.vy; bird.vy -= 0.1; bird.vx *= 0.98;
            if (bird.y < -200 || bird.x < state.world.left - 300 || bird.x > state.world.right + 300) {
                bird.state = 'landing'; bird._nextLandAt = now + 15000 + Math.random() * 20000;
                bird.x = state.world.left + 100 + Math.random() * (state.world.right - state.world.left - 200);
                bird.y = state.world.groundY - 500;
            }
            break;
        }
        case 'captured': {
            if (!bird._nextLandAt || bird._nextLandAt === 0) bird._nextLandAt = now + 20000 + Math.random() * 20000;
            if (now > bird._nextLandAt) {
                bird.x = state.world.left + 100 + Math.random() * (state.world.right - state.world.left - 200);
                bird.y = state.world.groundY; bird.vx = 0; bird.vy = 0; bird.state = 'landed'; bird._nextLandAt = 0;
            }
            break;
        }
        case 'landing': {
            if (now > bird._nextLandAt) { bird.y = state.world.groundY; bird.vx = 0; bird.vy = 0; bird.state = 'landed'; }
            break;
        }
    }
}

// ── Rendering Cache ────────────────────────────────────────────────────────
const bgCache = {};

function getCachedG(obj, key, createFn, fallback, tier) {
    if (tier === 'low') return fallback;
    if (!obj._rc) obj._rc = {};
    if (!obj._rc[key]) obj._rc[key] = createFn();
    return obj._rc[key];
}

function getSkyGradient(state) {
    if (bgCache.sky) return bgCache.sky;
    const g = ctx.createLinearGradient(0, state.world.top - 800, 0, state.world.groundY);
    g.addColorStop(0, '#121930'); g.addColorStop(1, '#2c3c5c');
    return bgCache.sky = g;
}

function getGroundGradient(state) {
    if (bgCache.gnd) return bgCache.gnd;
    const g = ctx.createLinearGradient(0, state.world.groundY, 0, state.world.bottom + 500);
    g.addColorStop(0, '#1f3a36'); g.addColorStop(1, '#0e1c1a');
    return bgCache.gnd = g;
}

// ── Rendering Functions (Uses imported Canvas 'ctx') ───────────────────────

export function drawPrairieObjects(state) {
    if (!ctx) return;
    const now = performance.now();
    const tier = getPerformanceTier();

    ctx.save();
    ctx.translate(state.camera.x * 0.8, state.camera.y * 0.15);

    ctx.fillStyle = tier === 'low' ? '#1c2841' : getSkyGradient(state);
    ctx.fillRect(state.world.left - 4000, -4000, state.world.width + 8000, state.world.groundY + 4000);

    ctx.fillStyle = '#223d4f';
    ctx.fillRect(state.world.left - 4000, state.world.groundY - 2, state.world.width + 8000, 5);
    ctx.restore();

    ctx.fillStyle = tier === 'low' ? '#1f3a36' : getGroundGradient(state);
    ctx.fillRect(state.world.left - 2000, state.world.groundY, state.world.width + 4000, state.world.bottom - state.world.groundY + 1000);

    const drawGroundShadow = (x, y, radius, alpha = 0.3) => {
        ctx.fillStyle = `rgba(15, 20, 35, ${alpha})`;
        ctx.beginPath(); ctx.ellipse(x, y + 2, radius, radius * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    };

    const sortedObjects = [...state.prairieObjects].sort((a, b) => {
        const getZ = (o) => (o.type === 'tree' ? -100000 : (o.type === 'terrarium' ? -99999 : o.y));
        return getZ(a) - getZ(b) || a.x - b.x;
    });

    for (const obj of sortedObjects) {
        if (tier === 'low') {
            if (!obj.interactive && (obj.type === 'grass' || obj.type === 'pebbles')) continue;
        }

        ctx.save();
        switch (obj.type) {
            case 'tree': {
                const c = getCachedG(obj, 'trk', () => {
                     const g = ctx.createLinearGradient(obj.x - obj.w*0.5, 0, obj.x + obj.w*0.5, 0);
                     g.addColorStop(0, '#162130'); g.addColorStop(0.5, '#28364c'); g.addColorStop(1, '#0e1421');
                     return g;
                }, '#1f2b3e', tier);
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(obj.x - obj.w * 0.35, -2000); ctx.lineTo(obj.x + obj.w * 0.35, -2000);
                ctx.bezierCurveTo(obj.x + obj.w * 0.35, state.world.groundY - 400, obj.x + obj.w * 0.5, state.world.groundY - 50, obj.x + obj.w * 0.9, state.world.groundY);
                ctx.lineTo(obj.x - obj.w * 0.9, state.world.groundY);
                ctx.bezierCurveTo(obj.x - obj.w * 0.5, state.world.groundY - 50, obj.x - obj.w * 0.35, state.world.groundY - 400, obj.x - obj.w * 0.35, -2000);
                ctx.fill();
                if (tier !== 'low') {
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.beginPath(); ctx.moveTo(obj.x - obj.w*0.1, -2000); ctx.quadraticCurveTo(obj.x - obj.w*0.15, state.world.groundY - 300, obj.x - obj.w*0.5, state.world.groundY); ctx.lineTo(obj.x - obj.w*0.4, state.world.groundY); ctx.quadraticCurveTo(obj.x - obj.w*0.05, state.world.groundY - 300, obj.x, -2000); ctx.fill();
                }
                break;
            }
            case 'terrarium': {
                const hX = obj.x, hY = obj.y - obj.h, hW = obj.w, hH = obj.houseH;
                const cw = getCachedG(obj, 'wal', () => {
                     const g = ctx.createLinearGradient(hX, 0, hX + hW, 0);
                     g.addColorStop(0, '#2b1b14'); g.addColorStop(0.5, '#3b251c'); g.addColorStop(1, '#1f130c');
                     return g;
                }, '#301d16', tier);
                ctx.fillStyle = cw; ctx.fillRect(hX - 30, hY - hH - 30, hW + 60, hH + 60 + obj.h);
                ctx.fillStyle = '#140c08'; ctx.fillRect(hX, hY - hH, hW, hH);
                
                const pY = hY - hH + 120;
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hX + 156, pY + 6, 100, 120);
                ctx.fillStyle = '#e5b83b'; ctx.fillRect(hX + 150, pY, 100, 120);
                ctx.fillStyle = '#1a1a1a'; ctx.fillRect(hX + 155, pY + 5, 90, 110);
                ctx.fillStyle = getCachedG(obj, 'sun', () => {
                     const s = ctx.createLinearGradient(0, pY, 0, pY + 100);
                     s.addColorStop(0, '#ff7c7c'); s.addColorStop(1, '#fed368'); return s;
                }, '#ffa355', tier);
                ctx.fillRect(hX + 160, pY + 10, 80, 100);
                
                const tY = hY - 60, tX = hX + hW * 0.5;
                ctx.fillStyle = '#7a4e24';
                ctx.fillRect(tX - 220, tY - 100, 15, 160); ctx.fillRect(tX - 220, tY + 10, 80, 15); ctx.fillRect(tX - 160, tY + 25, 15, 35);   
                ctx.fillRect(tX + 205, tY - 100, 15, 160); ctx.fillRect(tX + 140, tY + 10, 80, 15); ctx.fillRect(tX + 145, tY + 25, 15, 35);   
                ctx.fillStyle = '#422814'; ctx.fillRect(tX - 100, tY + 10, 200, 20);
                ctx.fillStyle = '#2b1a0d'; ctx.fillRect(tX - 80, tY + 30, 20, 30); ctx.fillRect(tX + 60, tY + 30, 20, 30);
                ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.arc(tX - 40, tY + 5, 10, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(tX + 40, tY + 5, 10, 0, Math.PI); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tX-40, tY-5); ctx.quadraticCurveTo(tX-35, tY-15, tX-45, tY-25); ctx.stroke();
                
                const drawLamp = (lx, ly) => {
                    ctx.strokeStyle = '#141414'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lx, hY - hH); ctx.lineTo(lx, ly - 20); ctx.stroke();
                    ctx.fillStyle = '#fdcb33'; ctx.beginPath(); ctx.moveTo(lx - 35, ly + 10); ctx.lineTo(lx + 35, ly + 10); ctx.lineTo(lx + 15, ly - 20); ctx.lineTo(lx - 15, ly - 20); ctx.fill();
                    if (tier !== 'low') {
                        ctx.fillStyle = getCachedG(obj, `lamp_${lx}`, () => {
                             const g = ctx.createRadialGradient(lx, ly + 20, 0, lx, ly + 50, 300);
                             g.addColorStop(0, 'rgba(253, 203, 51, 0.2)'); g.addColorStop(1, 'rgba(253, 203, 51, 0)'); return g;
                        }, 'rgba(0,0,0,0)', tier);
                        ctx.beginPath(); ctx.arc(lx, ly + 50, 300, 0, Math.PI * 2); ctx.fill();
                    }
                };
                drawLamp(hX + 300, hY - hH + 180); drawLamp(hX + hW - 300, hY - hH + 180);
                
                const fg = getCachedG(obj, 'flr', () => {
                     const g = ctx.createLinearGradient(0, hY, 0, hY + obj.h);
                     g.addColorStop(0, '#422814'); g.addColorStop(1, '#211309'); return g;
                }, '#362110', tier);
                ctx.fillStyle = fg; ctx.fillRect(hX - 20, hY, hW + 40, obj.h);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.5;
                for(let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(hX-20, hY + (obj.h/4)*i); ctx.lineTo(hX+hW+20, hY + (obj.h/4)*i); ctx.stroke(); }
                break;
            }
            case 'grass': {
                const sP = now * 0.0012 + obj.sway;
                const sw = Math.sin(sP) * 6; 
                ctx.strokeStyle = `hsla(150, 50%, 28%, ${obj.alpha})`; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
                for (let b = 0; b < obj.blades; b++) {
                    const bx = obj.x + (b - obj.blades * 0.5) * 6;
                    const bsw = sw + Math.sin(sP + b * 0.5) * 3.5; 
                    ctx.beginPath(); ctx.moveTo(bx, obj.y); ctx.quadraticCurveTo(bx + bsw * 0.5, obj.y - obj.height * 0.5, bx + bsw, obj.y - obj.height * (0.8 + (b%2)*0.2)); ctx.stroke();
                }
                break;
            }
            case 'flower': {
                drawGroundShadow(obj.x, obj.y, obj.size * 0.6);
                const sw = Math.sin(now * 0.0015 + obj.sway) * 5;
                const tX = obj.x + sw, tY = obj.y - obj.stemH;
                ctx.strokeStyle = '#2d6a4f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(obj.x, obj.y); ctx.quadraticCurveTo(obj.x + sw * 0.5, obj.y - obj.stemH * 0.5, tX, tY); ctx.stroke();
                
                ctx.fillStyle = `hsla(${obj.petalHue}, 75%, 70%, 0.95)`;
                for (let p = 0; p < obj.petalCount; p++) {
                    const a = (p / obj.petalCount) * Math.PI * 2 + (now * 0.0005);
                    const px = tX + Math.cos(a) * obj.size * 0.5, py = tY + Math.sin(a) * obj.size * 0.35;
                    ctx.beginPath(); ctx.ellipse(px, py, obj.size * 0.35, obj.size * 0.2, a, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(tX, tY, obj.size * 0.22, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'rock': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6, 0.4);
                const hw = obj.w*0.5, hh = obj.h;
                ctx.fillStyle = `hsla(${obj.hue}, 20%, ${obj.lightness}%, 1)`;
                ctx.beginPath(); ctx.moveTo(obj.x - hw, obj.y); 
                ctx.bezierCurveTo(obj.x - hw, obj.y - hh*0.8, obj.x - hw*0.4, obj.y - hh, obj.x, obj.y - hh);
                ctx.bezierCurveTo(obj.x + hw*0.6, obj.y - hh, obj.x + hw, obj.y - hh*0.6, obj.x + hw, obj.y);
                ctx.fill();
                if (tier !== 'low') {
                    ctx.fillStyle = `hsla(${obj.hue}, 25%, ${obj.lightness + 18}%, 0.4)`;
                    ctx.beginPath(); ctx.ellipse(obj.x - hw*0.2, obj.y - hh*0.6, hw*0.3, hh*0.3, -0.2, 0, Math.PI*2); ctx.fill();
                }
                break;
            }
            case 'ball': {
                drawGroundShadow(obj.x, state.world.groundY, obj.radius * 0.8);
                const r = obj.radius;
                const c = getCachedG(obj, 'bal', () => {
                    const g = ctx.createRadialGradient(obj.x - r * 0.3, obj.y - r * 0.3, r * 0.1, obj.x, obj.y, r);
                    g.addColorStop(0, `hsla(${obj.hue}, ${obj.saturation}%, 80%, 1)`); g.addColorStop(1, `hsla(${obj.hue}, ${obj.saturation}%, 30%, 1)`);
                    return g;
                }, `hsla(${obj.hue}, ${obj.saturation}%, 55%, 1)`, tier);
                ctx.fillStyle = c; ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.fill();
                if (tier !== 'low') {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.beginPath(); ctx.ellipse(obj.x - r * 0.3, obj.y - r * 0.4, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'mushroom': {
                drawGroundShadow(obj.x, obj.y, obj.capW * 0.4);
                const sh = obj.stemH, cw = obj.capW, ch = obj.capH;
                ctx.fillStyle = '#e8dec2'; ctx.beginPath(); ctx.roundRect(obj.x - 5, obj.y - sh, 10, sh, 4); ctx.fill();
                if(tier !== 'low') { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(obj.x + 1, obj.y - sh, 4, sh); }
                ctx.fillStyle = `hsla(${obj.capHue}, 75%, 60%, 1)`;
                ctx.beginPath(); ctx.moveTo(obj.x - cw*0.65, obj.y - sh + 1);
                ctx.bezierCurveTo(obj.x - cw*0.65, obj.y - sh - ch*2, obj.x + cw*0.65, obj.y - sh - ch*2, obj.x + cw*0.65, obj.y - sh + 1);
                ctx.quadraticCurveTo(obj.x, obj.y - sh + ch*0.6, obj.x - cw*0.65, obj.y - sh + 1); ctx.fill();
                if (tier !== 'low') {
                    for (let d = 0; d < obj.dots; d++) {
                        const da = (d / obj.dots) * Math.PI - Math.PI * 0.1, dr = cw * 0.35;
                        const dX = obj.x + Math.cos(da) * dr, dY = obj.y - sh - Math.sin(da) * ch * 0.8;
                        ctx.fillStyle = 'rgba(255, 255, 250, 0.85)'; ctx.beginPath(); ctx.arc(dX, dY, 2.5, 0, Math.PI * 2); ctx.fill();
                    }
                }
                break;
            }
            case 'puddle': {
                const sh = 0.2 + Math.sin(now * 0.0015 + obj.x * 0.01) * 0.1;
                ctx.fillStyle = `rgba(130, 200, 220, ${tier==='low' ? 0.4 : sh + 0.3})`;
                ctx.beginPath(); ctx.ellipse(obj.x, obj.y, obj.w * 0.5, obj.h, 0, 0, Math.PI * 2); ctx.fill();
                if (tier !== 'low') {
                    ctx.fillStyle = 'rgba(190, 240, 255, 0.4)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, obj.w * 0.3, obj.h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'teleporter': {
                drawGroundShadow(obj.x, obj.y, 45, 0.4);
                const t = now * 0.0025;
                const r = 32 + Math.sin(t * 2) * 3;
                ctx.fillStyle = 'rgba(40, 140, 220, 0.3)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r * 1.3, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(100, 220, 255, 0.6)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(180, 240, 255, 0.9)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r * 0.7, r * 0.2, t, 0, Math.PI * 2); ctx.stroke();
                
                if (tier !== 'low') {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    for(let i=0; i<4; i++) {
                        const py = obj.y - ((now * 0.06 + i * 18) % 60), px = obj.x + Math.sin(py * 0.12) * 12;
                        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
                    }
                }
                break;
            }
            case 'berry_bush':
            case 'bush': {
                drawGroundShadow(obj.x, obj.y, obj.r * 1.2);
                const r = obj.r;
                ctx.fillStyle = `hsla(${obj.leafHue}, 42%, 35%, 1)`;
                ctx.beginPath();
                ctx.arc(obj.x - r * 0.4, obj.y - r * 0.5, r * 0.75, 0, Math.PI*2);
                ctx.arc(obj.x + r * 0.4, obj.y - r * 0.5, r * 0.7, 0, Math.PI*2);
                ctx.arc(obj.x, obj.y - r * 0.75, r * 0.9, 0, Math.PI*2);
                ctx.fill();

                if (tier !== 'low') {
                    ctx.fillStyle = `hsla(${obj.leafHue + 8}, 48%, 50%, 1)`;
                    ctx.beginPath();
                    ctx.arc(obj.x, obj.y - r * 0.95, r * 0.4, 0, Math.PI*2);
                    ctx.arc(obj.x - r * 0.4, obj.y - r * 0.7, r * 0.3, 0, Math.PI*2);
                    ctx.fill();
                }

                if (obj.type === 'berry_bush' && obj.berryCount > 0) {
                    const cb = { red: '350, 80%, 58%', blue: '220, 80%, 65%', yellow: '45, 90%, 60%' }[obj.berryType] || '350, 80%, 58%';
                    const pos = [ {dx:-r*0.3, dy:-r*0.8}, {dx:r*0.2, dy:-r*1.0}, {dx:0, dy:-r*0.6}, {dx:-r*0.6, dy:-r*0.5}, {dx:r*0.5, dy:-r*0.6} ];
                    for (let bi = 0; bi < Math.min(obj.berryCount, pos.length); bi++) {
                        const px = obj.x + pos[bi].dx, py = obj.y + pos[bi].dy;
                        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(px, py+2, 4.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = `hsla(${cb}, 1)`; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
                        if (tier !== 'low') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(px-1.5, py-1.5, 1.5, 0, Math.PI * 2); ctx.fill(); }
                    }
                }
                break;
            }
            case 'stump': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6);
                const hw = obj.w*0.5;
                ctx.fillStyle = '#4f3727';
                ctx.beginPath(); ctx.roundRect(obj.x - hw*0.9, obj.y - obj.h, obj.w*0.9, obj.h, 4); ctx.fill();
                ctx.fillStyle = '#e3c194'; 
                ctx.beginPath(); ctx.ellipse(obj.x - hw*0.05, obj.y - obj.h, hw*0.9, obj.h*0.3, 0, 0, Math.PI*2); ctx.fill();
                if (tier !== 'low') {
                    ctx.strokeStyle = 'rgba(130, 90, 60, 0.4)'; ctx.lineWidth = 1.5;
                    for (let r = 1; r <= obj.rings; r++) { const rf = r / (obj.rings + 1); ctx.beginPath(); ctx.ellipse(obj.x - hw*0.05, obj.y - obj.h, hw*0.8*rf, obj.h*0.25*rf, 0, 0, Math.PI*2); ctx.stroke(); }
                    ctx.fillStyle = '#48b877'; ctx.beginPath(); ctx.ellipse(obj.x - hw*0.75, obj.y - 5, 14, 8, -0.2, 0, Math.PI*2); ctx.fill();
                }
                break;
            }
            case 'bench': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6);
                const hw = obj.w * 0.5, sY = obj.y - obj.legH;
                ctx.fillStyle = '#333'; 
                [-hw * 0.7, -hw * 0.3, hw * 0.3, hw * 0.7].forEach(lx => { ctx.fillRect(obj.x + lx - 2, sY, 4, obj.legH); });
                ctx.fillStyle = `hsla(${obj.woodHue}, 42%, 45%, 1)`; ctx.beginPath(); ctx.roundRect(obj.x - hw * 0.9, sY - 4, obj.w * 0.9 + hw*0.9, 10, 5); ctx.fill();
                const bY = sY - obj.h;
                ctx.fillRect(obj.x - hw*0.75 - 2, bY, 4, obj.h); ctx.fillRect(obj.x + hw*0.65 - 2, bY, 4, obj.h);
                ctx.beginPath(); ctx.roundRect(obj.x - hw * 0.9, bY - 6, obj.w * 0.9 + hw*0.9, 14, 6); ctx.fill();
                break;
            }
            case 'jump_ball': {
                const r = obj.r * (1 + Math.sin(now * 0.005) * 0.05);
                const c = getCachedG(obj, 'jmp', () => {
                     const g = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, r);
                     g.addColorStop(0, 'rgba(255, 240, 100, 0.9)'); g.addColorStop(1, 'rgba(255, 140, 0, 0.2)'); return g;
                }, 'rgba(255, 200, 50, 0.7)', tier);
                ctx.fillStyle = c; ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'trampoline': {
                const tX = obj.x - obj.w * 0.5, tY = obj.y - obj.h;
                ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(tX + 15, obj.y); ctx.lineTo(tX + 15, tY); ctx.moveTo(tX + obj.w - 15, obj.y); ctx.lineTo(tX + obj.w - 15, tY); ctx.stroke();
                ctx.fillStyle = '#1a1a1a'; ctx.fillRect(tX, tY, obj.w, 12);
                ctx.strokeStyle = '#e6395e'; ctx.lineWidth = 4; ctx.strokeRect(tX, tY, obj.w, 12);
                break;
            }
            case 'pebbles': {
                for (const p of obj.pebbles) {
                    const pr = Math.max(2, p.r);
                    ctx.fillStyle = `hsla(${p.hue}, 10%, ${p.l - 5}%, 0.8)`;
                    ctx.beginPath(); ctx.arc(obj.x + p.dx, obj.y - pr * 0.5, pr, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'bird': {
                if (obj.state === 'captured' || obj.state === 'landing') break;
                if (obj.y < state.world.groundY - 800) break;
                const sz = obj.size, h = obj.hue, iF = obj.state === 'flying' || obj.state === 'startled';
                ctx.save(); ctx.translate(obj.x, obj.y);
                if (iF) {
                    const f = Math.sin(now * 0.018) * 0.45;
                    ctx.fillStyle = `hsla(${h}, 55%, 45%, 1)`; ctx.beginPath(); ctx.ellipse(0, -sz * 0.3, sz * 0.45, sz * 0.28, -0.3, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `hsla(${h}, 45%, 35%, 1)`; ctx.beginPath(); ctx.ellipse(-sz * 0.6, -sz * 0.35 - f * sz, sz * 0.55, sz * 0.18, -0.5 - f, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.ellipse(sz * 0.6, -sz * 0.35 - f * sz, sz * 0.55, sz * 0.18, 0.5 + f, 0, Math.PI * 2); ctx.fill();
                } else {
                    ctx.fillStyle = `hsla(${h}, 55%, 45%, 1)`; ctx.beginPath(); ctx.ellipse(0, -sz * 0.38, sz * 0.42, sz * 0.32, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `hsla(${h + 15}, 60%, 55%, 1)`; ctx.beginPath(); ctx.arc(sz * 0.28, -sz * 0.68, sz * 0.22, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fdb833'; ctx.beginPath(); ctx.moveTo(sz * 0.48, -sz * 0.70); ctx.lineTo(sz * 0.70, -sz * 0.62); ctx.lineTo(sz * 0.48, -sz * 0.60); ctx.fill();
                }
                ctx.restore();
                break;
            }
        }
        ctx.restore();
    }
}

export function drawHouseGlass(state) {
    if (!ctx) return;
    const tier = getPerformanceTier();
    for (const obj of state.prairieObjects) {
        if (obj.type === 'terrarium') {
            const hX = obj.x, hY = obj.y - obj.h, hW = obj.w, hH = obj.houseH;
            ctx.fillStyle = 'rgba(215, 235, 255, 0.05)'; ctx.fillRect(hX, hY - hH, hW, hH);
            if (tier !== 'low') {
                const cw = getCachedG(obj, 'gls', () => {
                    const g = ctx.createLinearGradient(hX, hY-hH, hX+hW, hY);
                    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.01)');
                    return g;
                }, 'transparent', tier);
                ctx.fillStyle = cw; ctx.beginPath(); ctx.moveTo(hX+150, hY-hH); ctx.lineTo(hX+450, hY-hH); ctx.lineTo(hX+hW-150, hY); ctx.lineTo(hX+hW-450, hY); ctx.fill();
            }
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 10; ctx.strokeRect(hX, hY - hH, hW, hH);
        }
    }
}

// ── Speech Bubbles ────────────────────────────────────────────────────────

const INKUBUS_VOCAB = {
    happy: ['möki!', 'puu~', 'nyah♪', 'buu☆', 'kiki!', 'pyoo~', 'wah!', 'myu♡', 'yupii!', 'pöpö~', 'nihi!', 'füü☆', 'möö möö!', 'kya kya!', 'wuiii~', 'pipipi!', 'boing~', 'nyuu nyuu!', 'füfü♪', 'hoho~', 'yayy!', 'möki möki!', 'puu puu~', 'tehee~', 'wiiii!'],
    curious: ['hm?', 'nuu?', 'eeh~', 'kö?', 'mhh..', 'öö?', 'wha~?', 'nn?', 'hmmm~?', 'nani?', 'kökö?', 'öhö?', 'fufu?', 'waah?', 'müü?', 'eh eh?', 'nnh?', 'oooh?', 'köh?', 'mmh mmh?', 'nüh?', 'hhh~?', 'buhh?', 'wuuh?'],
    angry: ['GRR!', 'bakh!', 'TSK!', 'rrgh!', 'HMPH!', 'kha!', 'BAH!', 'RRRH!', 'ngh NGH!', 'GRRKH!', 'bha BHA!', 'KHF!', 'hhrrgh!', 'PFFT!', 'GRKH GRKH!', 'ngrr..', 'BAKBAK!', 'tskkk!', 'RRRHH!', 'khaa!', 'hmph HMPH!'],
    scared: ['hiih!', 'kyaa!', 'eep!', 'nuu!', 'waa!', 'mmh!', 'iii!', 'hyaa hyaa!', 'niiih!', 'wawa!', 'eeep eep!', 'hiii~', 'yuuu!', 'kyuu kyuu!', 'nooo!', 'mmmh!', 'hiiii~!', 'waaah!', 'eeep!', 'piiih!', 'nyaa nyaa!'],
    love: ['doki♡', 'muu~♡', 'kyuu♡', 'poki~', 'nyuu♡', 'fuwa~♡', 'nyon♡', 'popo~♡', 'kyuu kyuu♡', 'mochi♡', 'doki doki♡', 'füüh~♡', 'nyu nyu♡', 'wawa♡', 'hnnn♡', 'hehehe♡', 'mmmm♡', 'pyuu♡', 'hoho♡', 'fufu~♡'],
    thinking: ['mm...', 'nrr..', 'huu~', 'zzz..', 'hmm~', 'fuu..', 'nn~', 'müü..', 'öhm..', 'nnnh~', 'buh..', 'hrrm..', 'ehhh..', 'nnn nnn..', 'köh..', 'fmm..', 'öhö..', 'wuu..', 'mhmm..', 'nhh..', 'hnng..'],
    pain: ['ow!', 'itai!', 'gah!', 'ngh!', 'ouch!', 'kuh!', 'oww oww!', 'nghh!', 'itch!', 'augh!', 'kkhh!', 'hnngh!', 'yowch!', 'ggkh!', 'nrgh!', 'ahhk!'],
    playful: ['yay!', 'wee!', 'hehe~', 'pya!', 'boing!', 'wheee!', 'yipee!', 'pyoing!', 'yatta!', 'wiii~', 'bwee!', 'hihihi!', 'pyon pyon!', 'nyahaha!', 'weehee!', 'boingo!', 'yippii!', 'pii pii!', 'wheehe~', 'keke!', 'ahahah~'],
    combat: ['RAGH!', 'krakh!', 'YAKH!', 'HRR!', 'BRAK!', 'kuh-HA!', 'GHK!', 'SRAK!', 'GRAKH GRAKH!', 'HYARR!', 'KRSH!', 'BAKK!', 'RRAAA!', 'YAHHH!', 'krakrak!', 'HRRAKH!', 'NNGHH!', 'THWAK!', 'BRKK!', 'HAAAKH!', 'RRRAH!'],
    greeting: ['nyu~!', 'möki!', 'pöpö!', 'heyy~', 'nyaa!', 'wuuh!', 'öhi!', 'pyuu!', 'koko!', 'mömö!', 'füfu!', 'yooh~', 'heee~', 'nyooo!', 'pippi!', 'möh möh!'],
    farewell: ['möki..', 'byuu~', 'nnn..', 'puu..', 'kö kö..', 'füü..', 'nyah..', 'öhh..', 'myu~..', 'bweh..', 'hnnn..'],
    eating: ['ñam!', 'munch~', 'nyu nyu!', 'möm möm!', 'omnom!', 'puii~!', 'kwa~!', 'gnyam!', 'möki möki!', 'mwom!', 'yumm~', 'bwom!', 'nyam nyam!', 'füfü~!', 'nomnom!', 'mwah~!', 'kyo~!'],
    reply_happy: ['puu~!', 'möki möki!', 'nyu nyuu!', 'yahh!', 'mhm!', 'fufu~', 'wee!'],
    reply_curious: ['hm hm!', 'nn nn?', 'öhö?', 'wuuh?', 'nani nani?', 'köh?', 'mmh!'],
    reply_angry: ['EEP!', 'nuu!', 'bakh!', 'HMPH!', 'grh..', 'rrgh!', 'ngrr!'],
    reply_love: ['doki♡', 'nyon♡', 'muu♡', 'füfü♡', 'popo~♡', 'kyuu!♡'],
    reply_combat: ['GRAKH!', 'YAKH!', 'HRR!', 'BRAK!', 'RAGH!', 'krsh!'],
};

const INKUBUS_SENTENCES = {
    eat_berry: ['ñam ñam möki!', 'nomnom puii~!', 'mwom mwom kya!', 'nyam nyam füfü!', 'omnom omnom!'],
    seek_food: ['nnu nnu huu~?', 'möki? nomnom?', 'ñam? ñam ñam?', 'nyam nyam~?'],
    bond: ['möki möki puu~', 'nyu nyu köh?', 'füfu~ myu♡', 'pöpö kiki!', 'wuu wuu mhm'],
    romance: ['doki doki puu♡', 'nyu~ möki♡', 'füfu~ nyon♡', 'muu~ kyuu♡', 'popo~ wuuh♡'],
    fight_clash: ['GRAKH RAGH!', 'BAKK KRSH!', 'HRR BRAK!', 'YAKH GRAKH!', 'NNGH RRAH!'],
    challenge: ['HMPH ngrr!', 'GRR bakh!', 'TSK HMPH!', 'rrgh RRRH!'],
    flee: ['waa waa nuu!', 'hiih kyaa!', 'eep eep waa!', 'nuu nuu hiih!'],
    reckless_chase: ['HAAKH GRAKH!', 'RAGH RAGH!', 'RRRAH YAKH!'],
    investigate: ['hm? nani?', 'öö? köh?', 'nn nn mmh?', 'wuuh? nuu?'],
    orbit: ['nyu~? möki?', 'köh köh?', 'puu~? hm?'],
    calm: ['mhm~ puu..', 'nnu~ füfu', 'öhö~ möki', 'huu~ nrr'],
    sit_bench: ['mhm~ puu..', 'füfu~ nyon', 'popo~ myu', 'ahh~ möki'],
    eject_bench: ['HMPH! BAKK!', 'GRR BAKH!', 'MINE! GRAKH!', 'TSK RRGH!'],
};

function getEmotionForBehavior(behavior) {
    const map = {
        eat_berry: 'eating', seek_food: 'curious', approach: 'curious', observe: 'curious',
        investigate: 'curious', follow: 'happy', orbit: 'curious', bond: 'love', romance: 'love',
        calm: 'happy', idle_look: 'thinking', challenge: 'angry', intimidate: 'angry',
        flee: 'scared', teleport_flee: 'scared', recoil: 'pain', flee_short: 'scared',
        wander: 'happy', explore_jump: 'playful', sniff_object: 'curious', play_ball: 'playful',
        sit_stump: 'thinking', fight_clash: 'combat', reckless_chase: 'combat',
        sit_bench: 'happy', eject_bench: 'angry',
    };
    return map[behavior] || 'thinking';
}

function getReplyEmotion(speakerEmotion) {
    const map = {
        happy: 'reply_happy', curious: 'reply_curious', angry: 'reply_angry', combat: 'reply_combat',
        love: 'reply_love', scared: 'reply_happy', pain: 'reply_curious', playful: 'reply_happy', thinking: 'reply_curious',
    };
    return map[speakerEmotion] || 'reply_curious';
}

function getEmotionColor(emotion) {
    const colors = {
        eating: 'rgba(255, 220, 120, 0.95)', happy: 'rgba(180, 255, 210, 0.92)', curious: 'rgba(200, 230, 255, 0.92)',
        angry: 'rgba(255, 180, 170, 0.92)', scared: 'rgba(220, 200, 255, 0.92)', love: 'rgba(255, 200, 220, 0.92)',
        thinking: 'rgba(220, 225, 240, 0.88)', pain: 'rgba(255, 190, 170, 0.92)', playful: 'rgba(255, 240, 180, 0.92)',
        combat: 'rgba(255, 100, 80, 0.95)', greeting: 'rgba(180, 255, 220, 0.93)', farewell: 'rgba(210, 210, 240, 0.88)',
        reply_happy: 'rgba(160, 255, 200, 0.93)', reply_curious: 'rgba(190, 225, 255, 0.93)', reply_angry: 'rgba(255, 160, 150, 0.93)',
        reply_love: 'rgba(255, 185, 215, 0.93)', reply_combat: 'rgba(255, 80,  60, 0.97)',
    };
    return colors[emotion] || 'rgba(220, 230, 240, 0.9)';
}

function getEmotionBorder(emotion) {
    const colors = {
        eating: 'rgba(210, 140,  30,  0.7)', happy: 'rgba(80,  200, 120, 0.5)', curious: 'rgba(100, 170, 220, 0.5)',
        angry: 'rgba(220, 80,  70,  0.5)', scared: 'rgba(160, 120, 220, 0.5)', love: 'rgba(220, 100, 140, 0.5)',
        thinking: 'rgba(140, 150, 180, 0.4)', pain: 'rgba(200, 90,  70,  0.5)', playful: 'rgba(220, 180, 60,  0.5)',
        combat: 'rgba(200, 40,  20,  0.7)', greeting: 'rgba(60,  200, 130, 0.55)', farewell: 'rgba(130, 130, 180, 0.4)',
        reply_happy: 'rgba(60,  190, 110, 0.55)', reply_curious: 'rgba(80,  155, 210, 0.55)', reply_angry: 'rgba(210, 60,  50,  0.6)',
        reply_love: 'rgba(210, 80,  130, 0.6)', reply_combat: 'rgba(190, 20,  10,  0.8)',
    };
    return colors[emotion] || 'rgba(150, 160, 180, 0.4)';
}

function spawnBubble(state, canonicalId, text, emotion, now, yOffset) {
    const entry = state.runtimeById.get(canonicalId);
    if (!entry) return;
    const center = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
    if (!center) return;
    state.activeBubbles = state.activeBubbles.filter(b => b.slimeId !== canonicalId);
    const duration = 1600 + text.length * 55 + Math.random() * 600;
    state.activeBubbles.push({
        slimeId: canonicalId, text, emotion, duration, startedAt: now,
        x: center.x, y: center.y - entry.slime.baseRadius * (yOffset || 1.6),
    });
}

export function maybeSpawnBubble(state, entry, now) {
    const brain = entry.slime._prairieBrain;
    if (!brain) return;

    if (brain._pendingBubble) {
        const { emotion } = brain._pendingBubble;
        brain._pendingBubble = null;
        const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.thinking;
        const text = vocab[Math.floor(Math.random() * vocab.length)];
        spawnBubble(state, entry.canonicalId, text, emotion, now);
        if (brain.targetId) {
            const targetEntry = state.runtimeById.get(brain.targetId);
            if (targetEntry) {
                const tb = targetEntry.slime._prairieBrain;
                if (tb && !tb._pendingReply) {
                    const replyEmo = getReplyEmotion(emotion);
                    tb._pendingReply = { emotion: replyEmo, at: now + 500 + Math.random() * 700 };
                }
            }
        }
        return;
    }

    if (brain._pendingReply && now >= brain._pendingReply.at) {
        const { emotion } = brain._pendingReply;
        brain._pendingReply = null;
        const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.reply_curious;
        const text = vocab[Math.floor(Math.random() * vocab.length)];
        spawnBubble(state, entry.canonicalId, text, emotion, now);
        return;
    }

    const behavior = brain.behavior;
    const existing = state.activeBubbles.find(b => b.slimeId === entry.canonicalId);
    const GAPS = {
        eat_berry: 800, seek_food: 2500, fight_clash: 600, reckless_chase: 700, challenge: 900, flee: 800,
        teleport_flee: 700, bond: 1200, romance: 1400, approach: 1600, orbit: 1800, follow: 1600,
        investigate: 1500, calm: 2000, wander: 4000, idle_look: 5000, sit_stump: 6000, sit_bench: 3500, eject_bench: 500,
    };
    const minGap = GAPS[behavior] ?? 2000;
    if (existing && now < existing.startedAt + minGap) return;

    const RATES = {
        eat_berry: 0.18, seek_food: 0.04, fight_clash: 0.22, reckless_chase: 0.18, challenge: 0.10,
        flee: 0.09, teleport_flee: 0.15, bond: 0.07, romance: 0.06, approach: 0.05, orbit: 0.04,
        follow: 0.04, investigate: 0.05, intimidate: 0.06, calm: 0.04, explore_jump: 0.03, play_ball: 0.04,
        sniff_object: 0.04, recoil: 0.12, wander: 0.003, idle_look: 0.001, sit_stump: 0.001, sit_bench: 0.015, eject_bench: 0.25,
    };
    const rate = RATES[behavior] ?? 0.025;
    if (Math.random() > rate) return;

    const emotion = getEmotionForBehavior(behavior);
    let text;
    const sentences = INKUBUS_SENTENCES[behavior];
    if (sentences && Math.random() < 0.22) {
        text = sentences[Math.floor(Math.random() * sentences.length)];
    } else {
        const vocab = INKUBUS_VOCAB[emotion] || INKUBUS_VOCAB.thinking;
        text = vocab[Math.floor(Math.random() * vocab.length)];
    }

    spawnBubble(state, entry.canonicalId, text, emotion, now);

    if (brain.targetId) {
        const socialBehaviors = ['approach','observe','follow','orbit','bond','romance','investigate','calm','challenge','intimidate','sit_bench'];
        if (socialBehaviors.includes(behavior)) {
            const targetEntry = state.runtimeById.get(brain.targetId);
            if (targetEntry) {
                const tb = targetEntry.slime._prairieBrain;
                if (tb && !tb._pendingReply && !tb._pendingBubble) {
                    const replyEmo = getReplyEmotion(emotion);
                    tb._pendingReply = { emotion: replyEmo, at: now + 400 + Math.random() * 900 };
                }
            }
        }
    }
}

export function drawSpeechBubbles(state) {
    if (!ctx) return;
    const now = performance.now();
    state.activeBubbles = state.activeBubbles.filter(b => now < b.startedAt + b.duration);

    for (const b of state.activeBubbles) {
        const entry = state.runtimeById.get(state.activeCanonicalIds.find(id => {
            const e = state.runtimeById.get(id);
            return e && e.canonicalId === b.slimeId;
        }));
        if (entry) {
            const c = entry.slime.getVisualCenter?.() || entry.slime.getRawVisualCenter?.();
            if (c) { b.x = c.x; b.y = c.y - entry.slime.baseRadius * 1.7; }
        }

        const age = now - b.startedAt;
        const popT = Math.min(1, age / 220);
        const popScale = popT < 0.7 ? 0.5 + popT / 0.7 * 0.65 : 1.15 - (popT - 0.7) / 0.3 * 0.15;
        const fadeIn = Math.min(1, age / 120);
        const fadeOut = Math.min(1, (b.duration - age) / 280);
        const alpha = fadeIn * fadeOut;
        if (alpha < 0.01) continue;

        const floatY = b.y - age * 0.006;
        const bigEmotions = new Set(['combat','angry','reply_combat','reply_angry']);
        const smallEmotions = new Set(['thinking','farewell','reply_curious']);
        const isEating = b.emotion === 'eating';
        const fontSize = isEating ? 11.5 : bigEmotions.has(b.emotion) ? 11 : smallEmotions.has(b.emotion) ? 9 : 10;
        const fontWeight = bigEmotions.has(b.emotion) ? '900' : 'bold';
        const displayText = isEating ? '🍓 ' + b.text : b.text;
        const wobbleX = isEating ? Math.sin((now - b.startedAt) * 0.012) * 2.5 : 0;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(b.x + wobbleX, floatY); ctx.scale(popScale, popScale); ctx.translate(-(b.x + wobbleX), -floatY);
        ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        const metrics = ctx.measureText(displayText);
        const tw = metrics.width, pad = 6, bw = tw + pad * 2, bh = fontSize + 8;
        const bx = (b.x + wobbleX) - bw / 2, by = floatY - bh / 2, r = 7;

        
        ctx.fillStyle = getEmotionColor(b.emotion); ctx.strokeStyle = getEmotionBorder(b.emotion);
        ctx.lineWidth = bigEmotions.has(b.emotion) ? 1.5 : 1;

        ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(b.x + wobbleX + 5, by + bh); ctx.lineTo(b.x + wobbleX, by + bh + 6); ctx.lineTo(b.x + wobbleX - 4, by + bh);
        ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.closePath();
        ctx.fill(); ctx.stroke();

        const loveEmotions = new Set(['love','reply_love','greeting']);
        ctx.fillStyle = bigEmotions.has(b.emotion) ? 'rgba(90, 10, 10, 0.95)'
            : isEating ? 'rgba(100, 50, 0, 0.92)'
            : loveEmotions.has(b.emotion) ? 'rgba(140, 30, 80, 0.9)' : 'rgba(25, 25, 40, 0.88)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(displayText, b.x + wobbleX, floatY);
        ctx.restore();
    }
}