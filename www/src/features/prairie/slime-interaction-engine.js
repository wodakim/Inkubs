// ═══════════════════════════════════════════════════════════════════════════
//  SLIME INTERACTION ENGINE v4 — Continuous behavior state machine
//  
//  KEY DESIGN PRINCIPLES:
//  1. Behaviors are CONTINUOUS (3-15 seconds), not one-shot flashes
//  2. Movement and face expression happen EVERY FRAME during a behavior
//  3. triggerAction is REFRESHED continuously so face stays animated
//  4. idleFrames is NOT reset — self-righting still works
//  5. Stats actually matter: personality drives what behaviors get chosen
//  6. Slimes move, stop, look at each other, approach, orbit, flee, bond
// ═══════════════════════════════════════════════════════════════════════════

const TICK_MS = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(a, b) { return a + Math.random() * (b - a); }
function sigmoid(stat) { return 1 / (1 + Math.exp(-0.07 * ((stat || 50) - 48))); }

function getCenter(slime) {
  return slime.getRawVisualCenter?.() || slime.getVisualCenter?.() || { x: 0, y: 0 };
}

function statDrive(stats, keys) {
  let sum = 0, n = 0;
  for (const k of keys) {
    const v = stats?.[k];
    if (typeof v === 'number') { sum += sigmoid(v); n++; }
  }
  return n > 0 ? sum / n : 0.5;
}

// ── Per-slime brain ──────────────────────────────────────────────────────────
class SlimeBrain {
  constructor(id) {
    this.selfId = id;
    this.behavior = 'wander';
    this.targetId = null;
    this.targetObj = null;
    this.startedAt = 0;
    this.endsAt = 0;
    this.intentDir = 0;
    this.moveGoalX = null;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitDir = Math.random() > 0.5 ? 1 : -1;
    this.lastJumpAt = 0;
    this.pauseUntil = 0;
    this.seed = Math.random();
    this.biasByTarget = new Map();
    this.recentBehaviors = [];
    // Observable event log for the loupe panel
    this.interactionLog = [];  // { time, type, targetId, detail }
    this.statChangeLog = [];   // { time, stat, oldVal, newVal, cause }
  }
  getBias(id) { return this.biasByTarget.get(id) || 0; }
  addBias(id, d) {
    this.biasByTarget.set(id, Math.max(-1, Math.min(1, (this.biasByTarget.get(id) || 0) + d)));
  }
  decayBias() {
    for (const [id, v] of this.biasByTarget) {
      const nv = v * 0.998;
      if (Math.abs(nv) < 0.005) this.biasByTarget.delete(id);
      else this.biasByTarget.set(id, nv);
    }
  }
  logInteraction(type, targetId, detail) {
    this.interactionLog.push({ time: Date.now(), type, targetId, detail: detail || '' });
    if (this.interactionLog.length > 50) this.interactionLog.shift();
  }
  logStatChange(stat, oldVal, newVal, cause) {
    this.statChangeLog.push({ time: Date.now(), stat, oldVal: Math.round(oldVal*10)/10, newVal: Math.round(newVal*10)/10, cause });
    if (this.statChangeLog.length > 40) this.statChangeLog.shift();
  }
}

// ── Movement primitives ──────────────────────────────────────────────────────
function moveToward(slime, brain, tx, speedMul) {
  const cx = getCenter(slime).x;
  const dx = tx - cx;
  if (Math.abs(dx) < 5) { brain.intentDir *= 0.7; return; }
  const dir = Math.sign(dx);
  brain.intentDir = lerp(brain.intentDir, dir, 0.3);
  if (Math.abs(brain.intentDir) > 0.04) {
    slime.facing = Math.sign(brain.intentDir);
    const saved = slime.moveAcceleration;
    // Stronger impulse: multiply by 1.8 base + speedMul
    slime.moveAcceleration = saved * Math.max(0.4, speedMul) * 1.8;
    slime.applyHorizontalInput(Math.sign(brain.intentDir));
    slime.moveAcceleration = saved;
    // NOTE: we do NOT reset idleFrames here — self-righting needs it
  }
}

function moveAway(slime, brain, fromX, speedMul, world) {
  const cx = getCenter(slime).x;
  const tx = Math.max(world.left + 80, Math.min(world.right - 80, cx + (cx - fromX) * 2.5));
  moveToward(slime, brain, tx, speedMul);
}

