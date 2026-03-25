import { ctx } from '../../vendor/inku-slime-v3/runtime/runtimeState.js';

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

// ── Rendering Functions (Uses imported Canvas 'ctx') ───────────────────────

export function drawPrairieObjects(state) {
    if (!ctx) return;
    const now = performance.now();

    const skyGrad = ctx.createLinearGradient(0, state.world.top - 800, 0, state.world.groundY);
    skyGrad.addColorStop(0, '#0a1128'); 
    skyGrad.addColorStop(1, '#1c2841'); 
    ctx.fillStyle = skyGrad;
    ctx.fillRect(state.world.left - 2000, -3000, state.world.width + 4000, state.world.groundY + 3000);

    ctx.fillStyle = '#2a4463';
    ctx.fillRect(state.world.left - 2000, state.world.groundY - 2, state.world.width + 4000, 4);

    const groundGrad = ctx.createLinearGradient(0, state.world.groundY, 0, state.world.bottom + 500);
    groundGrad.addColorStop(0, '#1c1512');
    groundGrad.addColorStop(1, '#0a0806');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(state.world.left - 2000, state.world.groundY, state.world.width + 4000, state.world.bottom - state.world.groundY + 1000);

    const drawGroundShadow = (x, y, radius, alpha = 0.3) => {
        ctx.fillStyle = `rgba(5, 5, 8, ${alpha})`;
        ctx.beginPath(); ctx.ellipse(x, y + 2, radius, radius * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    };

    const sortedObjects = [...state.prairieObjects].sort((a, b) => {
        const getZ = (o) => {
            if (o.type === 'tree') return -100000;
            if (o.type === 'terrarium') return -99999;
            return o.y;
        };
        return getZ(a) - getZ(b) || a.x - b.x;
    });

    for (const obj of sortedObjects) {
        ctx.save();
        switch (obj.type) {
            case 'tree': {
                const trunkGrad = ctx.createLinearGradient(obj.x - obj.w*0.5, 0, obj.x + obj.w*0.5, 0);
                trunkGrad.addColorStop(0, '#0a0d14'); trunkGrad.addColorStop(0.5, '#182430'); trunkGrad.addColorStop(1, '#06080d');
                ctx.fillStyle = trunkGrad; ctx.beginPath();
                ctx.moveTo(obj.x - obj.w * 0.35, -2000); ctx.lineTo(obj.x + obj.w * 0.35, -2000);
                ctx.bezierCurveTo(obj.x + obj.w * 0.35, state.world.groundY - 400, obj.x + obj.w * 0.45, state.world.groundY - 50, obj.x + obj.w * 0.9, state.world.groundY);
                ctx.lineTo(obj.x - obj.w * 0.9, state.world.groundY);
                ctx.bezierCurveTo(obj.x - obj.w * 0.45, state.world.groundY - 50, obj.x - obj.w * 0.35, state.world.groundY - 400, obj.x - obj.w * 0.35, -2000);
                ctx.fill();
                ctx.strokeStyle = '#04060a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(obj.x - obj.w * 0.1, -2000); ctx.quadraticCurveTo(obj.x - obj.w * 0.15, state.world.groundY - 300, obj.x - obj.w * 0.5, state.world.groundY - 10); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(obj.x + obj.w * 0.15, -2000); ctx.quadraticCurveTo(obj.x + obj.w * 0.1, state.world.groundY - 200, obj.x + obj.w * 0.4, state.world.groundY - 5); ctx.stroke();
                break;
            }
            case 'terrarium': {
                const hX = obj.x, hY = obj.y - obj.h, hW = obj.w, hH = obj.houseH;
                const wallGrad = ctx.createLinearGradient(hX, 0, hX + hW, 0);
                wallGrad.addColorStop(0, '#26170f'); wallGrad.addColorStop(0.5, '#3b2517'); wallGrad.addColorStop(1, '#1a0f0a');
                ctx.fillStyle = wallGrad; ctx.fillRect(hX - 30, hY - hH - 30, hW + 60, hH + 60 + obj.h);
                
                ctx.fillStyle = '#140c08'; ctx.fillRect(hX, hY - hH, hW, hH);
                
                const paintingY = hY - hH + 120;
                ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
                ctx.fillStyle = '#c9a02a'; ctx.fillRect(hX + 150, paintingY, 100, 120);
                ctx.fillStyle = '#111'; ctx.fillRect(hX + 155, paintingY + 5, 90, 110);
                const sunset = ctx.createLinearGradient(0, paintingY, 0, paintingY + 100);
                sunset.addColorStop(0, '#ff4e50'); sunset.addColorStop(1, '#f9d423');
                ctx.fillStyle = sunset; ctx.fillRect(hX + 160, paintingY + 10, 80, 100);
                ctx.shadowColor = 'transparent'; 
                
                const tableY = hY - 60, tableX = hX + hW * 0.5;
                ctx.fillStyle = '#6b431e';
                ctx.fillRect(tableX - 220, tableY - 100, 15, 160); ctx.fillRect(tableX - 220, tableY + 10, 80, 15); ctx.fillRect(tableX - 160, tableY + 25, 15, 35);   
                ctx.fillRect(tableX + 205, tableY - 100, 15, 160); ctx.fillRect(tableX + 140, tableY + 10, 80, 15); ctx.fillRect(tableX + 145, tableY + 25, 15, 35);   
                ctx.fillStyle = '#3b2210'; ctx.fillRect(tableX - 100, tableY + 10, 200, 20);
                ctx.fillStyle = '#24140a'; ctx.fillRect(tableX - 80, tableY + 30, 20, 30); ctx.fillRect(tableX + 60, tableY + 30, 20, 30);
                ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(tableX - 40, tableY + 5, 10, 0, Math.PI); ctx.fill();
                ctx.beginPath(); ctx.arc(tableX + 40, tableY + 5, 10, 0, Math.PI); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(tableX-40, tableY-5); ctx.quadraticCurveTo(tableX-35, tableY-15, tableX-45, tableY-25); ctx.stroke();
                
                const drawLamp = (lx, ly) => {
                    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lx, hY - hH); ctx.lineTo(lx, ly - 20); ctx.stroke();
                    ctx.fillStyle = '#e89e27'; ctx.beginPath(); ctx.moveTo(lx - 35, ly + 10); ctx.lineTo(lx + 35, ly + 10); ctx.lineTo(lx + 15, ly - 20); ctx.lineTo(lx - 15, ly - 20); ctx.fill();
                    const grad = ctx.createRadialGradient(lx, ly + 20, 0, lx, ly + 50, 300);
                    grad.addColorStop(0, 'rgba(232, 158, 39, 0.25)'); grad.addColorStop(1, 'rgba(232, 158, 39, 0)');
                    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(lx, ly + 50, 300, 0, Math.PI * 2); ctx.fill();
                };
                drawLamp(hX + 300, hY - hH + 180); drawLamp(hX + hW - 300, hY - hH + 180);
                
                const floorGrad = ctx.createLinearGradient(0, hY, 0, hY + obj.h);
                floorGrad.addColorStop(0, '#3b2210'); floorGrad.addColorStop(1, '#24140a');
                ctx.fillStyle = floorGrad; ctx.fillRect(hX - 20, hY, hW + 40, obj.h);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.5;
                for(let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(hX-20, hY + (obj.h/4)*i); ctx.lineTo(hX+hW+20, hY + (obj.h/4)*i); ctx.stroke(); }
                break;
            }
            case 'grass': {
                const swayPhase = now * 0.0012 + obj.sway;
                const sw = Math.sin(swayPhase) * 6; 
                const grad = ctx.createLinearGradient(0, obj.y, 0, obj.y - obj.height);
                grad.addColorStop(0, `hsla(160, 40%, 15%, ${obj.alpha + 0.4})`); grad.addColorStop(1, `hsla(150, 60%, 35%, ${obj.alpha})`);      
                ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
                for (let b = 0; b < obj.blades; b++) {
                    const bx = obj.x + (b - obj.blades * 0.5) * 6;
                    const bsw = sw + Math.sin(swayPhase + b * 0.5) * 3.5; 
                    ctx.beginPath(); ctx.moveTo(bx, obj.y); ctx.quadraticCurveTo(bx + bsw * 0.5, obj.y - obj.height * 0.5, bx + bsw, obj.y - obj.height * (0.8 + (b%2)*0.2)); ctx.stroke();
                }
                break;
            }
            case 'flower': {
                drawGroundShadow(obj.x, obj.y, obj.size * 0.6);
                const sw = Math.sin(now * 0.0015 + obj.sway) * 5;
                const topX = obj.x + sw, topY = obj.y - obj.stemH;
                ctx.strokeStyle = 'hsla(150, 50%, 25%, 0.9)'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(obj.x, obj.y); ctx.quadraticCurveTo(obj.x + sw * 0.5, obj.y - obj.stemH * 0.5, topX, topY); ctx.stroke();
                const glow = ctx.createRadialGradient(topX, topY, 0, topX, topY, obj.size * 1.5);
                glow.addColorStop(0, `hsla(${obj.petalHue}, 90%, 70%, 0.3)`); glow.addColorStop(1, `hsla(${obj.petalHue}, 90%, 70%, 0)`);
                ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(topX, topY, obj.size * 1.5, 0, Math.PI * 2); ctx.fill();
                for (let p = 0; p < obj.petalCount; p++) {
                    const a = (p / obj.petalCount) * Math.PI * 2 + (now * 0.0005);
                    const px = topX + Math.cos(a) * obj.size * 0.5, py = topY + Math.sin(a) * obj.size * 0.35;
                    const pGrad = ctx.createRadialGradient(topX, topY, 0, px, py, obj.size * 0.5);
                    pGrad.addColorStop(0, `hsla(${obj.petalHue}, 90%, 50%, 0.9)`); pGrad.addColorStop(1, `hsla(${obj.petalHue + 20}, 100%, 75%, 0.9)`);
                    ctx.fillStyle = pGrad; ctx.beginPath(); ctx.ellipse(px, py, obj.size * 0.3, obj.size * 0.15, a, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = `hsla(${(obj.petalHue + 45) % 360}, 100%, 65%, 1)`; ctx.beginPath(); ctx.arc(topX, topY, obj.size * 0.16, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'rock': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6, 0.4);
                const cx = obj.x, cy = obj.y;
                ctx.fillStyle = `hsla(${obj.hue}, 15%, ${obj.lightness - 15}%, 1)`;
                ctx.beginPath(); ctx.moveTo(cx - obj.w * 0.5, cy); ctx.lineTo(cx - obj.w * 0.3, cy - obj.h); ctx.lineTo(cx + obj.w * 0.4, cy - obj.h * 0.8); ctx.lineTo(cx + obj.w * 0.5, cy); ctx.closePath(); ctx.fill();
                ctx.fillStyle = `hsla(${obj.hue}, 15%, ${obj.lightness}%, 1)`;
                ctx.beginPath(); ctx.moveTo(cx - obj.w * 0.2, cy); ctx.lineTo(cx - obj.w * 0.3, cy - obj.h); ctx.lineTo(cx + obj.w * 0.1, cy - obj.h * 0.9); ctx.lineTo(cx + obj.w * 0.2, cy); ctx.closePath(); ctx.fill();
                ctx.fillStyle = `hsla(${obj.hue}, 20%, ${obj.lightness + 20}%, 0.3)`;
                ctx.beginPath(); ctx.moveTo(cx - obj.w * 0.3, cy - obj.h); ctx.lineTo(cx - obj.w * 0.2, cy - obj.h * 0.9); ctx.lineTo(cx - obj.w * 0.1, cy - obj.h); ctx.closePath(); ctx.fill();
                break;
            }
            case 'ball': {
                drawGroundShadow(obj.x, state.world.groundY, obj.radius * 0.8);
                const r = obj.radius;
                const grad = ctx.createRadialGradient(obj.x - r * 0.3, obj.y - r * 0.3, r * 0.1, obj.x, obj.y, r);
                grad.addColorStop(0, `hsla(${obj.hue}, ${obj.saturation}%, 85%, 1)`); grad.addColorStop(0.3, `hsla(${obj.hue}, ${obj.saturation}%, 60%, 1)`); grad.addColorStop(1, `hsla(${obj.hue}, ${obj.saturation}%, 20%, 1)`);
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.beginPath(); ctx.ellipse(obj.x - r * 0.3, obj.y - r * 0.4, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'mushroom': {
                drawGroundShadow(obj.x, obj.y, obj.capW * 0.4);
                const mx = obj.x, my = obj.y;
                const stemGrad = ctx.createLinearGradient(mx - 4, my - obj.stemH, mx + 4, my);
                stemGrad.addColorStop(0, 'hsla(45, 10%, 70%, 1)'); stemGrad.addColorStop(1, 'hsla(45, 10%, 30%, 1)');
                ctx.fillStyle = stemGrad; ctx.beginPath(); ctx.roundRect(mx - 4, my - obj.stemH, 8, obj.stemH, 3); ctx.fill();
                const capGrad = ctx.createRadialGradient(mx, my - obj.stemH - obj.capH * 0.5, 0, mx, my - obj.stemH, obj.capW);
                capGrad.addColorStop(0, `hsla(${obj.capHue}, 70%, 65%, 1)`); capGrad.addColorStop(1, `hsla(${obj.capHue}, 80%, 30%, 1)`);
                ctx.fillStyle = capGrad; ctx.beginPath(); ctx.moveTo(mx - obj.capW * 0.5, my - obj.stemH); ctx.bezierCurveTo(mx - obj.capW * 0.5, my - obj.stemH - obj.capH * 1.6, mx + obj.capW * 0.5, my - obj.stemH - obj.capH * 1.6, mx + obj.capW * 0.5, my - obj.stemH); ctx.closePath(); ctx.fill();
                for (let d = 0; d < obj.dots; d++) {
                    const da = (d / obj.dots) * Math.PI - Math.PI * 0.1, dr = obj.capW * 0.3;
                    const dotX = mx + Math.cos(da) * dr, dotY = my - obj.stemH - Math.sin(da) * obj.capH * 0.6;
                    ctx.fillStyle = 'rgba(220, 255, 230, 0.8)'; ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'rgba(120, 255, 180, 0.3)'; ctx.beginPath(); ctx.arc(dotX, dotY, 6, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case 'puddle': {
                const shimmer = 0.2 + Math.sin(now * 0.0015 + obj.x * 0.01) * 0.1;
                const grad = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, obj.w * 0.5);
                grad.addColorStop(0, `rgba(140, 200, 220, ${shimmer + 0.2})`); grad.addColorStop(0.8, `rgba(60, 140, 180, ${shimmer})`); grad.addColorStop(1, 'rgba(60, 140, 180, 0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, obj.w * 0.5, obj.h, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(160, 220, 240, ${shimmer + 0.1})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, obj.w * 0.45, obj.h * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
                break;
            }
            case 'teleporter': {
                drawGroundShadow(obj.x, obj.y, 45, 0.4);
                const t = now * 0.0025;
                const r = 32 + Math.sin(t * 2) * 3;
                const grad = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, r * 1.3);
                grad.addColorStop(0, 'rgba(100, 220, 255, 0.9)'); grad.addColorStop(0.4, 'rgba(40, 140, 220, 0.4)'); grad.addColorStop(1, 'rgba(10, 30, 80, 0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r * 1.3, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(180, 240, 255, 0.8)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r, r * 0.25, t, Math.PI, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(60, 180, 240, 0.6)'; ctx.beginPath(); ctx.ellipse(obj.x, obj.y, r * 0.8, r * 0.2, -t * 1.5, 0, Math.PI); ctx.stroke();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                for(let i=0; i<4; i++) {
                    const py = obj.y - ((now * 0.06 + i * 18) % 60), px = obj.x + Math.sin(py * 0.12) * 12;
                    ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI*2); ctx.fill();
                }
                break;
            }
            case 'berry_bush':
            case 'bush': {
                drawGroundShadow(obj.x, obj.y, obj.r * 1.2);
                const bx = obj.x, by = obj.y, r = obj.r, isBerry = obj.type === 'berry_bush';
                const sat = isBerry && obj.berryCount > 0 ? 55 : 40, lum = isBerry && obj.berryCount > 0 ? 30 : 20;
                const drawLobe = (lx, ly, lr, hOffset, lOffset) => {
                    const lobeGrad = ctx.createRadialGradient(lx - lr*0.2, ly - lr*0.2, 0, lx, ly, lr);
                    lobeGrad.addColorStop(0, `hsla(${obj.leafHue + hOffset}, ${sat}%, ${lum + 15 + lOffset}%, 1)`);
                    lobeGrad.addColorStop(1, `hsla(${obj.leafHue + hOffset}, ${sat}%, ${lum - 15 + lOffset}%, 1)`);
                    ctx.fillStyle = lobeGrad; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
                };
                drawLobe(bx - r * 0.4, by - r * 0.5, r * 0.75, -5, -5); drawLobe(bx + r * 0.4, by - r * 0.5, r * 0.7, 5, -5); drawLobe(bx, by - r * 0.75, r * 0.9, 0, 5);
                if (isBerry && obj.berryCount > 0) {
                    const BERRY_COLORS = { red: '350, 80%, 55%', blue: '220, 80%, 65%', yellow: '50, 90%, 60%' };
                    const bColor = BERRY_COLORS[obj.berryType] || BERRY_COLORS.red;
                    const pos = [ {dx:-r*0.3, dy:-r*0.8}, {dx:r*0.2, dy:-r*1.0}, {dx:0, dy:-r*0.6}, {dx:-r*0.6, dy:-r*0.5}, {dx:r*0.5, dy:-r*0.6} ];
                    for (let bi = 0; bi < Math.min(obj.berryCount, pos.length); bi++) {
                        const px = bx + pos[bi].dx, py = by + pos[bi].dy;
                        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(px, py+2, 4.5, 0, Math.PI * 2); ctx.fill();
                        const bGrad = ctx.createRadialGradient(px-1.5, py-1.5, 0, px, py, 4.5);
                        bGrad.addColorStop(0, `hsla(${bColor.replace('%', '%').replace('55%', '85%')}, 1)`); bGrad.addColorStop(1, `hsla(${bColor}, 1)`);
                        ctx.fillStyle = bGrad; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
                    }
                }
                break;
            }
            case 'stump': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6);
                const sx = obj.x, sy = obj.y;
                const trunkGrad = ctx.createLinearGradient(sx - obj.w*0.5, 0, sx + obj.w*0.5, 0);
                trunkGrad.addColorStop(0, 'hsla(30, 25%, 15%, 1)'); trunkGrad.addColorStop(0.5, 'hsla(30, 25%, 25%, 1)'); trunkGrad.addColorStop(1, 'hsla(30, 25%, 10%, 1)');
                ctx.fillStyle = trunkGrad; ctx.beginPath(); ctx.moveTo(sx - obj.w * 0.5, sy); ctx.lineTo(sx - obj.w * 0.4, sy - obj.h); ctx.lineTo(sx + obj.w * 0.4, sy - obj.h); ctx.lineTo(sx + obj.w * 0.5, sy); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'hsla(120, 50%, 25%, 0.8)'; ctx.beginPath(); ctx.ellipse(sx - obj.w*0.3, sy - 5, 18, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'hsla(35, 20%, 35%, 1)'; ctx.beginPath(); ctx.ellipse(sx, sy - obj.h, obj.w * 0.4, obj.h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'hsla(30, 20%, 20%, 0.6)'; ctx.lineWidth = 1.5;
                for (let r = 1; r <= obj.rings; r++) { const rf = r / (obj.rings + 1); ctx.beginPath(); ctx.ellipse(sx, sy - obj.h, obj.w * 0.4 * rf, obj.h * 0.25 * rf, 0, 0, Math.PI * 2); ctx.stroke(); }
                break;
            }
            case 'bench': {
                drawGroundShadow(obj.x, obj.y, obj.w * 0.6);
                const bx = obj.x, by = obj.y, hw = obj.w * 0.5, seatY = by - obj.legH, wH = obj.woodHue;
                ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
                [-hw * 0.7, -hw * 0.3, hw * 0.3, hw * 0.7].forEach(lx => { ctx.beginPath(); ctx.moveTo(bx + lx, by); ctx.lineTo(bx + lx, seatY); ctx.stroke(); });
                const woodGrad = ctx.createLinearGradient(0, seatY - 5, 0, seatY + 5);
                woodGrad.addColorStop(0, `hsla(${wH}, 35%, 35%, 1)`); woodGrad.addColorStop(1, `hsla(${wH}, 35%, 15%, 1)`);
                ctx.fillStyle = woodGrad; ctx.beginPath(); ctx.roundRect(bx - hw * 0.85, seatY - 4, obj.w * 0.85, 8, 4); ctx.fill();
                const backY = seatY - obj.h;
                ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(bx - hw*0.7, seatY); ctx.lineTo(bx - hw*0.8, backY); ctx.moveTo(bx + hw*0.7, seatY); ctx.lineTo(bx + hw*0.8, backY); ctx.stroke();
                ctx.fillStyle = woodGrad; ctx.beginPath(); ctx.roundRect(bx - hw * 0.9, backY - 6, obj.w * 0.9, 12, 4); ctx.fill();
                break;
            }
            case 'jump_ball': {
                const t = now * 0.005; const r = obj.r * (1 + Math.sin(t) * 0.05);
                const grad = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, r);
                grad.addColorStop(0, 'rgba(255, 240, 100, 0.9)'); grad.addColorStop(1, 'rgba(255, 140, 0, 0.2)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'trampoline': {
                const tx = obj.x - obj.w * 0.5, ty = obj.y - obj.h;
                ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(tx + 15, obj.y); ctx.lineTo(tx + 15, ty); ctx.moveTo(tx + obj.w - 15, obj.y); ctx.lineTo(tx + obj.w - 15, ty); ctx.stroke();
                ctx.fillStyle = '#111'; ctx.fillRect(tx, ty, obj.w, 12);
                ctx.strokeStyle = '#d6244d'; ctx.lineWidth = 4; ctx.strokeRect(tx, ty, obj.w, 12);
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
                const bx = obj.x, by = obj.y, sz = obj.size, h = obj.hue, inFlight = obj.state === 'flying' || obj.state === 'startled';
                ctx.save(); ctx.translate(bx, by);
                if (inFlight) {
                    const flap = Math.sin(now * 0.018) * 0.45;
                    ctx.fillStyle = `hsla(${h}, 55%, 45%, 1)`; ctx.beginPath(); ctx.ellipse(0, -sz * 0.3, sz * 0.45, sz * 0.28, -0.3, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `hsla(${h}, 45%, 35%, 1)`; ctx.beginPath(); ctx.ellipse(-sz * 0.6, -sz * 0.35 - flap * sz, sz * 0.55, sz * 0.18, -0.5 - flap, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.ellipse(sz * 0.6, -sz * 0.35 - flap * sz, sz * 0.55, sz * 0.18, 0.5 + flap, 0, Math.PI * 2); ctx.fill();
                } else {
                    ctx.fillStyle = `hsla(${h}, 55%, 45%, 1)`; ctx.beginPath(); ctx.ellipse(0, -sz * 0.38, sz * 0.42, sz * 0.32, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `hsla(${h + 15}, 60%, 55%, 1)`; ctx.beginPath(); ctx.arc(sz * 0.28, -sz * 0.68, sz * 0.22, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#e89e27'; ctx.beginPath(); ctx.moveTo(sz * 0.48, -sz * 0.70); ctx.lineTo(sz * 0.70, -sz * 0.62); ctx.lineTo(sz * 0.48, -sz * 0.60); ctx.fill();
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
    for (const obj of state.prairieObjects) {
        if (obj.type === 'terrarium') {
            const hX = obj.x, hY = obj.y - obj.h, hW = obj.w, hH = obj.houseH;
            ctx.fillStyle = 'rgba(210, 230, 255, 0.08)'; ctx.fillRect(hX, hY - hH, hW, hH);
            const glassReflect = ctx.createLinearGradient(hX, hY-hH, hX+hW, hY);
            glassReflect.addColorStop(0, 'rgba(255,255,255,0.1)'); glassReflect.addColorStop(0.5, 'rgba(255,255,255,0)'); glassReflect.addColorStop(1, 'rgba(255,255,255,0.03)');
            ctx.fillStyle = glassReflect; ctx.beginPath(); ctx.moveTo(hX+150, hY-hH); ctx.lineTo(hX+450, hY-hH); ctx.lineTo(hX+hW-150, hY); ctx.lineTo(hX+hW-450, hY); ctx.fill();
            ctx.strokeStyle = '#050505'; ctx.lineWidth = 12; ctx.strokeRect(hX, hY - hH, hW, hH);
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

        ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
        ctx.fillStyle = getEmotionColor(b.emotion); ctx.strokeStyle = getEmotionBorder(b.emotion);
        ctx.lineWidth = bigEmotions.has(b.emotion) ? 1.5 : 1;

        ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(b.x + wobbleX + 5, by + bh); ctx.lineTo(b.x + wobbleX, by + bh + 6); ctx.lineTo(b.x + wobbleX - 4, by + bh);
        ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.closePath();
        ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();

        const loveEmotions = new Set(['love','reply_love','greeting']);
        ctx.fillStyle = bigEmotions.has(b.emotion) ? 'rgba(90, 10, 10, 0.95)'
            : isEating ? 'rgba(100, 50, 0, 0.92)'
            : loveEmotions.has(b.emotion) ? 'rgba(140, 30, 80, 0.9)' : 'rgba(25, 25, 40, 0.88)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(displayText, b.x + wobbleX, floatY);
        ctx.restore();
    }
}