function brake(brain) { brain.intentDir *= 0.65; }

function faceTo(slime, target) {
  const sc = getCenter(slime), tc = getCenter(target);
  const dx = tc.x - sc.x;
  if (Math.abs(dx) > 3) slime.facing = Math.sign(dx);
}

function tryJump(slime, brain, now) {
  if (now - brain.lastJumpAt < 500) return;
  const gr = slime.getGroundedRatio?.() ?? 0;
  if (gr > 0.2 && slime.jumpCooldownFrames <= 0) {
    slime.tryJump();
    brain.lastJumpAt = now;
  }
}

// Keep the action alive continuously (refresh before it expires)
function keepAction(slime, action, intensity) {
  const now = performance.now();
  // Refresh well before expiry to prevent any gap
  if (slime.actionState !== action || now > slime.actionUntil - 300) {
    slime.actionState = action;
    slime.actionUntil = now + 800;  // long enough to survive between ticks
    // Ramp up intensity, never below the requested level
    slime.actionIntensity = Math.min(1.3, Math.max(intensity, slime.actionIntensity * 0.7 + intensity * 0.3));
  }
}

// ── Behavior selection ───────────────────────────────────────────────────────
function pickBehavior(brain, slime, others, world, now, prairieObjects) {
  const s = slime.stats || {};
  const sc = getCenter(slime);
  const W = []; // weighted candidates: [name, weight, targetId, targetObj?]

  // For each other slime, score social behaviors
  for (const { id, slime: other } of others) {
    if (id === brain.selfId || other.draggedNode) continue;
    const oc = getCenter(other);
    const dist = Math.hypot(sc.x - oc.x, sc.y - oc.y);
    const os = other.stats || {};
    const bias = brain.getBias(id);
    const empCompat = 1 - Math.abs((s.empathy || 50) - (os.empathy || 50)) / 100;
    const dominance = Math.max(0, ((s.ferocity || 50) - (os.ferocity || 50)) / 100);
    const vulnerability = Math.max(0, ((os.ferocity || 50) - (s.ferocity || 50)) / 100);

    // Each behavior: [name, weight, targetId]
    if (dist < 550) {
      // APPROACH — curiosity driven
      W.push(['approach', (0.35 + sigmoid(s.curiosity) * 0.5) * (1 + bias * 0.3), id]);
      // INVESTIGATE — curiosity + medium range
      if (dist > 80 && dist < 350)
        W.push(['investigate', (0.25 + sigmoid(s.curiosity) * 0.6), id]);
    }
    if (dist < 400) {
      // FOLLOW — empathy + agility
      W.push(['follow', (0.20 + sigmoid(s.empathy) * 0.4 + sigmoid(s.agility) * 0.2) * (1 + bias * 0.3), id]);
      // ORBIT — curiosity + agility
      W.push(['orbit', (0.15 + sigmoid(s.curiosity) * 0.3 + sigmoid(s.agility) * 0.4), id]);
    }
    if (dist < 140) {
      // BOND — empathy driven, close range
      W.push(['bond', (0.20 + sigmoid(s.empathy) * 0.6 + empCompat * 0.3) * (1 + bias * 0.4), id]);
      // ROMANCE — needs positive bias + high empathy
      if (bias > 0.1)
        W.push(['romance', (0.05 + sigmoid(s.empathy) * 0.5 + empCompat * 0.3 + bias * 0.4), id]);
    }
    if (dist < 350 && dominance > 0.08) {
      // CHALLENGE — ferocity dominance
      W.push(['challenge', (0.10 + dominance * 0.6 + sigmoid(s.ferocity) * 0.4) * (1 - Math.max(0, bias) * 0.3), id]);
      // INTIMIDATE — ferocity + stability
      W.push(['intimidate', (0.08 + sigmoid(s.ferocity) * 0.4 + sigmoid(s.stability) * 0.2), id]);
    }
    if (dist < 250 && vulnerability > 0.15) {
      // FLEE — vulnerable + unstable
      const instab = 1 - sigmoid(s.stability);
      W.push(['flee', (0.10 + vulnerability * 0.5 + instab * 0.4), id]);
    }
    if (dist < 250) {
      // CALM — stable + empathetic, other is unstable
      const otherInstab = 1 - sigmoid(os.stability);
      W.push(['calm', (0.08 + sigmoid(s.empathy) * 0.4 + sigmoid(s.stability) * 0.3 + otherInstab * 0.3), id]);
    }
  }

  // Solo behaviors (always available)
  W.push(['wander', 0.6 + sigmoid(s.curiosity) * 0.3, null]);
  W.push(['idle_look', 0.4 + sigmoid(s.stability) * 0.3, null]);
  W.push(['explore_jump', 0.12 + sigmoid(s.curiosity) * 0.3 + sigmoid(s.vitality) * 0.3, null]);

  // ── Object interactions ──────────────────────────────────────────────
  if (prairieObjects && prairieObjects.length) {
    for (const obj of prairieObjects) {
      if (!obj.interactive) continue;
      const objDist = Math.hypot(sc.x - obj.x, sc.y - (obj.y || world.groundY));
      if (objDist > 450) continue;

      if (obj.type === 'ball' && obj.throwable) {
        // Play with ball — curiosity + vitality driven, especially fun for playful slimes
        W.push(['play_ball', (0.15 + sigmoid(s.curiosity) * 0.35 + sigmoid(s.vitality) * 0.25) * clamp01(1 - objDist / 400), null, obj]);
      }
      if (obj.type === 'flower' || obj.type === 'mushroom' || obj.type === 'puddle') {
        // Sniff/investigate objects — curiosity driven
        W.push(['sniff_object', (0.12 + sigmoid(s.curiosity) * 0.45) * clamp01(1 - objDist / 350), null, obj]);
      }
      if (obj.type === 'rock') {
        // Study rocks — stability + curiosity
        W.push(['sniff_object', (0.08 + sigmoid(s.curiosity) * 0.3 + sigmoid(s.stability) * 0.15) * clamp01(1 - objDist / 300), null, obj]);
      }
      if (obj.type === 'stump') {
        // Sit on stump — stability driven, chill slimes love this
        W.push(['sit_stump', (0.10 + sigmoid(s.stability) * 0.4) * clamp01(1 - objDist / 350), null, obj]);
      }
    }
  }

  // Check if being challenged → boost flee/recoil
  for (const { id, slime: other } of others) {
    if (id === brain.selfId) continue;
    const ob = other._prairieBrain;
    if (ob && (ob.behavior === 'challenge' || ob.behavior === 'intimidate') && ob.targetId === brain.selfId) {
      const instab = 1 - sigmoid(s.stability);
      W.push(['flee', 0.5 + instab * 0.5, id]);
      W.push(['recoil', 0.3 + instab * 0.4, id]);
    }
  }

  // Variety penalty
  for (const w of W) {
    const count = brain.recentBehaviors.filter(b => b === w[0]).length;
    w[1] *= Math.max(0.15, 1 - count * 0.2);
  }

  // Weighted random pick
  const total = W.reduce((s, w) => s + Math.max(0, w[1]), 0);
  if (total <= 0) return { name: 'wander', target: null, obj: null };
  let roll = Math.random() * total;
  for (const [name, weight, target, obj] of W) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return { name, target, obj: obj || null };
  }
  return { name: 'wander', target: null, obj: null };
}

// ── Duration table ───────────────────────────────────────────────────────────
const DUR = {
  approach:      [3000, 6000],
  observe:       [2500, 5000],
  follow:        [4000, 9000],
  orbit:         [3500, 7000],
  bond:          [3000, 6000],
  romance:       [4000, 8000],
  investigate:   [2500, 5000],
  challenge:     [2500, 5000],
  intimidate:    [1500, 3500],
  flee:          [2000, 4000],
  recoil:        [600, 1500],
  calm:          [3000, 6000],
  flee_short:    [800, 1800],
  wander:        [3500, 8000],
  idle_look:     [2000, 5000],
  explore_jump:  [2500, 5000],
  sniff_object:  [2500, 5500],
  play_ball:     [3000, 7000],
  sit_stump:     [3000, 8000],
};

function startBehavior(brain, name, targetId, now, targetObj) {
  brain.behavior = name;
  brain.targetId = targetId;
  brain.targetObj = targetObj || null;
  brain.startedAt = now;
  const [lo, hi] = DUR[name] || [3000, 6000];
  brain.endsAt = now + randRange(lo, hi);
  brain.moveGoalX = null;
  brain.pauseUntil = 0;
  brain.recentBehaviors.push(name);
  if (brain.recentBehaviors.length > 8) brain.recentBehaviors.shift();
}

// ── Behavior chains ──────────────────────────────────────────────────────────
const CHAINS = {
  approach:    ['observe', 'orbit', 'bond', 'investigate', 'wander'],
  observe:     ['bond', 'follow', 'orbit', 'wander', 'investigate'],
  follow:      ['bond', 'observe', 'orbit', 'wander'],
  orbit:       ['observe', 'bond', 'investigate', 'wander'],
  bond:        ['romance', 'follow', 'observe', 'wander'],
  romance:     ['bond', 'follow', 'wander'],
  investigate: ['approach', 'observe', 'orbit', 'wander'],
  challenge:   ['intimidate', 'wander'],
  intimidate:  ['challenge', 'wander'],
  flee:        ['wander', 'idle_look'],
  recoil:      ['flee', 'wander'],
  calm:        ['bond', 'observe', 'wander'],
  wander:      null, // full re-pick
  idle_look:   null,
  explore_jump:null,
  sniff_object:['wander', 'idle_look'],
  play_ball:   ['wander', 'explore_jump'],
  sit_stump:   ['idle_look', 'wander'],
};

// ── Execute behavior (called every tick ~50ms) ──────────────────────────────
function execBehavior(brain, slime, others, world, now) {
  const s = slime.stats || {};
  const sc = getCenter(slime);
  const target = brain.targetId ? others.find(o => o.id === brain.targetId)?.slime : null;
  const tc = target ? getCenter(target) : null;
  const dist = tc ? Math.hypot(sc.x - tc.x, sc.y - tc.y) : 9999;
  const energy = 0.5 + sigmoid(s.vitality) * 0.5;
  const agi = 0.5 + sigmoid(s.agility) * 0.5;

  switch (brain.behavior) {

    case 'approach': {
      if (!tc) break;
      if (dist > 80) {
        moveToward(slime, brain, tc.x, 0.75 * energy);
        if (sigmoid(s.curiosity) > 0.55 && Math.random() < 0.012 * energy)
          tryJump(slime, brain, now);
      } else {
        brake(brain);
        faceTo(slime, target);
      }
      if (dist < 300) keepAction(slime, 'observe', 0.65 + clamp01(1 - dist / 300) * 0.5);
      break;
    }

    case 'observe': {
      if (!tc) break;
      brake(brain);
      faceTo(slime, target);
      // Gentle sway
      const sway = Math.sin(now * 0.002 + brain.seed * 10) * 6;
      if (Math.abs(sway) > 3) {
        const saved = slime.moveAcceleration;
        slime.moveAcceleration = saved * 0.12;
        slime.applyHorizontalInput(Math.sign(sway));
        slime.moveAcceleration = saved;
      }
      keepAction(slime, 'observe', 0.8 + clamp01((now - brain.startedAt) / 2000) * 0.3);
      break;
    }

    case 'follow': {
      if (!tc) break;
      const followDist = 55 + agi * 25;
      const side = sc.x > tc.x ? 1 : -1;
      const goalX = tc.x + side * followDist;
      if (Math.abs(sc.x - goalX) > 20)
        moveToward(slime, brain, goalX, 0.65 * energy);
      else {
        brake(brain);
        faceTo(slime, target);
      }
      keepAction(slime, 'study', 0.65 + clamp01(1 - dist / 200) * 0.35);
      // Mimicry jump
      if (target?.locomotionState === 'jump' && Math.random() < 0.06 * agi)
        tryJump(slime, brain, now);
      break;
    }

    case 'orbit': {
      if (!tc) break;
      brain.orbitAngle += brain.orbitDir * (0.007 + agi * 0.01);
      const radius = 75 + agi * 35;
      const goalX = tc.x + Math.cos(brain.orbitAngle) * radius;
      moveToward(slime, brain, goalX, 0.6 * energy);
      faceTo(slime, target);
      keepAction(slime, 'study', 0.6 + Math.abs(Math.sin(brain.orbitAngle)) * 0.2);
      if (Math.random() < 0.002) brain.orbitDir *= -1;
      break;
    }

    case 'bond': {
      if (!tc) break;
      if (dist > 55) moveToward(slime, brain, tc.x, 0.4 * energy);
      else {
        brake(brain);
        faceTo(slime, target);
        // Gentle bob
        const bob = Math.sin(now * 0.003 + brain.seed * 6) * 3;
        if (Math.abs(bob) > 1.5) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.06;
          slime.applyHorizontalInput(Math.sign(bob));
          slime.moveAcceleration = saved;
        }
      }
      keepAction(slime, 'question', 0.75 + clamp01((now - brain.startedAt) / 3000) * 0.3);
      if (Math.random() < 0.006) {
        brain.addBias(brain.targetId, 0.06);
        const ob = target?._prairieBrain;
        if (ob) ob.addBias(brain.selfId, 0.04);
      }
      break;
    }

    case 'romance': {
      if (!tc) break;
      if (dist > 45) moveToward(slime, brain, tc.x, 0.25 * energy);
      else {
        brake(brain);
        faceTo(slime, target);
        const sway = Math.sin(now * 0.0025 + brain.seed * 8) * 4;
        if (Math.abs(sway) > 2) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.05;
          slime.applyHorizontalInput(Math.sign(sway));
          slime.moveAcceleration = saved;
        }
      }
      keepAction(slime, 'observe', 0.85 + Math.sin(now * 0.003) * 0.15);
      if (Math.random() < 0.008) {
        brain.addBias(brain.targetId, 0.10);
        const ob = target?._prairieBrain;
        if (ob) ob.addBias(brain.selfId, 0.07);
      }
      break;
    }

    case 'investigate': {
      if (!tc) break;
      const phase = Math.sin(now * 0.0015 + brain.seed * 5);
      if (phase > 0.15) {
        const side = sc.x > tc.x ? 1 : -1;
        moveToward(slime, brain, tc.x + side * (90 + Math.sin(now * 0.001) * 40), 0.55 * energy);
      } else {
        brake(brain);
        faceTo(slime, target);
      }
      keepAction(slime, 'question', 0.7 + Math.abs(phase) * 0.3);
      break;
    }

    case 'challenge': {
      if (!tc) break;
      if (dist > 90) {
        moveToward(slime, brain, tc.x, 0.9 * energy);
        if (Math.random() < 0.02 * energy) tryJump(slime, brain, now);
      } else {
        // Stomp: push forward then back
        const push = Math.sin(now * 0.005 + brain.seed * 4);
        if (push > 0.25) moveToward(slime, brain, tc.x, 0.35 * energy);
        else if (push < -0.25) moveAway(slime, brain, tc.x, 0.25, world);
        else { brake(brain); faceTo(slime, target); }
      }
      keepAction(slime, 'attack', 0.8 + clamp01(1 - dist / 150) * 0.4);
      // Trigger reactions
      if (dist < 100 && Math.random() < 0.01) {
        brain.addBias(brain.targetId, -0.05);
        const ob = target?._prairieBrain;
        if (ob) {
          ob.addBias(brain.selfId, -0.08);
          const otherStab = sigmoid(target.stats?.stability || 50);
          if (otherStab < 0.45 && ob.behavior !== 'flee' && ob.behavior !== 'recoil')
            startBehavior(ob, otherStab < 0.3 ? 'flee' : 'recoil', brain.selfId, now);
        }
      }
      break;
    }

    case 'intimidate': {
      if (!tc) break;
      if (dist > 130) moveToward(slime, brain, tc.x, 0.4 * energy);
      else {
        brake(brain);
        faceTo(slime, target);
        const lurch = Math.sin(now * 0.004 + brain.seed * 3);
        if (lurch > 0.5) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.15;
          slime.applyHorizontalInput(sc.x < tc.x ? 1 : -1);
          slime.moveAcceleration = saved;
        }
      }
      keepAction(slime, 'attack', 0.7 + Math.abs(Math.sin(now * 0.003)) * 0.35);
      break;
    }

    case 'flee': {
      if (!tc) break;
      moveAway(slime, brain, tc.x, 1.1 * energy, world);
      if (Math.random() < 0.03 * energy) tryJump(slime, brain, now);
      keepAction(slime, 'flee', 0.85 + clamp01(1 - dist / 200) * 0.3);
      if (dist > 350) brain.endsAt = now + 300;
      break;
    }

    case 'recoil': {
      if (!tc) break;
      moveAway(slime, brain, tc.x, 0.7 * energy, world);
      keepAction(slime, 'hurt', 0.85 + clamp01(1 - (now - brain.startedAt) / 1000) * 0.3);
      break;
    }

    case 'calm': {
      if (!tc) break;
      if (dist > 85) moveToward(slime, brain, tc.x, 0.35 * energy);
      else {
        brake(brain);
        faceTo(slime, target);
        const sway = Math.sin(now * 0.002 + brain.seed * 7) * 3;
        if (Math.abs(sway) > 1.5) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.05;
          slime.applyHorizontalInput(Math.sign(sway));
          slime.moveAcceleration = saved;
        }
      }
      keepAction(slime, 'study', 0.7 + clamp01((now - brain.startedAt) / 3000) * 0.25);
      if (Math.random() < 0.005) {
        brain.addBias(brain.targetId, 0.04);
        const ob = target?._prairieBrain;
        if (ob) ob.addBias(brain.selfId, 0.05);
      }
      break;
    }

    // ═══ SOLO ═══

    case 'wander': {
      if (brain.pauseUntil > now) {
        brake(brain);
        // Look around
        const look = Math.sin(now * 0.001 + brain.seed * 12);
        if (Math.abs(look) > 0.5) slime.facing = Math.sign(look);
        break;
      }
      if (!brain.moveGoalX || Math.abs(sc.x - brain.moveGoalX) < 18) {
        const range = 140 + sigmoid(s.curiosity) * 220;
        brain.moveGoalX = Math.max(world.left + 80, Math.min(world.right - 80,
          sc.x + (Math.random() - 0.5) * range * 2));
        if (Math.random() < 0.22 && (now - brain.startedAt) > 600) {
          brain.pauseUntil = now + randRange(800, 2500);
          brake(brain);
          break;
        }
      }
      moveToward(slime, brain, brain.moveGoalX, 0.5 * energy);
      if (Math.random() < 0.006 * energy) tryJump(slime, brain, now);
      break;
    }

    case 'idle_look': {
      brake(brain);
      const phase = Math.sin(now * 0.0008 + brain.seed * 9);
      slime.facing = phase > 0.1 ? 1 : phase < -0.1 ? -1 : slime.facing;
      if (Math.abs(phase) > 0.6)
        keepAction(slime, 'observe', 0.55 + Math.abs(phase) * 0.15);
      break;
    }

    case 'explore_jump': {
      if (!brain.moveGoalX || Math.abs(sc.x - brain.moveGoalX) < 30) {
        brain.moveGoalX = Math.max(world.left + 80, Math.min(world.right - 80,
          sc.x + (Math.random() - 0.5) * 400));
      }
      moveToward(slime, brain, brain.moveGoalX, 0.7 * energy);
      if (Math.random() < 0.03 * energy) tryJump(slime, brain, now);
      break;
    }

    // ═══ OBJECT INTERACTIONS ═══

    case 'sniff_object': {
      // Approach an object and study it
      const obj = brain.targetObj;
      if (!obj) break;
      const objDist = Math.abs(sc.x - obj.x);
      if (objDist > 45) {
        moveToward(slime, brain, obj.x, 0.45 * energy);
      } else {
        brake(brain);
        if (sc.x !== obj.x) slime.facing = Math.sign(obj.x - sc.x);
        // Sway while studying
        const sway = Math.sin(now * 0.003 + brain.seed * 7) * 3;
        if (Math.abs(sway) > 1.5) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.04;
          slime.applyHorizontalInput(Math.sign(sway));
          slime.moveAcceleration = saved;
        }
      }
      keepAction(slime, 'question', 0.7 + clamp01(1 - objDist / 100) * 0.35);
      break;
    }

    case 'play_ball': {
      // Push a ball around! Approach then nudge it
      const obj = brain.targetObj;
      if (!obj || obj.type !== 'ball') break;
      const bDist = Math.abs(sc.x - obj.x);
      if (bDist > 30) {
        moveToward(slime, brain, obj.x, 0.65 * energy);
      } else {
        // Nudge the ball!
        const pushDir = Math.sign(sc.x - obj.x) || (Math.random() > 0.5 ? 1 : -1);
        obj.vx += -pushDir * (1.5 + energy * 2);
        obj.vy -= 1.0 + Math.random() * 2;
        // Reset approach
        brain.moveGoalX = null;
        // Sometimes jump with the kick
        if (Math.random() < 0.3 * energy) tryJump(slime, brain, now);
        keepAction(slime, 'attack', 0.7);
        // Reacquire target
        brain.endsAt = now + randRange(600, 1500);
      }
      keepAction(slime, 'observe', 0.4 + clamp01(1 - bDist / 80) * 0.3);
      break;
    }

    case 'sit_stump': {
      // Go sit near a stump
      const obj = brain.targetObj;
      if (!obj) break;
      const sDist = Math.abs(sc.x - obj.x);
      if (sDist > 35) {
        moveToward(slime, brain, obj.x, 0.35 * energy);
      } else {
        brake(brain);
        // Just chill, look around
        const look = Math.sin(now * 0.0006 + brain.seed * 11);
        slime.facing = look > 0 ? 1 : -1;
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC ENGINE
// ═══════════════════════════════════════════════════════════════════════════
export class SlimeInteractionEngine {
  constructor() {
    this._lastTick = 0;
  }

  tick(entries, world, prairieObjects) {
    const now = performance.now();
    if (now - this._lastTick < TICK_MS) return;
    this._lastTick = now;

    const pObjects = prairieObjects || [];

    // Ensure brains
    for (const { id, slime } of entries) {
      if (!slime._prairieBrain) {
        slime._prairieBrain = new SlimeBrain(id);
        startBehavior(slime._prairieBrain, 'wander', null, now);
      }
    }

    for (const { id, slime } of entries) {
      if (slime.draggedNode) continue;
      const brain = slime._prairieBrain;
      brain.decayBias();

      // Behavior expired → pick next
      if (now >= brain.endsAt) {
        const chain = CHAINS[brain.behavior];
        let next = null;

        // Try chain first (70% chance)
        if (chain && Math.random() < 0.7) {
          // Score chain options lightly
          const opts = chain.map(name => {
            let w = 0.5;
            // Verify target still valid for social behaviors
            if (brain.targetId && !['wander','idle_look','explore_jump'].includes(name)) {
              const t = entries.find(e => e.id === brain.targetId);
              if (!t || t.slime.draggedNode) w = 0.05;
              else {
                const d = Math.hypot(getCenter(slime).x - getCenter(t.slime).x,
                                     getCenter(slime).y - getCenter(t.slime).y);
                if (d > 500) w *= 0.2;
              }
            }
            // Variety
            const rc = brain.recentBehaviors.filter(b => b === name).length;
            w *= Math.max(0.2, 1 - rc * 0.2);
            return { name, target: brain.targetId, w };
          });
          const tw = opts.reduce((s, o) => s + o.w, 0);
          let r = Math.random() * tw;
          for (const o of opts) { r -= o.w; if (r <= 0) { next = o; break; } }
        }

        // Full re-pick
        if (!next) {
          const pick = pickBehavior(brain, slime, entries, world, now, pObjects);
          next = { name: pick.name, target: pick.target, obj: pick.obj };
        }

        startBehavior(brain, next.name, next.target, now, next.obj);
        // Log behavior transition
        brain.logInteraction(next.name, next.target, next.obj ? next.obj.type : '');
      }

      // Execute
      execBehavior(brain, slime, entries, world, now);

      // Stat micro-learning (very rare)
      if (brain.targetId && Math.random() < 0.003) {
        const t = entries.find(e => e.id === brain.targetId)?.slime;
        if (t?.stats && slime.stats) {
          const learnMap = {
            observe: 'curiosity', approach: 'curiosity', investigate: 'curiosity',
            follow: 'empathy', bond: 'empathy', romance: 'empathy', calm: 'empathy',
            challenge: 'ferocity', flee: 'stability', recoil: 'stability',
          };
          const stat = learnMap[brain.behavior];
          if (stat && slime.stats[stat] !== undefined) {
            const dir = ['flee','recoil'].includes(brain.behavior) ? -0.3 : 0.3;
            const oldVal = slime.stats[stat];
            slime.stats[stat] = Math.max(1, Math.min(99, oldVal + dir));
            brain.logStatChange(stat, oldVal, slime.stats[stat], brain.behavior);
          }
        }
      }
    }
  }

  removeSlime(id) {}
  reset() { this._lastTick = 0; }
}
