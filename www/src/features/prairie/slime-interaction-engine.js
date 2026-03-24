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

import { getPerformanceTier } from '../../utils/device-performance-profile.js';
import { recordSlimeEvent, recordObjectInteraction, getObjectMemory } from '../../vendor/inku-slime-v3/engine/lifecycle/livingState.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
//  PER-FRAME PATCHES (applied once on first brain creation)
//
//  PATCH 1 — AI Drive:
//  applyHorizontalInput is called once per AI tick (~50ms) but ground
//  friction kills all velocity in ~3 frames. We store the intention
//  (_aiMoveDir, _aiSpeedMul) and re-apply it every physics frame.
//
//  PATCH 2 — Face Override:
//  updateAnimationController rebuilds faceAnimation from scratch every frame
//  at 60fps, wiping any values set by driveFace() (which runs at 20fps).
//  We patch updateAnimationController to lerp-in _aiFaceOverride fields
//  AFTER the built-in calculation, producing smooth blended expressions.
//
//  PATCH 3 — Move squash reduction:
//  The built-in move locomotion sets scaleX up to 1.28 and skewX aggressively,
//  making AI slimes look like squashed slugs. We dampen those after the fact.
// ═══════════════════════════════════════════════════════════════════════════
let _patchesApplied = false;
function ensureAIDrivePatch(SlimeProto) {
  if (_patchesApplied || !SlimeProto?.applyKeyboardControls) return;
  _patchesApplied = true;

  // ── Patch 1: per-frame horizontal drive ──
  const origKeyboard = SlimeProto.applyKeyboardControls;
  SlimeProto.applyKeyboardControls = function patchedKeyboard() {
    origKeyboard.call(this);
    if (this.draggedNode) return;
    const dir = this._aiMoveDir;
    if (!dir) return;
    const saved    = this.moveAcceleration;
    const savedMax = this.maxMoveSpeed;
    this.moveAcceleration = saved    * (this._aiSpeedMul || 1);
    this.maxMoveSpeed     = savedMax * (this._aiSpeedMul || 1);
    this.applyHorizontalInput(dir);
    this.moveAcceleration = saved;
    this.maxMoveSpeed     = savedMax;
  };

  // ── Patch 2 + 3: face override blend & move squash fix ──
  const origAnim = SlimeProto.updateAnimationController;
  SlimeProto.updateAnimationController = function patchedAnim() {
    origAnim.call(this);

    // ── Patch 3: kill move-locomotion squash/stretch & slug skew entirely ──
    // skewX applies a horizontal shear to the whole canvas INCLUDING the face,
    // pulling it off the ground plane. We zero it completely so the face stays
    // perfectly parallel to the ground at all times. roll is also zeroed.
    if (this.locomotionState === 'move' && this.renderPose) {
      const p = this.renderPose;
      // Pull scaleX back toward 1 (reduce squash/stretch)
      p.scaleX = 1 + (p.scaleX - 1) * 0.4;
      p.scaleY = 1 + (p.scaleY - 1) * 0.5;
      // Kill skew and roll completely — face must stay flat / parallel to ground
      p.skewX = 0;
      p.roll  = 0;
    }

    // ── Patch 4: movement inertia — face lags OPPOSITE to travel direction ──
    // This gives the illusion of physical weight: when the slime moves right,
    // the face is slightly pulled left (drag lag), then snaps back when stopped.
    // lookBiasY is also nudged up slightly to counteract any remaining body tilt.
    if (this.faceAnimation) {
      const avgV     = this.getAverageVelocity?.();
      const speedX   = avgV ? avgV.x : 0;
      const absSpeed = Math.abs(speedX);
      const drive    = Math.min(1, absSpeed / Math.max(1, this.maxMoveSpeed || 4));
      const f        = this.faceAnimation;
      const isMoving = this.locomotionState === 'move' && drive > 0.05;

      // Face lags behind: moves right → face biased left (−), and vice-versa
      // Only apply when no AI behavior is already setting lookBiasX
      const ov = this._aiFaceOverride;
      if (!ov || ov.lookBiasX == null) {
        const targetInertiaX = isMoving ? -Math.sign(speedX) * drive * 8 : 0;
        // Slow blend (0.09) = heavy lag; fast recovery when stopping
        f.lookBiasX = (f.lookBiasX || 0) + (targetInertiaX - (f.lookBiasX || 0)) * (isMoving ? 0.09 : 0.20);
      }

      // Slight upward lift to counteract any residual body tilt during movement
      const targetBiasY = isMoving ? -drive * 4.5 : 0;
      f.lookBiasY = (f.lookBiasY || 0) + (targetBiasY - (f.lookBiasY || 0)) * 0.18;
    }

    // ── Patch 2: blend AI face override into the built-in face ──
    const ov = this._aiFaceOverride;
    if (!ov || !this.faceAnimation) return;
    const f  = this.faceAnimation;
    // Smooth blend speed: 0.18 per frame ≈ reaches 90% in ~12 frames (~200ms)
    const T  = 0.18;
    // Only blend fields that the override has set (non-null)
    if (ov.eyeScaleX       != null) f.eyeScaleX       = f.eyeScaleX       + (ov.eyeScaleX       - f.eyeScaleX)       * T;
    if (ov.eyeScaleY       != null) f.eyeScaleY       = f.eyeScaleY       + (ov.eyeScaleY       - f.eyeScaleY)       * T;
    if (ov.browLift        != null) f.browLift        = f.browLift        + (ov.browLift        - f.browLift)        * T;
    if (ov.browTilt        != null) f.browTilt        = f.browTilt        + (ov.browTilt        - f.browTilt)        * T;
    if (ov.lookBiasX       != null) f.lookBiasX       = f.lookBiasX       + (ov.lookBiasX       - f.lookBiasX)       * T;
    if (ov.lookBiasY       != null) f.lookBiasY       = f.lookBiasY       + (ov.lookBiasY       - f.lookBiasY)       * T;
    if (ov.mouthScaleX     != null) f.mouthScaleX     = f.mouthScaleX     + (ov.mouthScaleX     - f.mouthScaleX)     * T;
    // Overrides — only apply when the override is actually set to a string
    if (typeof ov.overrideEyeStyle   === 'string') f.overrideEyeStyle   = ov.overrideEyeStyle;
    if (typeof ov.overrideMouthStyle === 'string') f.overrideMouthStyle = ov.overrideMouthStyle;
    // Clamp final values
    f.eyeScaleX  = Math.max(0.7,  Math.min(1.28, f.eyeScaleX));
    f.eyeScaleY  = Math.max(0.15, Math.min(1.28, f.eyeScaleY));
    f.browLift   = Math.max(-0.2, Math.min(0.72, f.browLift));
    f.browTilt   = Math.max(-0.1, Math.min(0.8,  f.browTilt));
    f.lookBiasX  = Math.max(-10,  Math.min(10,   f.lookBiasX));
    f.lookBiasY  = Math.max(-8,   Math.min(8,    f.lookBiasY));
  };
}

// TICK_MS adapts to the active performance tier
function getTickMs() {
    const tier = getPerformanceTier();
    if (tier === 'low')    return 120; // ~8 AI ticks/s
    if (tier === 'medium') return 75;  // ~13 AI ticks/s
    return 50;                          // ~20 AI ticks/s (high)
}

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
    // Post-fight forced speech bubble (consumed by maybeSpawnBubble in prairie-feature.js)
    this._pendingBubble = null;
    // Teleport flee cooldown (ms timestamp)
    this._lastTeleportAt = 0;
    // Reckless chase: set when a combatant refuses to let prey escape
    this._recklessChaseTargetId = null;
    this._lastRecklessChaseAt   = 0;
    // Pending conversational reply (set when another slime speaks to us)
    this._pendingReply = null;

    // ── Needs system ─────────────────────────────────────────────────────────
    // hunger: 0 (not hungry) → 100 (very hungry). Never kills the slime.
    this.hunger = 10 + Math.random() * 20; // start slightly hungry
    this._lastHungerTick = 0; // timestamp of last hunger increase

    // ── Emotional state (for mood transfer) ──────────────────────────────────
    // happiness & fear: 0..1 floats, influenced by nearby slimes via empathy.
    this.emotionalState = { happiness: 0.5 + Math.random() * 0.3, fear: 0 };

    // ── Memory: known food position (set when another slime communicates) ────
    this.knownFoodPos = null; // { x, objectType } or null

    // ── Hunt state ───────────────────────────────────────────────────────────
    this._huntTargetId = null; // ID of the bird being hunted (index in prairieObjects)
    this._huntJumpAt = 0;     // timestamp of the hunt jump attempt

    // ── Crowd bump cooldown ───────────────────────────────────────────────────
    this._bumpCooldown = 0;        // timestamp; no bump until now > this
    this._teleportCooldown = 0;    // cooldown for teleporters
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

// ═══════════════════════════════════════════════════════════════════════════
//  SOCIAL RELATIONSHIP SYSTEM
//  Writes persistent memories and maintains the canonical relationship ledger
//  (livingState.relationshipLedger.affinities) that survives withdraw/redeploy.
// ═══════════════════════════════════════════════════════════════════════════

function getSlimeName(slime) {
    return slime?._canonicalName || 'Inkübus';
}

/** Returns (or creates) the affinity entry for a given target in a slime's ledger. */
function getOrInitAffinity(slime, targetId, targetName) {
    const rl = slime?.livingState?.relationshipLedger;
    if (!rl) return null;
    if (!rl.affinities[targetId]) {
        rl.affinities[targetId] = {
            displayName: targetName,
            bias: 0,
            type: 'neutral',
            interactionCount: 0,
            firstMetAt: new Date().toISOString(),
            lastSeenAt: null,
            significantEvents: [],
            // One-shot threshold flags so the same milestone is never written twice
            crossedFriendly: false,
            crossedFriend: false,
            crossedDeepBond: false,
            crossedHostile: false,
            crossedRival: false,
            crossedCombatPartner: false,
        };
    }
    return rl.affinities[targetId];
}

/** Appends a significant event to the affinity ledger AND writes to the memory ledger. */
function writeRelMemory(slime, targetId, targetName, eventKind, note) {
    const rel = getOrInitAffinity(slime, targetId, targetName);
    if (!rel) return;
    rel.significantEvents.push({ kind: eventKind, at: new Date().toISOString(), note });
    if (rel.significantEvents.length > 10) rel.significantEvents.shift();
    recordSlimeEvent(slime, 'social_' + eventKind, {
        targetId, targetName, note, relType: rel.type, bias: rel.bias,
    }, { importance: 'significant', persistLongTerm: true });
}

/** Syncs bias/type and fires one-shot milestone memories. Called every AI tick per active pair. */
function updateSocialRelationship(brain, slime, entries, now) {
    if (!brain.targetId || !slime?.livingState) return;
    const targetEntry = entries.find(e => e.id === brain.targetId);
    if (!targetEntry?.slime) return;
    const targetSlime = targetEntry.slime;
    const targetName = getSlimeName(targetSlime);
    const selfName   = getSlimeName(slime);

    // Per-pair runtime throttle data stored on the brain (not persisted, ephemeral)
    if (!brain._relTrack) brain._relTrack = new Map();
    let track = brain._relTrack.get(brain.targetId);
    if (!track) {
        track = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 };
        brain._relTrack.set(brain.targetId, track);
    }

    const rel = getOrInitAffinity(slime, brain.targetId, targetName);
    if (!rel) return;

    // ── First contact ──
    if (rel.interactionCount === 0) {
        rel.interactionCount = 1;
        rel.lastSeenAt = new Date().toISOString();
        rel.bias = brain.getBias(brain.targetId);
        writeRelMemory(slime, brain.targetId, targetName, 'first_contact',
            `Premier contact avec ${targetName}`);
        // Mirror in target's ledger
        if (targetSlime.livingState) {
            const tRel = getOrInitAffinity(targetSlime, brain.selfId, selfName);
            if (tRel && tRel.interactionCount === 0) {
                tRel.interactionCount = 1;
                tRel.lastSeenAt = new Date().toISOString();
                writeRelMemory(targetSlime, brain.selfId, selfName, 'first_contact',
                    `Premier contact avec ${selfName}`);
            }
        }
        return;
    }

    // ── Throttle threshold checks to every 2 seconds ──
    rel.bias = brain.getBias(brain.targetId);
    rel.lastSeenAt = new Date().toISOString();
    rel.displayName = targetName;
    if (now - track.lastThresholdCheck < 2000) return;
    track.lastThresholdCheck = now;

    const currentBias = rel.bias;

    // ── Update relationship type ──
    if (currentBias >= 0.80)       rel.type = 'lover';
    else if (currentBias >= 0.55)  rel.type = 'friend';
    else if (currentBias >= 0.25)  rel.type = 'friendly';
    else if (currentBias <= -0.55) rel.type = 'rival';
    else if (currentBias <= -0.25) rel.type = 'hostile';
    else                           rel.type = 'neutral';

    // Combat partner override: mutual fighters with high ferocity, not pure enemies
    const hasFightMem = rel.significantEvents?.some(
        e => e.kind === 'fight_won' || e.kind === 'fight_lost');
    if (hasFightMem
        && (slime.stats?.ferocity || 50) > 62
        && (targetSlime.stats?.ferocity || 50) > 62
        && currentBias > -0.25 && currentBias < 0.55) {
        rel.type = 'combat_partner';
    }
    if (!rel.crossedCombatPartner && rel.type === 'combat_partner') {
        rel.crossedCombatPartner = true;
        writeRelMemory(slime, brain.targetId, targetName, 'combat_partner',
            `Partenaire de combat avec ${targetName}`);
    }

    // ── Update social flags ──
    const rl = slime.livingState.relationshipLedger;
    const affs = Object.values(rl.affinities);
    rl.socialFlags.friendships = affs.filter(r => r.type === 'friend' || r.type === 'friendly' || r.type === 'lover').length;
    rl.socialFlags.rivalries   = affs.filter(r => r.type === 'rival'  || r.type === 'hostile').length;
    rl.socialFlags.bonded      = affs.some(r => r.type === 'friend' || r.type === 'lover');

    // ── One-shot positive milestones ──
    if (!rel.crossedFriendly && currentBias >= 0.25) {
        rel.crossedFriendly = true;
        writeRelMemory(slime, brain.targetId, targetName, 'friendly_bond',
            `Amitié naissante avec ${targetName}`);
    }
    if (!rel.crossedFriend && currentBias >= 0.55) {
        rel.crossedFriend = true;
        writeRelMemory(slime, brain.targetId, targetName, 'true_friend',
            `Véritable ami de ${targetName}`);
    }
    if (!rel.crossedDeepBond && currentBias >= 0.80) {
        rel.crossedDeepBond = true;
        writeRelMemory(slime, brain.targetId, targetName, 'deep_bond',
            `Lien profond avec ${targetName}`);
    }

    // ── One-shot negative milestones ──
    if (!rel.crossedHostile && currentBias <= -0.25) {
        rel.crossedHostile = true;
        writeRelMemory(slime, brain.targetId, targetName, 'hostility',
            `Hostilité envers ${targetName}`);
    }
    if (!rel.crossedRival && currentBias <= -0.55) {
        rel.crossedRival = true;
        writeRelMemory(slime, brain.targetId, targetName, 'rivalry',
            `Rivalité établie avec ${targetName}`);
    }

    // ── Romance memory (max once per 60 s) ──
    if (brain.behavior === 'romance' && currentBias >= 0.25 && now - track.lastRomanceMem > 60000) {
        track.lastRomanceMem = now;
        writeRelMemory(slime, brain.targetId, targetName, 'romantic_moment',
            `Moment romantique avec ${targetName}`);
    }
}

/**
 * Writes a conflict memory for both participants (attacker and victim).
 * Throttled: at most once per 30 s per pair, per direction.
 */
function writeConflictMemoryPair(attacker, attackerId, attackerName, victim, victimId, victimName, now) {
    const ab = attacker._prairieBrain;
    if (ab && attacker.livingState) {
        if (!ab._relTrack) ab._relTrack = new Map();
        let aTrack = ab._relTrack.get(victimId);
        if (!aTrack) { aTrack = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 }; ab._relTrack.set(victimId, aTrack); }
        if (now - aTrack.lastConflictMem > 30000) {
            aTrack.lastConflictMem = now;
            writeRelMemory(attacker, victimId, victimName, 'conflict',
                `Confrontation avec ${victimName}`);
        }
    }
    const vb = victim._prairieBrain;
    if (vb && victim.livingState) {
        if (!vb._relTrack) vb._relTrack = new Map();
        let vTrack = vb._relTrack.get(attackerId);
        if (!vTrack) { vTrack = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 }; vb._relTrack.set(attackerId, vTrack); }
        if (now - vTrack.lastConflictMem > 30000) {
            vTrack.lastConflictMem = now;
            writeRelMemory(victim, attackerId, attackerName, 'conflict_victim',
                `Confronté par ${attackerName}`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PHASE 2 — COMBAT SYSTEM
//  Real physical fights: fight_clash behavior, physics knockback,
//  stat consequences, canonical memories for winner and loser.
// ═══════════════════════════════════════════════════════════════════════════

/** Applies a velocity impulse to every Verlet node of a slime (knockback). */
function applyKnockbackToSlime(slime, vx, vy) {
    if (!slime?.nodes?.length) return;
    for (const node of slime.nodes) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
        node.oldX = node.x - vx;
        node.oldY = node.y - vy;
    }
}

/** Deterministic fight score (random jitter added separately at fight start). */
function computeFightScore(slime) {
    const s = slime.stats || {};
    return (s.ferocity || 50) * 0.5 + (s.vitality || 50) * 0.3 + (s.stability || 50) * 0.2;
}

/** Applies stat consequences to one fighter and writes the canonical memory. */
function applyFightStatChanges(slime, brain, won, opponentId, opponentName) {
    if (!slime?.stats) return;
    const s = slime.stats;
    if (won) {
        const ferocityGain = randRange(1, 3);
        const vitalityLoss = randRange(0, 1.5);
        const oldFer = s.ferocity;
        const oldVit = s.vitality;
        s.ferocity = Math.min(99, s.ferocity + ferocityGain);
        s.vitality = Math.max(1,  s.vitality - vitalityLoss);
        brain.logStatChange('ferocity', oldFer, s.ferocity, 'fight_won');
        if (vitalityLoss > 0.1) brain.logStatChange('vitality', oldVit, s.vitality, 'fight_won');
        // Very combative slimes enjoy the fight — slight positive bias toward opponent
        if (s.ferocity > 68) brain.addBias(opponentId, 0.05);
        writeRelMemory(slime, opponentId, opponentName, 'fight_won',
            `A vaincu ${opponentName} au combat`);
        // Persist combat history for temperament evolution
        const progW = slime?.livingState?.progressionLedger;
        if (progW) progW.combatWins = (progW.combatWins || 0) + 1;
    } else {
        const vitalityLoss  = randRange(2, 5);
        const stabilityLoss = randRange(0.5, 3);
        const oldVit  = s.vitality;
        const oldStab = s.stability;
        s.vitality  = Math.max(1, s.vitality  - vitalityLoss);
        s.stability = Math.max(1, s.stability - stabilityLoss);
        brain.logStatChange('vitality',  oldVit,  s.vitality,  'fight_lost');
        brain.logStatChange('stability', oldStab, s.stability, 'fight_lost');
        brain.addBias(opponentId, -0.12);
        writeRelMemory(slime, opponentId, opponentName, 'fight_lost',
            `A été vaincu par ${opponentName}`);
        // Persist combat history for temperament evolution
        const progL = slime?.livingState?.progressionLedger;
        if (progL) progL.combatLosses = (progL.combatLosses || 0) + 1;
        // Resilience training: tough slimes partially recover stability
        if (oldStab > 55) {
            s.stability = Math.min(99, s.stability + 0.5);
        }
    }
}

/**
 * Resolves a fight_clash between two slimes.
 * Called once when slimeA's fight_clash expires (brainA._fightTargetId set).
 * Prevents double-resolution: nulls _fightTargetId on BOTH brains immediately.
 */
function resolveFightClash(brainA, slimeA, slimeB, now) {
    if (!brainA._fightTargetId) return; // already resolved by the other side
    const brainB = slimeB._prairieBrain;

    // Roll scores (deterministic base + per-fight random jitter stored at start)
    const scoreA = (brainA._fightScore ?? computeFightScore(slimeA)) + Math.random() * 8;
    const scoreB = brainB ? ((brainB._fightScore ?? computeFightScore(slimeB)) + Math.random() * 8)
                          : computeFightScore(slimeB);
    const aWon = scoreA >= scoreB;

    const winner      = aWon ? slimeA : slimeB;
    const loser       = aWon ? slimeB : slimeA;
    const winnerBrain = aWon ? brainA : brainB;
    const loserBrain  = aWon ? brainB : brainA;

    const idA   = brainA.selfId;
    const idB   = brainB?.selfId || brainA.targetId;
    const nameA = getSlimeName(slimeA);
    const nameB = getSlimeName(slimeB);

    // Null out fight state on BOTH sides FIRST (prevents double-resolution)
    brainA._fightTargetId = null;
    brainA._fightScore    = null;
    if (brainB) { brainB._fightTargetId = null; brainB._fightScore = null; }

    // Stat changes + canonical memories
    applyFightStatChanges(slimeA, brainA, aWon,  idB, nameB);
    applyFightStatChanges(slimeB, brainB ?? { logStatChange(){}, addBias(){} }, !aWon, idA, nameA);

    // Interaction log
    brainA.logInteraction(aWon ? 'fight_won' : 'fight_lost', idB,
        aWon ? `Victoire contre ${nameB}` : `Défaite contre ${nameB}`);
    if (brainB) brainB.logInteraction(!aWon ? 'fight_won' : 'fight_lost', idA,
        !aWon ? `Victoire contre ${nameA}` : `Défaite contre ${nameA}`);

    // Physics: big knockback to loser
    const loserCenter  = getCenter(loser);
    const winnerCenter = getCenter(winner);
    const kDir = Math.sign(loserCenter.x - winnerCenter.x) || 1;
    applyKnockbackToSlime(loser, kDir * 6, -4);

    // Force loser into recoil
    if (loserBrain) {
        startBehavior(loserBrain, 'recoil', winnerBrain ? winnerBrain.selfId : idA, now);
        loser.triggerAction('hurt', 900, 1.2);
    }
    // Winner: brief triumph flash
    if (winnerBrain) {
        winner.triggerAction('attack', 600, 1.0);
    }
    // Queue immediate speech bubble for both fighters
    if (winnerBrain) winnerBrain._pendingBubble = { emotion: 'combat' };
    if (loserBrain)  loserBrain._pendingBubble  = { emotion: 'pain' };
}

/**
 * Derives the current temperament archetype from a slime's stats + combat history.
 * Also persists the result to progressionLedger.temperament for the obs panel.
 * Archetypes: 'combatant' | 'fearful' | 'resilient' | 'pacifist' | 'neutral'
 */
function getTemperament(slime) {
    const s   = slime?.stats || {};
    const prog = slime?.livingState?.progressionLedger;
    const wins   = prog?.combatWins   || 0;
    const losses = prog?.combatLosses || 0;

    let tag = 'neutral';
    if ((s.ferocity || 50) >= 68 && wins >= 2)            tag = 'combatant';
    else if ((s.stability || 50) <= 35 && losses >= 2)    tag = 'fearful';
    else if ((s.stability || 50) >= 65 && losses >= 1)    tag = 'resilient';
    else if ((s.empathy || 50) >= 65 && (s.ferocity || 50) <= 45) tag = 'pacifist';

    if (prog) prog.temperament = tag;
    return tag;
}

// ── Movement primitives ──────────────────────────────────────────────────────

/**
 * Returns a 0..1 speed multiplier based on slime stats.
 * agility drives base speed; ferocity adds a combat burst; vitality sustains it.
 */
function statSpeed(slime) {
  const s = slime.stats || {};
  const agi = sigmoid(s.agility  || 50);   // 0..1
  const fer = sigmoid(s.ferocity || 50);   // 0..1
  const vit = sigmoid(s.vitality || 50);   // 0..1
  // Base: 0.7..2.2 range — fast slimes are genuinely fast
  return 0.7 + agi * 0.9 + fer * 0.35 + vit * 0.25;
}

function moveToward(slime, brain, tx, speedMul) {
  const cx = getCenter(slime).x;
  const dx = tx - cx;
  if (Math.abs(dx) < 5) {
    brain.intentDir  *= 0.7;
    slime._aiMoveDir  = 0;
    slime._aiSpeedMul = 0;
    return;
  }
  const dir = Math.sign(dx);
  // Smooth the intent direction for gradual acceleration feel
  brain.intentDir = lerp(brain.intentDir, dir, 0.25);
  if (Math.abs(brain.intentDir) > 0.04) {
    slime.facing = Math.sign(brain.intentDir);
    const ss = statSpeed(slime);
    // Store intention — the per-frame patch will apply it every physics frame
    slime._aiMoveDir  = Math.sign(brain.intentDir);
    slime._aiSpeedMul = Math.max(0.4, speedMul) * ss;
  }
}

function moveAway(slime, brain, fromX, speedMul, world) {
  const cx = getCenter(slime).x;
  const tx = Math.max(world.left + 80, Math.min(world.right - 80, cx + (cx - fromX) * 2.5));
  moveToward(slime, brain, tx, speedMul);
}

/** Called when a slime should stop moving — clears the per-frame drive. */
function clearAIDrive(slime) {
  slime._aiMoveDir  = 0;
  slime._aiSpeedMul = 0;
}

function brake(brain, slime) {
  brain.intentDir *= 0.55;
  if (slime) {
    slime._aiMoveDir  = 0;
    slime._aiSpeedMul = 0;
  }
}

function faceTo(slime, target) {
  const sc = getCenter(slime), tc = getCenter(target);
  const dx = tc.x - sc.x;
  if (Math.abs(dx) > 3) slime.facing = Math.sign(dx);
}

function tryJump(slime, brain, now, forceMul) {
  if (now - brain.lastJumpAt < 400) return;
  const gr = slime.getGroundedRatio?.() ?? 0;
  if (gr > 0.2 && slime.jumpCooldownFrames <= 0) {
    const s   = slime.stats || {};
    const agi = sigmoid(s.agility  || 50);
    const vit = sigmoid(s.vitality || 50);
    // Jump height scales with stats: 0.85..1.6 multiplier
    const heightMul = (0.85 + agi * 0.45 + vit * 0.3) * (forceMul || 1);
    const savedJump = slime.jumpImpulse;
    slime.jumpImpulse = savedJump * heightMul;
    
    // Le slime fait son saut physique
    slime.tryJump();
    
    // NOUVEAU : On joue ton son ZzFX généré !
    // (On multiplie heightMul par 8 pour simuler la force du saut)
    SlimeSoundEngine.playJump(heightMul * 8, slime);

    slime.jumpImpulse = savedJump;
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

/**
 * driveFace — writes target values into slime._aiFaceOverride each AI tick.
 * The per-frame patch in updateAnimationController lerp-blends these values
 * into the final faceAnimation smoothly at 60fps, preventing any flicker.
 *
 * We only set fields we want to override; null means "don't touch".
 */
function driveFace(slime, behavior, brain, target, dist, now) {
  // Ensure the override object exists and is reset each tick
  if (!slime._aiFaceOverride) slime._aiFaceOverride = {};
  const ov = slime._aiFaceOverride;

  // Clear all fields first — we'll set only what this behavior needs
  ov.eyeScaleX       = null;
  ov.eyeScaleY       = null;
  ov.browLift        = null;
  ov.browTilt        = null;
  ov.lookBiasX       = null;
  ov.lookBiasY       = null;
  ov.mouthScaleX     = null;
  ov.overrideEyeStyle   = null;
  ov.overrideMouthStyle = null;

  const elapsed = now - brain.startedAt;
  // Ramp 0→1 over 1.0s — expression builds in gradually
  const ramp = Math.min(1, elapsed / 1000);

  switch (behavior) {

    case 'romance': {
      ov.eyeScaleX       = 1 + ramp * 0.16;
      ov.eyeScaleY       = 1 + ramp * 0.18;
      ov.browLift        = 0.25 + ramp * 0.2;
      ov.browTilt        = 0;
      ov.mouthScaleX     = 1 + ramp * 0.1;
      ov.lookBiasY       = -2 * ramp;
      ov.overrideEyeStyle   = ramp > 0.65 && dist < 80 ? 'heart' : null;
      ov.overrideMouthStyle = ramp > 0.55 ? 'kiss' : null;
      break;
    }

    case 'bond': {
      ov.eyeScaleX       = 1 + ramp * 0.12;
      ov.eyeScaleY       = 1 + ramp * 0.14;
      ov.browLift        = 0.18 + ramp * 0.18;
      ov.overrideEyeStyle   = ramp > 0.7 ? 'sparkle'     : null;
      ov.overrideMouthStyle = ramp > 0.6 ? 'candy_smile' : null;
      break;
    }

    case 'fight_clash': {
      const ferocity = slime.stats?.ferocity ?? 50;
      const fierce   = ferocity > 62;
      ov.eyeScaleY       = Math.max(0.2, 1 - ramp * 0.65);
      ov.browTilt        = slime.facing * 0.65 * ramp;
      ov.browLift        = -0.18 * ramp;
      ov.lookBiasX       = slime.facing * 9 * ramp;
      ov.overrideEyeStyle   = fierce && ramp > 0.55 ? 'flame_eye'
                            : ramp > 0.45            ? 'angry_arc'
                            : null;
      ov.overrideMouthStyle = fierce && ramp > 0.65 ? 'venom_drip'
                            : ramp > 0.35            ? 'fangs'
                            : null;
      break;
    }

    case 'reckless_chase': {
      ov.eyeScaleY       = Math.max(0.35, 1 - ramp * 0.45);
      ov.browTilt        = slime.facing * 0.5 * ramp;
      ov.browLift        = -0.12 * ramp;
      ov.lookBiasX       = slime.facing * 7 * ramp;
      ov.overrideEyeStyle   = ramp > 0.55 ? 'half_lid' : null;
      ov.overrideMouthStyle = ramp > 0.5  ? 'smirk'   : null;
      break;
    }

    case 'challenge': {
      ov.eyeScaleY       = Math.max(0.3, 1 - ramp * 0.5);
      ov.browTilt        = slime.facing * 0.55 * ramp;
      ov.browLift        = -0.08 * ramp;
      ov.lookBiasX       = slime.facing * 6 * ramp;
      ov.overrideEyeStyle   = ramp > 0.5  ? 'slit'      : null;
      ov.overrideMouthStyle = ramp > 0.55 ? 'wide_gape' : null;
      break;
    }

    case 'intimidate': {
      // Empty threatening stare — more terrifying than challenge
      ov.eyeScaleX       = Math.max(0.85, 1 - ramp * 0.1);
      ov.eyeScaleY       = Math.max(0.18, 1 - ramp * 0.72);
      ov.browTilt        = slime.facing * 0.7 * ramp;
      ov.browLift        = -0.2 * ramp;
      ov.lookBiasX       = slime.facing * 8 * ramp;
      ov.overrideEyeStyle   = ramp > 0.4  ? 'void'  : null;
      ov.overrideMouthStyle = ramp > 0.5  ? 'drool' : null;
      break;
    }

    case 'flee':
    case 'teleport_flee': {
      const lookBack = target
        ? -Math.sign(getCenter(target).x - getCenter(slime).x)
        : slime.facing;
      ov.eyeScaleX       = 1 + ramp * 0.24;
      ov.eyeScaleY       = 1 + ramp * 0.28;
      ov.browLift        = 0.5 + ramp * 0.18;
      ov.browTilt        = 0.28 * ramp;
      ov.lookBiasX       = lookBack * 7 * ramp;
      ov.overrideEyeStyle   = ramp > 0.75 ? 'spiral'     : null; // full panic
      ov.overrideMouthStyle = ramp > 0.4  ? 'tiny_frown' : null;
      break;
    }

    case 'recoil': {
      ov.eyeScaleY       = Math.max(0.22, 1 - ramp * 0.55);
      ov.browLift        = 0.45 * ramp;
      ov.browTilt        = -0.3 * ramp;
      ov.overrideEyeStyle   = ramp > 0.5  ? 'X_eye'      : null; // stunned/hurt
      ov.overrideMouthStyle = 'tiny_frown';
      break;
    }

    case 'observe':
    case 'investigate': {
      ov.eyeScaleX       = 1 + ramp * 0.14;
      ov.eyeScaleY       = 1 + ramp * 0.16;
      ov.browLift        = 0.3 + ramp * 0.12;
      ov.browTilt        = slime.facing * 0.18 * ramp;
      ov.lookBiasX       = target
        ? Math.sign(getCenter(target).x - getCenter(slime).x) * 5 * ramp
        : 0;
      ov.overrideMouthStyle = ramp > 0.65 ? 'hmm' : null;
      break;
    }

    case 'approach': {
      ov.eyeScaleX       = 1 + ramp * 0.1;
      ov.eyeScaleY       = 1 + ramp * 0.12;
      ov.browLift        = 0.18 + ramp * 0.12;
      ov.lookBiasX       = target
        ? Math.sign(getCenter(target).x - getCenter(slime).x) * 5 * ramp
        : 0;
      ov.overrideMouthStyle = ramp > 0.55 ? 'open_smile' : null;
      break;
    }

    case 'follow': {
      ov.eyeScaleY       = 1 + ramp * 0.08;
      ov.browLift        = 0.12 + ramp * 0.08;
      ov.lookBiasX       = target
        ? Math.sign(getCenter(target).x - getCenter(slime).x) * 4 * ramp
        : 0;
      ov.overrideMouthStyle = ramp > 0.65 ? 'smile' : null;
      break;
    }

    case 'orbit': {
      const orbitPhase   = Math.sin(brain.orbitAngle);
      ov.eyeScaleX       = 1 + Math.abs(orbitPhase) * 0.08;
      ov.eyeScaleY       = 1 + ramp * 0.06;
      ov.browTilt        = orbitPhase * 0.22;
      ov.browLift        = 0.08 + ramp * 0.1;
      break;
    }

    case 'calm': {
      ov.eyeScaleY       = 1 - ramp * 0.06;
      ov.browLift        = 0.08 + ramp * 0.12;
      ov.mouthScaleX     = 1 + ramp * 0.07;
      ov.overrideMouthStyle = ramp > 0.75 ? 'smile' : null;
      break;
    }

    case 'explore_jump': {
      ov.eyeScaleY       = 1 + ramp * 0.12;
      ov.browLift        = 0.18 + ramp * 0.15;
      ov.overrideMouthStyle = ramp > 0.5 ? 'open_smile' : null;
      break;
    }

    case 'play_ball': {
      ov.eyeScaleX       = 1 + ramp * 0.14;
      ov.eyeScaleY       = 1 + ramp * 0.16;
      ov.browLift        = 0.22 + ramp * 0.18;
      ov.overrideMouthStyle = 'grin';
      break;
    }

    case 'sit_stump': {
      ov.eyeScaleY       = Math.max(0.5, 1 - ramp * 0.3);
      ov.browLift        = -0.04;
      ov.overrideEyeStyle   = ramp > 0.75 ? 'sleepy' : null;
      ov.overrideMouthStyle = ramp > 0.65 ? 'flat'   : null;
      break;
    }

    case 'seek_food': {
      // Determined look toward food, a little hungry frown
      ov.eyeScaleX       = 1 + ramp * 0.08;
      ov.eyeScaleY       = 1 + ramp * 0.10;
      ov.browLift        = 0.10 + ramp * 0.10;
      ov.browTilt        = 0.12 * ramp; // slight worried frown
      ov.lookBiasX       = slime.facing * 6 * ramp;
      ov.overrideMouthStyle = ramp > 0.6 ? 'tiny_frown' : null;
      break;
    }

    case 'eat_berry': {
      // Happy eating eyes, big smile — face turned hard toward the bush
      // lookBiasX pushes the face in the facing direction (toward food).
      // Since the body clipping system keeps the face inside the body,
      // this creates the illusion that the slime is nuzzling the bush.
      const chew = Math.sin(now * 0.014 + (brain?.seed || 0) * 5); // chewing oscillation
      ov.eyeScaleX       = 1 + ramp * 0.14 + Math.abs(chew) * 0.06;
      ov.eyeScaleY       = Math.max(0.28, 1 - ramp * 0.45 - Math.abs(chew) * 0.1); // squint/blink with chewing
      ov.browLift        = 0.32 + ramp * 0.22;
      ov.mouthScaleX     = 1 + ramp * 0.18 + Math.abs(chew) * 0.08;
      // Face turned firmly toward the bush — clipping keeps it inside the body,
      // so it looks like the slime is facing INTO the bush
      ov.lookBiasX       = slime.facing * (6 + ramp * 5);
      ov.lookBiasY       = -1.5 * ramp; // slight downward angle (food is at ground level)
      ov.overrideMouthStyle = ramp > 0.4 ? 'candy_smile' : null;
      break;
    }

    case 'hunt_bird': {
      // Focused predator stare, narrowed eyes — drooling at prey when close
      ov.eyeScaleY       = Math.max(0.22, 1 - ramp * 0.65);
      ov.browTilt        = slime.facing * 0.55 * ramp;
      ov.browLift        = -0.08 * ramp;
      ov.lookBiasX       = slime.facing * 9 * ramp;
      ov.lookBiasY       = -2 * ramp; // looking slightly down at prey
      ov.overrideEyeStyle   = ramp > 0.45 ? 'slit'                              : null;
      ov.overrideMouthStyle = ramp > 0.7 && dist < 100 ? 'venom_drip'
                            : ramp > 0.4               ? 'grin'
                            : null;
      break;
    }

    case 'falcon_dive': {
      // Ascent: focused predator look. Dive: full aggression
      const divPhase = brain?._falconPhase || 'ascend';
      if (divPhase === 'ascend') {
        ov.eyeScaleY       = Math.max(0.25, 1 - ramp * 0.6);
        ov.browTilt        = slime.facing * 0.5 * ramp;
        ov.browLift        = -0.1 * ramp;
        ov.overrideEyeStyle   = ramp > 0.3 ? 'slit'      : null;
        ov.overrideMouthStyle = ramp > 0.4 ? 'grin'      : null;
      } else {
        // Dive — maximum threat expression
        ov.eyeScaleY       = Math.max(0.1, 1 - 0.88);
        ov.browTilt        = slime.facing * 0.85;
        ov.browLift        = -0.25;
        ov.overrideEyeStyle   = 'flame_eye';
        ov.overrideMouthStyle = 'wide_gape';
      }
      break;
    }

    case 'communicate': {
      // Friendly informative expression — bright eyes, open mouth
      ov.eyeScaleX       = 1 + ramp * 0.12;
      ov.eyeScaleY       = 1 + ramp * 0.14;
      ov.browLift        = 0.20 + ramp * 0.14;
      ov.lookBiasX       = target ? Math.sign(getCenter(target).x - getCenter(slime).x) * 5 * ramp : 0;
      ov.overrideEyeStyle   = ramp > 0.6  ? 'sparkle'     : null;
      ov.overrideMouthStyle = ramp > 0.45 ? 'open_smile' : null;
      break;
    }

    default: break;
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
      if (obj.type === 'bench') {
        // Sit on bench — empathy + stability, lovers more likely
        const relBonus = Object.values(slime.livingState?.relationshipLedger?.affinities || {})
          .some(r => r.type === 'lover' || r.type === 'friend') ? 0.25 : 0;
        W.push(['sit_bench', (0.12 + sigmoid(s.empathy) * 0.35 + sigmoid(s.stability) * 0.25 + relBonus) * clamp01(1 - objDist / 380), null, obj]);
        // Aggressive slimes may eject bench sitters
        if ((s.ferocity || 50) > 58 && obj._sitterCount > 0)
          W.push(['eject_bench', (0.08 + sigmoid(s.ferocity) * 0.35), null, obj]);
      }
    }
  }

  // ── Food-seeking behaviors (hunger-driven) ────────────────────────────────
  const diet = slime.genome?.dietType || 'omnivore';
  const laziness = slime.genome?.laziness ?? 0.5;
  // Threshold: lazy slimes wait longer before seeking food
  const hungerThreshold = 30 + laziness * 40;
  if (brain.hunger >= hungerThreshold && prairieObjects) {
    for (const obj of prairieObjects) {
      const objDist = Math.hypot(sc.x - obj.x, sc.y - (obj.y || world.groundY));
      if (objDist > 600) continue;

      // Berry eating (herbivores + omnivores)
      if (obj.type === 'berry_bush' && obj.berryCount > 0 && diet !== 'carnivore') {
        // Check object memory: negative memory reduces interest
        const mem = getObjectMemory(slime, `berry_${obj.berryType}`);
        const memMod = mem ? (1 + mem.pleasurePain) : 1;
        const hungerDrive = brain.hunger / 100;
        const w = (0.3 + hungerDrive * 0.8) * memMod * clamp01(1 - objDist / 500);
        if (w > 0.05) W.push(['seek_food', w, null, obj]);
      }

      // Bird hunting (carnivores + omnivores)
      if (obj.type === 'bird' && obj.state === 'landed' && diet !== 'herbivore') {
        const hungerDrive = brain.hunger / 100;
        const ferBoost = sigmoid(s.ferocity || 50);
        const w = (0.2 + hungerDrive * 0.7 + ferBoost * 0.3) * clamp01(1 - objDist / 500);
        if (w > 0.05) W.push(['hunt_bird', w, null, obj]);
      }
    }

    // Use known food position communicated by another slime
    if (brain.knownFoodPos && diet !== 'carnivore') {
      const kdist = Math.abs(sc.x - brain.knownFoodPos.x);
      if (kdist < 700) {
        W.push(['seek_food', 0.25 * (brain.hunger / 100), null, brain.knownFoodPos]);
      } else {
        brain.knownFoodPos = null; // too far, forget it
      }
    }
  }

  // ── Communication (share food knowledge) ─────────────────────────────────
  // A slime that knows a food position and is near a hungry slime can share it
  if (brain.knownFoodPos || (brain.hunger < 30 && brain.behavior === 'eat_berry')) {
    for (const { id, slime: other } of others) {
      if (id === brain.selfId) continue;
      const oc = getCenter(other);
      const dist2 = Math.hypot(sc.x - oc.x, sc.y - oc.y);
      const ob = other._prairieBrain;
      if (dist2 < 200 && ob && ob.hunger > hungerThreshold) {
        const empDrive = sigmoid(s.empathy || 50);
        W.push(['communicate', 0.15 + empDrive * 0.25, id]);
        break;
      }
    }
  }

  // Check if being challenged → boost flee/recoil, or counter for instable
  for (const { id, slime: other } of others) {
    if (id === brain.selfId) continue;
    const ob = other._prairieBrain;
    if (ob && (ob.behavior === 'challenge' || ob.behavior === 'intimidate') && ob.targetId === brain.selfId) {
      if (slime.genome?.isInstable) {
        // Pride: instable slimes never back down from a fight — counter-challenge
        W.push(['challenge',  1.8, id]);
        W.push(['intimidate', 1.2, id]);
      } else {
        const instab = 1 - sigmoid(s.stability);
        W.push(['flee',   0.5 + instab * 0.5, id]);
        W.push(['recoil', 0.3 + instab * 0.4, id]);
      }
    }
  }

  // ── Instable slime behavior modifiers ──────────────────────────────────────
  if (slime.genome?.isInstable) {
    const mass = slime.genome.instabilityMass || 'heavy';
    const myFightScore = computeFightScore(slime);

    for (const w of W) {
      const name = w[0];
      const tid  = w[2]; // targetId

      // Suppress social/gentle behaviors — instable slimes don't bond or care
      if (['bond','romance','calm','follow','orbit','communicate'].includes(name)) w[1] *= 0.02;
      // Suppress flight instinct (pride) — fear only from much stronger opponents
      if (['flee','teleport_flee','recoil'].includes(name) && tid) {
        const other = others.find(o => o.id === tid)?.slime;
        const otherScore = other ? computeFightScore(other) : 50;
        const powerDiff = otherScore - myFightScore;
        // Only flee if opponent is overwhelmingly stronger (>25 points gap)
        w[1] *= powerDiff > 25 ? 0.6 : 0.04;
      }
      // Boost aggressive behaviors significantly
      if (['challenge','intimidate','fight_clash','reckless_chase'].includes(name)) w[1] *= 3.0;
      // Food is one of the few real pleasures
      if (['seek_food','hunt_bird','eat_berry'].includes(name)) w[1] *= 2.0;

      // Wariness: reduce aggression against significantly stronger opponents
      if (['challenge','intimidate'].includes(name) && tid) {
        const other = others.find(o => o.id === tid)?.slime;
        if (other) {
          const otherScore = computeFightScore(other);
          const powerDiff = otherScore - myFightScore;
          if (powerDiff > 20) w[1] *= Math.max(0.05, 1 - (powerDiff - 20) / 40);
        }
      }
    }

    // Gaseous instable: can do falcon dive on nearby slimes
    if (mass === 'gaseous') {
      for (const { id, slime: other } of others) {
        if (id === brain.selfId || other.draggedNode) continue;
        const oc  = getCenter(other);
        const d   = Math.hypot(sc.x - oc.x, sc.y - oc.y);
        if (d < 650) {
          const ferBoost = sigmoid(s.ferocity || 50);
          W.push(['falcon_dive', 0.20 + ferBoost * 0.55, id]);
        }
      }
    }
  }

  // ── Temperament modifiers ──
  const temperament = getTemperament(slime);
  if (temperament !== 'neutral') {
    const TEMP_MODS = {
      combatant: { challenge: 1.6, fight_clash: 1.5, flee: 0.25, recoil: 0.4 },
      fearful:   { flee: 2.0, recoil: 1.5, challenge: 0.15, fight_clash: 0.1, bond: 0.8 },
      resilient: { recoil: 0.5, flee: 0.6, challenge: 1.3, bond: 1.2 },
      pacifist:  { bond: 1.5, romance: 1.5, calm: 1.4, challenge: 0.08, fight_clash: 0.05 },
    };
    const mods = TEMP_MODS[temperament];
    if (mods) for (const w of W) { if (mods[w[0]] !== undefined) w[1] *= mods[w[0]]; }
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
  fight_clash:     [3000, 7000],
  teleport_flee:   [1200, 2500],
  reckless_chase:  [2500, 5500],
  seek_food:       [4000, 9000],
  eat_berry:       [1500, 3000],
  hunt_bird:       [5000, 10000],
  communicate:     [2000, 4000],
  falcon_dive:     [3500, 6000],  // Gaseous instable dive-bomb
  // ── New behaviors ──
  sit_bench:       [5000, 12000], // Sit on a bench
  eject_bench:     [800,  1500],  // Aggressive slime kicks others off bench
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
  // Reset one-shot behavior flags on each new behavior start
  brain._ateThisBehavior = false;
  brain._communicatedThisBehavior = false;
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
  challenge:   ['fight_clash', 'intimidate', 'wander'],
  intimidate:  ['challenge', 'wander'],
  fight_clash:     ['wander', 'idle_look'],
  flee:            ['wander', 'idle_look'],
  teleport_flee:   ['flee', 'wander'],
  recoil:          ['flee', 'wander'],
  reckless_chase:  ['challenge', 'fight_clash', 'wander'],
  calm:            ['bond', 'observe', 'wander'],
  wander:      null, // full re-pick
  idle_look:   null,
  explore_jump:null,
  sniff_object:['wander', 'idle_look'],
  play_ball:   ['wander', 'explore_jump'],
  sit_stump:   ['idle_look', 'wander'],
  seek_food:   ['eat_berry', 'hunt_bird', 'wander'],
  eat_berry:   ['wander', 'idle_look'],
  hunt_bird:   ['wander', 'idle_look'],
  communicate:  ['wander', 'idle_look'],
  falcon_dive:  ['wander', 'idle_look', 'falcon_dive'],  // can chain into another dive
  // ── New chains ──
  sit_bench:    ['idle_look', 'wander', 'bond'],
  eject_bench:  ['challenge', 'wander'],
};

/**
 * Instantly moves a slime to (tx, ty) using a Verlet teleport:
 * shift all nodes by the delta, preserve their velocity (oldX/oldY delta stays the same).
 * This avoids NaN and preserves physics integrity.
 */
function teleportSlime(slime, tx, ty) {
  const c = getCenter(slime);
  const dx = tx - c.x;
  const dy = ty - c.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  for (const node of slime.nodes) {
    node.x    += dx;
    node.y    += dy;
    node.oldX += dx;
    node.oldY += dy;
  }
}

/**
 * Returns the first other slime blocking the path toward goalX, or null.
 * "Blocking" = same horizontal direction, within BLOCK_RANGE px, close vertically.
 */
function detectObstacle(slime, brain, others, goalX) {
  const sc  = getCenter(slime);
  const dir = Math.sign(goalX - sc.x);
  if (dir === 0) return null;
  const BLOCK_RANGE = 70; // px ahead to check
  const VERT_RANGE  = 55; // px vertical tolerance

  for (const { id, slime: other } of others) {
    if (id === brain.selfId) continue;
    if (other.draggedNode) continue;
    const oc = getCenter(other);
    const ahead = (oc.x - sc.x) * dir; // positive = in the direction of travel
    if (ahead < 8 || ahead > BLOCK_RANGE) continue;
    if (Math.abs(oc.y - sc.y) > VERT_RANGE) continue;
    return other; // first blocker found
  }
  return null;
}

/**
 * React to a slime blocking the path.
 * Picks a reaction based on dominant stat:
 *   ferocity > agility  → PUSH  (knockback + attack flash)
 *   agility  > ferocity → JUMP  (leap over)
 *   otherwise           → BUMP  (light shove + pause)
 * Throttled: one reaction per 900ms per slime to avoid spam.
 */
function resolveObstacle(slime, brain, blocker, world, now) {
  // Per-blocker cooldown stored on brain
  if (!brain._obstacleCooldowns) brain._obstacleCooldowns = new Map();
  const lastReact = brain._obstacleCooldowns.get(blocker) || 0;
  if (now - lastReact < 900) return;
  brain._obstacleCooldowns.set(blocker, now);

  const s   = slime.stats   || {};
  const fer = s.ferocity    || 50;
  const agi = s.agility     || 50;
  const sc  = getCenter(slime);
  const bc  = getCenter(blocker);

  if (fer > agi && fer > 45) {
    // ── PUSH ── shove the blocker aside
    const pushDir = Math.sign(bc.x - sc.x) || 1;
    const force   = 3.5 + sigmoid(fer) * 4.0;
    applyKnockbackToSlime(blocker, pushDir * force, -1.5);
    blocker.triggerAction('hurt', 400, 0.8);
    slime.triggerAction('attack', 350, 0.9);
    // Agitate the blocker's brain too
    const ob = blocker._prairieBrain;
    if (ob && ob.behavior !== 'fight_clash' && ob.behavior !== 'flee') {
      ob.addBias(brain.selfId, -0.04);
    }
  } else if (agi > fer && agi > 45) {
    // ── JUMP OVER ── leap above the obstacle
    tryJump(slime, brain, now - 9999, 1.3 + sigmoid(agi) * 0.5); // force cooldown bypass
    brain.lastJumpAt = 0; // reset so next real jump isn't blocked
    slime.triggerAction('observe', 300, 0.6);
  } else {
    // ── BUMP ── light shove and brief pause
    const pushDir = Math.sign(bc.x - sc.x) || 1;
    applyKnockbackToSlime(blocker, pushDir * 2.0, -0.8);
    blocker.triggerAction('hurt', 250, 0.5);
    brain.pauseUntil = now + randRange(150, 350);
  }
}

// ── Food gain resolver ────────────────────────────────────────────────────────
// Applies stat gains/maluses when a slime eats, and records object memory.
function _applyFoodGain(slime, brain, foodCategory, subType, diet, now) {
  if (!slime?.stats) return;
  const s = slime.stats;
  const objectKey = foodCategory === 'berry' ? `berry_${subType}` : 'bird_meat';

  // Reduce hunger regardless of diet
  brain.hunger = Math.max(0, brain.hunger - 40 - Math.random() * 20);

  if (foodCategory === 'berry') {
    if (diet === 'herbivore') {
      // Full gain: agility + stability
      const agiGain  = 1.5 + Math.random() * 2.5;
      const stabGain = 0.5 + Math.random() * 1.5;
      const oldAgi  = s.agility;
      const oldStab = s.stability;
      s.agility   = Math.min(99, s.agility   + agiGain);
      s.stability = Math.min(99, s.stability + stabGain);
      brain.logStatChange('agility',   oldAgi,  s.agility,   'ate_berry');
      brain.logStatChange('stability', oldStab, s.stability, 'ate_berry');
      recordObjectInteraction(slime, objectKey, +0.4);
      brain.logInteraction('eat_berry', null, `Délicieuses baies ! (+Agilité)`);
    } else if (diet === 'omnivore') {
      // Partial gain
      const agiGain  = 0.5 + Math.random() * 1.5;
      const oldAgi   = s.agility;
      s.agility = Math.min(99, s.agility + agiGain);
      brain.logStatChange('agility', oldAgi, s.agility, 'ate_berry');
      recordObjectInteraction(slime, objectKey, +0.15);
      brain.logInteraction('eat_berry', null, `Baies mangées. (+Agilité)`);
    } else {
      // Carnivore eating berries: MALUS
      const agiLoss  = 0.5 + Math.random() * 1.0;
      const stabLoss = 0.3 + Math.random() * 0.7;
      const oldAgi   = s.agility;
      const oldStab  = s.stability;
      s.agility   = Math.max(1, s.agility   - agiLoss);
      s.stability = Math.max(1, s.stability - stabLoss);
      brain.logStatChange('agility',   oldAgi,  s.agility,   'ate_wrong_food');
      brain.logStatChange('stability', oldStab, s.stability, 'ate_wrong_food');
      // Strong negative memory: carnivore learns to avoid berries
      recordObjectInteraction(slime, objectKey, -0.6);
      brain.logInteraction('eat_berry', null, `Beurk... Ces baies me rendent malade.`);
      slime.triggerAction('hurt', 600, 0.8);
    }
  } else if (foodCategory === 'bird') {
    if (diet === 'carnivore') {
      // Full gain: ferocity + vitality + empathy (charisme)
      const ferGain = 1.5 + Math.random() * 2.5;
      const vitGain = 0.8 + Math.random() * 2.0;
      const empGain = 0.5 + Math.random() * 1.5;
      const oldFer  = s.ferocity;
      const oldVit  = s.vitality;
      const oldEmp  = s.empathy;
      s.ferocity = Math.min(99, s.ferocity + ferGain);
      s.vitality = Math.min(99, s.vitality + vitGain);
      s.empathy  = Math.min(99, s.empathy  + empGain);
      brain.logStatChange('ferocity', oldFer, s.ferocity, 'ate_bird');
      brain.logStatChange('vitality', oldVit, s.vitality, 'ate_bird');
      brain.logStatChange('empathy',  oldEmp, s.empathy,  'ate_bird');
      recordObjectInteraction(slime, objectKey, +0.5);
      brain.logInteraction('hunt_bird', null, `Festin ! (+Férocité, +Vitalité)`);
    } else if (diet === 'omnivore') {
      // Partial gain
      const ferGain = 0.5 + Math.random() * 1.5;
      const vitGain = 0.3 + Math.random() * 1.0;
      const oldFer  = s.ferocity;
      const oldVit  = s.vitality;
      s.ferocity = Math.min(99, s.ferocity + ferGain);
      s.vitality = Math.min(99, s.vitality + vitGain);
      brain.logStatChange('ferocity', oldFer, s.ferocity, 'ate_bird');
      brain.logStatChange('vitality', oldVit, s.vitality, 'ate_bird');
      recordObjectInteraction(slime, objectKey, +0.2);
      brain.logInteraction('hunt_bird', null, `Oiseau mangé. (+Férocité)`);
    }
    // Herbivores can't hunt birds — they simply won't get the hunt_bird behavior
  }

  // Store last food position for communication (used by 'communicate' behavior)
  brain._lastFoodPos = { x: getCenter(slime).x, objectType: objectKey };
  // Note: _ateThisBehavior and _communicatedThisBehavior are reset by startBehavior
}

// ── Execute behavior (called every tick ~50ms) ──────────────────────────────
function execBehavior(brain, slime, others, world, now) {
  // Gaseous instable: must touch the ground to eat or fight (pride keeps them on ground)
  if (slime.genome?.isInstable && slime.genome.instabilityMass === 'gaseous') {
    const groundedBehaviors = new Set([
      'seek_food','eat_berry','hunt_bird',
      'fight_clash','challenge','intimidate','recoil'
    ]);
    slime._instableGrounded = groundedBehaviors.has(brain.behavior);
  }

  const s = slime.stats || {};
  const sc = getCenter(slime);
  const target = brain.targetId ? others.find(o => o.id === brain.targetId)?.slime : null;
  const tc = target ? getCenter(target) : null;
  const dist = tc ? Math.hypot(sc.x - tc.x, sc.y - tc.y) : 9999;
  const energy = 0.5 + sigmoid(s.vitality) * 0.5;
  const agi = 0.5 + sigmoid(s.agility) * 0.5;

  // ── PASSIVE FACE-TO-FACE BLOCKER SCAN ─────────────────────────────────────
  // Runs every tick before behavior switch. If a NON-target slime is directly
  // in the movement direction (within 52px), the slime reacts: jump over
  // (agile), punch through (ferocious), or nudge aside (neutral).
  // This prevents the "walking through another slime like a ghost" problem.
  {
    const isMovingBehavior = ['wander','explore_jump','approach','follow',
      'bond','romance','calm','seek_food'].includes(brain.behavior);
    const moveDir = slime._aiMoveDir > 0 ? 1 : slime._aiMoveDir < 0 ? -1 : 0;

    if (isMovingBehavior && moveDir !== 0 && !slime.draggedNode) {
      if (!brain._passiveBlockCooldowns) brain._passiveBlockCooldowns = new Map();
      const FACE_DIST = 52;
      const VERT_TOL  = 40;

      for (const { id, slime: other } of others) {
        if (id === brain.selfId || id === brain.targetId || other.draggedNode) continue;
        const oc    = getCenter(other);
        const ahead = (oc.x - sc.x) * moveDir;
        if (ahead < 4 || ahead > FACE_DIST) continue;
        if (Math.abs(oc.y - sc.y) > VERT_TOL) continue;

        const lastReact = brain._passiveBlockCooldowns.get(id) || 0;
        if (now - lastReact < 1100) continue;
        brain._passiveBlockCooldowns.set(id, now);

        const fer = s.ferocity || 50;
        const ag  = s.agility  || 50;
        const ob  = other._prairieBrain;

        if (ag > 54 && ag >= fer) {
          // Agile: jump cleanly over
          tryJump(slime, brain, now - 9999, 1.2 + sigmoid(ag) * 0.4);
          brain.lastJumpAt = 0;
          slime.triggerAction('observe', 260, 0.5);
        } else if (fer > 50 && fer >= ag) {
          // Ferocious: punch the blocker aside
          const pushDir = Math.sign(oc.x - sc.x) || moveDir;
          applyKnockbackToSlime(other, pushDir * (4.5 + sigmoid(fer) * 5.0), -2.5);
          other.triggerAction('hurt', 420, 0.85);
          slime.triggerAction('attack', 280, 0.88);
          if (ob) {
            ob.addBias(brain.selfId, -0.05);
            brain._pendingBubble = { emotion: 'angry' };
            ob._pendingBubble    = { emotion: 'pain' };
          }
          SlimeSoundEngine.playBump(slime);
        } else {
          // Neutral: light nudge + brief pause
          const pushDir = Math.sign(oc.x - sc.x) || moveDir;
          applyKnockbackToSlime(other, pushDir * 2.5, -1.0);
          other.triggerAction('hurt', 200, 0.42);
          brain.pauseUntil = now + randRange(180, 420);
        }
        break; // one blocker per tick
      }
    }
  }

  switch (brain.behavior) {

    case 'approach': {
      if (!tc) break;
      if (dist > 80) {
        const approachBlocker = detectObstacle(slime, brain, others, tc.x);
        if (approachBlocker && approachBlocker !== target)
          resolveObstacle(slime, brain, approachBlocker, world, now);
        moveToward(slime, brain, tc.x, 0.75 * energy);
        if (sigmoid(s.curiosity) > 0.55 && Math.random() < 0.012 * energy)
          tryJump(slime, brain, now);
      } else {
        brake(brain, slime);
        faceTo(slime, target);
      }
      if (dist < 300) keepAction(slime, 'observe', 0.65 + clamp01(1 - dist / 300) * 0.5);
      break;
    }

    case 'observe': {
      if (!tc) break;
      brake(brain, slime);
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
      if (Math.abs(sc.x - goalX) > 20) {
        const followBlocker = detectObstacle(slime, brain, others, goalX);
        if (followBlocker && followBlocker !== target)
          resolveObstacle(slime, brain, followBlocker, world, now);
        moveToward(slime, brain, goalX, 0.65 * energy);
      } else {
        brake(brain, slime);
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
        brake(brain, slime);
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
        brake(brain, slime);
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
        brake(brain, slime);
        faceTo(slime, target);
      }
      keepAction(slime, 'question', 0.7 + Math.abs(phase) * 0.3);
      break;
    }

    case 'challenge': {
      if (!tc) break;
      const ferBoost = 0.7 + sigmoid(s.ferocity || 50) * 0.8;
      if (dist > 90) {
        moveToward(slime, brain, tc.x, 0.95 * energy * ferBoost);
        if (Math.random() < 0.03 * energy) tryJump(slime, brain, now, 1.0 + sigmoid(s.ferocity || 50) * 0.4);
      } else {
        // ── CROWD BUMP: sudden big knockback push ──────────────────────────
        if (dist < 62 && now > brain._bumpCooldown && Math.random() < 0.012) {
          brain._bumpCooldown = now + 3500 + Math.random() * 2000;
          const bumpDir = Math.sign(tc.x - sc.x) || 1;
          const bumpForce = 9 + sigmoid(s.ferocity || 50) * 7;
          applyKnockbackToSlime(target, bumpDir * bumpForce, -5);
          applyKnockbackToSlime(slime, -bumpDir * 3, -1.5); // slight recoil
          target.triggerAction('hurt', 700, 1.1);
          slime.triggerAction('attack', 400, 1.15);
          brain._pendingBubble = { emotion: 'combat' };
          const tb = target._prairieBrain;
          if (tb) tb._pendingBubble = { emotion: 'pain' };
          SlimeSoundEngine.playBump(slime);
        } else {
          // Stomp: push forward then back — fiercer for high-ferocity
          const push = Math.sin(now * 0.005 + brain.seed * 4);
          if (push > 0.2)       moveToward(slime, brain, tc.x, 0.5 * energy * ferBoost);
          else if (push < -0.2) moveAway(slime, brain, tc.x, 0.2, world);
          else { brake(brain, slime); faceTo(slime, target); }
        }
      }
      keepAction(slime, 'attack', Math.min(1.3, 0.8 + clamp01(1 - dist / 150) * 0.4 + ferBoost * 0.15));
      // Trigger reactions
      if (dist < 100 && Math.random() < 0.012) {
        brain.addBias(brain.targetId, -0.05);
        const ob = target?._prairieBrain;
        if (ob) {
          ob.addBias(brain.selfId, -0.08);
          const otherStab = sigmoid(target.stats?.stability || 50);
          if (otherStab < 0.45 && ob.behavior !== 'flee' && ob.behavior !== 'recoil')
            startBehavior(ob, otherStab < 0.3 ? 'flee' : 'recoil', brain.selfId, now);
          writeConflictMemoryPair(
            slime, brain.selfId, getSlimeName(slime),
            target, brain.targetId, getSlimeName(target),
            now
          );
        }
      }
      // ── Escalation to full fight_clash ──
      if (dist < 72 && Math.random() < 0.009 &&
          ((s.ferocity || 50) > 52 || brain.getBias(brain.targetId) < -0.35)) {
        const ob = target?._prairieBrain;
        if (ob && ob.behavior !== 'flee') {
          const fightScoreA = computeFightScore(slime)  + Math.random() * 20;
          const fightScoreB = computeFightScore(target) + Math.random() * 20;
          startBehavior(brain, 'fight_clash', brain.targetId, now);
          startBehavior(ob,    'fight_clash', brain.selfId,   now);
          brain._fightScore    = fightScoreA;
          brain._fightTargetId = brain.targetId;
          ob._fightScore       = fightScoreB;
          ob._fightTargetId    = brain.selfId;
        }
      }
      break;
    }

    case 'fight_clash': {
      if (!tc) break;
      const elapsed = now - brain.startedAt;
      // Alternate attack (0) / hurt (1) phases every 380ms for ferocious slimes
      const phaseDur = Math.max(220, 480 - (s.ferocity || 50) * 1.2);
      const fightPhase = Math.floor(elapsed / phaseDur) % 2;
      const ferBoost = 0.6 + sigmoid(s.ferocity || 50) * 0.8; // 0.6..1.4

      if (dist > 65) {
        // Close in fast — ferocious slimes rush harder
        moveToward(slime, brain, tc.x, 1.2 * energy * ferBoost);
        if (Math.random() < 0.025 * energy) tryJump(slime, brain, now, 1.1);
      } else {
        faceTo(slime, target);
        if (fightPhase === 0) {
          // Attack phase: lunge forward
          moveToward(slime, brain, tc.x, 0.7 * energy * ferBoost);
          keepAction(slime, 'attack', Math.min(1.3, 0.9 + ferBoost * 0.2));
          // Physical impact — harder knockback for ferocious slimes
          if (dist < 48 && (elapsed % phaseDur) < 120) {
            const kDir = Math.sign(tc.x - sc.x) || 1;
            const kForce = 3.5 + sigmoid(s.ferocity || 50) * 4.0;
            applyKnockbackToSlime(target, kDir * kForce, -2.5 - ferBoost);
            target.triggerAction('hurt', 600, 1.0);
          }
        } else {
          // Hurt phase: brief recoil, less retreat for high-ferocity fighters
          const recoilMul = Math.max(0.15, 0.5 - sigmoid(s.ferocity || 50) * 0.35);
          moveAway(slime, brain, tc.x, recoilMul, world);
          keepAction(slime, 'hurt', 0.9);
        }
      }
      break;
    }

    case 'intimidate': {
      if (!tc) break;
      if (dist > 130) moveToward(slime, brain, tc.x, 0.4 * energy);
      else {
        brake(brain, slime);
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
      const instab  = 1 - sigmoid(s.stability || 50);
      // Panic sprint: unstable slimes run faster under threat
      const panicMul = 1.1 + instab * 0.9;
      moveAway(slime, brain, tc.x, panicMul * energy, world);

      // Frequent jumps — unstable slimes jump more erratically
      const jumpChance = 0.04 + instab * 0.06;
      if (Math.random() < jumpChance * energy) tryJump(slime, brain, now, 1.0 + instab * 0.5);

      // Double jump: if still grounded & very unstable & just jumped, jump again
      if (instab > 0.6 && (now - brain.lastJumpAt) > 350 && (now - brain.lastJumpAt) < 650) {
        tryJump(slime, brain, now, 0.75);
      }

      // ── Teleport escape: very unstable + being actively chased ──
      // Trigger once per 8s max, only when the attacker is close & gaining
      if (instab > 0.55
          && dist < 180
          && now - brain._lastTeleportAt > 8000
          && Math.random() < 0.015 + instab * 0.02) {
        // Pick a landing spot far away on the opposite side
        const fleeDir = Math.sign(sc.x - tc.x) || (Math.random() > 0.5 ? 1 : -1);
        const teleX = Math.max(world.left + 80,
                       Math.min(world.right - 80,
                         sc.x + fleeDir * randRange(220, 380)));
        brain._lastTeleportAt = now;
        // Visual flash: brief "hurt" burst then switch to teleport_flee
        slime.triggerAction('flee', 300, 1.4);
        teleportSlime(slime, teleX, sc.y);
        brain._pendingBubble = { emotion: 'scared' };
        startBehavior(brain, 'teleport_flee', brain.targetId, now);
        break;
      }

      keepAction(slime, 'flee', 0.85 + clamp01(1 - dist / 200) * 0.3);
      if (dist > 350) brain.endsAt = now + 300;
      break;
    }

    case 'teleport_flee': {
      // Post-teleport recovery: slime lands with a stagger then sprints away
      if (!tc) { brake(brain, slime); break; }
      const elapsed = now - brain.startedAt;
      if (elapsed < 350) {
        // Stagger: brief disoriented shake
        brake(brain, slime);
        keepAction(slime, 'hurt', 1.2 - elapsed / 350);
      } else {
        // Sprint away hard
        const instab = 1 - sigmoid(s.stability || 50);
        moveAway(slime, brain, tc.x, (1.3 + instab * 0.7) * energy, world);
        keepAction(slime, 'flee', 0.7);
      }
      break;
    }

    case 'recoil': {
      if (!tc) break;
      moveAway(slime, brain, tc.x, 0.7 * energy, world);
      keepAction(slime, 'hurt', 0.85 + clamp01(1 - (now - brain.startedAt) / 1000) * 0.3);
      break;
    }

    case 'reckless_chase': {
      // Combatant temperament refusing to let prey flee — full speed pursuit
      if (!tc) { startBehavior(brain, 'wander', null, now); break; }
      const ferBoost = 0.8 + sigmoid(s.ferocity || 50) * 0.7;

      if (dist > 55) {
        // Full-tilt chase — push anything in the way aside
        const chaseBlocker = detectObstacle(slime, brain, others, tc.x);
        if (chaseBlocker && chaseBlocker !== target)
          resolveObstacle(slime, brain, chaseBlocker, world, now);
        moveToward(slime, brain, tc.x, 1.3 * energy * ferBoost);
        // Leap to close distance gaps
        if (dist > 180 && Math.random() < 0.04 * energy)
          tryJump(slime, brain, now, 1.2 + sigmoid(s.ferocity || 50) * 0.3);
      } else {
        // Cornered — immediately escalate to fight_clash
        const ob = target?._prairieBrain;
        if (ob && ob.behavior !== 'fight_clash') {
          const fightScoreA = computeFightScore(slime)  + Math.random() * 20;
          const fightScoreB = computeFightScore(target) + Math.random() * 20;
          startBehavior(brain, 'fight_clash', brain.targetId, now);
          startBehavior(ob,    'fight_clash', brain.selfId,   now);
          brain._fightScore    = fightScoreA;
          brain._fightTargetId = brain.targetId;
          ob._fightScore       = fightScoreB;
          ob._fightTargetId    = brain.selfId;
        }
      }
      keepAction(slime, 'attack', Math.min(1.3, 0.85 + ferBoost * 0.2));

      // If prey teleported out of sight, end chase
      if (dist > 500) brain.endsAt = now + 200;
      break;
    }

    case 'calm': {
      if (!tc) break;
      if (dist > 85) moveToward(slime, brain, tc.x, 0.35 * energy);
      else {
        brake(brain, slime);
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
        brake(brain, slime);
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
          brake(brain, slime);
          break;
        }
      }
      // Obstacle check
      const wanderBlocker = detectObstacle(slime, brain, others, brain.moveGoalX);
      if (wanderBlocker) resolveObstacle(slime, brain, wanderBlocker, world, now);
      moveToward(slime, brain, brain.moveGoalX, 0.5 * energy);
      if (Math.random() < 0.006 * energy) tryJump(slime, brain, now);
      break;
    }

    case 'idle_look': {
      brake(brain, slime);
      const phase = Math.sin(now * 0.0008 + brain.seed * 9);
      slime.facing = phase > 0.1 ? 1 : phase < -0.1 ? -1 : slime.facing;
      if (Math.abs(phase) > 0.6)
        keepAction(slime, 'observe', 0.55 + Math.abs(phase) * 0.15);
      break;
    }

    case 'explore_jump': {
      if (!brain.moveGoalX || Math.abs(sc.x - brain.moveGoalX) < 30) {
        brain.moveGoalX = Math.max(world.left + 80, Math.min(world.right - 80,
          sc.x + (Math.random() - 0.5) * 500));
      }
      // Obstacle check — explorers prefer jumping over, fits the behavior
      const jumpBlocker = detectObstacle(slime, brain, others, brain.moveGoalX);
      if (jumpBlocker) resolveObstacle(slime, brain, jumpBlocker, world, now);
      moveToward(slime, brain, brain.moveGoalX, 0.8 * energy);
      // More frequent, higher jumps — this is the "bouncy explorer" behavior
      const jumpFreq = 0.04 + sigmoid((slime.stats?.agility || 50)) * 0.05;
      if (Math.random() < jumpFreq * energy) tryJump(slime, brain, now, 1.1 + sigmoid(slime.stats?.agility || 50) * 0.4);
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
        brake(brain, slime);
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
        brake(brain, slime);
        // Just chill, look around
        const look = Math.sin(now * 0.0006 + brain.seed * 11);
        slime.facing = look > 0 ? 1 : -1;
      }
      break;
    }

    // ═══ FOOD & NEEDS ═══

    case 'seek_food': {
      // Move toward a food source (berry bush or via knownFoodPos)
      const obj = brain.targetObj;
      if (!obj) { brain.endsAt = now; break; }
      const targetX = obj.x;
      const foodDist = Math.abs(sc.x - targetX);

      if (foodDist > 50) {
        // Move toward food at moderate speed
        const laziness2 = slime.genome?.laziness ?? 0.5;
        moveToward(slime, brain, targetX, (0.55 - laziness2 * 0.2) * energy);
      } else {
        brake(brain, slime);
        // Arrived at berry bush: switch to eat_berry if there are berries
        if (obj.type === 'berry_bush' && obj.berryCount > 0) {
          startBehavior(brain, 'eat_berry', null, now, obj);
        } else {
          // Nothing to eat, go wander
          brain.endsAt = now;
        }
      }
      keepAction(slime, 'observe', 0.6 + clamp01(1 - foodDist / 200) * 0.3);
      break;
    }

    case 'eat_berry': {
      const obj = brain.targetObj;
      if (!obj || obj.type !== 'berry_bush' || obj.berryCount <= 0) {
        brain.endsAt = now; break;
      }
      brake(brain, slime);
      if (sc.x !== obj.x) slime.facing = Math.sign(obj.x - sc.x);

      // Eat one berry at the START of the behavior (one-shot)
      if (!brain._ateThisBehavior) {
        brain._ateThisBehavior = true;
        obj.berryCount = Math.max(0, obj.berryCount - 1);
        obj._lastEatenAt = now;

        const diet  = slime.genome?.dietType || 'omnivore';
        const bType = obj.berryType || 'red';
        _applyFoodGain(slime, brain, 'berry', bType, diet, now);

        // Trigger an eating speech bubble immediately
        brain._pendingBubble = { emotion: 'eating' };
        brain._eatJiggleStart = now; // start jiggle timer
      }

      // ── Eating jiggle: vigorous body wiggle for 1.8s after eating starts ──
      // Rapid side-to-side oscillation + slight vertical bounce gives the
      // illusion of enthusiastic chomping.
      const jiggleDuration = 1800;
      const jiggleAge = now - (brain._eatJiggleStart || now);
      const jiggling = jiggleAge < jiggleDuration;

      if (jiggling) {
        const fade    = 1 - jiggleAge / jiggleDuration;          // 1→0 over duration
        const swayAmt = 4.5 * fade;                               // horizontal jiggle
        const sway    = Math.sin(now * 0.018 + brain.seed * 6) * swayAmt;
        const bounce  = Math.abs(Math.sin(now * 0.022 + brain.seed * 3)) * 2.5 * fade;
        const saved   = slime.moveAcceleration;
        slime.moveAcceleration = saved * 0.06;
        slime.applyHorizontalInput(Math.sign(sway) || 1);
        slime.moveAcceleration = saved;
        // Tiny upward pushes to simulate bounce (if vertical API available)
        if (bounce > 1.8 && typeof slime.applyVerticalInput === 'function') {
          slime.applyVerticalInput(-bounce * 0.08);
        }
      } else {
        // Calm gentle sway once jiggle finishes
        const sway = Math.sin(now * 0.004 + brain.seed * 6) * 2.5;
        if (Math.abs(sway) > 1.2) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.04;
          slime.applyHorizontalInput(Math.sign(sway));
          slime.moveAcceleration = saved;
        }
      }

      keepAction(slime, 'study', 0.75);
      break;
    }

    case 'hunt_bird': {
      // Carnivore/omnivore hunts a landed bird stealthily, then jumps on it
      const obj = brain.targetObj;
      if (!obj || obj.type !== 'bird' || obj.state !== 'landed') {
        brain.endsAt = now; break;
      }
      const birdDist = Math.hypot(sc.x - obj.x, sc.y - (obj.y || world.groundY));

      if (birdDist > 120) {
        // Approach slowly (stealth) — speed capped to avoid startling
        moveToward(slime, brain, obj.x, 0.28 * energy);
        keepAction(slime, 'observe', 0.55);
      } else if (birdDist > 50) {
        // Creep very slowly
        moveToward(slime, brain, obj.x, 0.15 * energy);
        keepAction(slime, 'observe', 0.65);
      } else {
        // Close enough — JUMP!
        if (now - brain._huntJumpAt > 1200) {
          brain._huntJumpAt = now;
          const agi = sigmoid(s.agility || 50);
          tryJump(slime, brain, now, 1.0 + agi * 0.5);

          // Check if bird is still there and not startled
          if (obj.state === 'landed') {
            const roll = Math.random();
            const captureChance = 0.35 + agi * 0.45; // 35-80% based on agility
            if (roll < captureChance) {
              // SUCCESS: bird captured
              obj.state = 'captured';
              obj._capturedAt = now;
              const diet = slime.genome?.dietType || 'omnivore';
              _applyFoodGain(slime, brain, 'bird', 'meat', diet, now);
              slime.triggerAction('attack', 800, 1.1);
              brain.logInteraction('hunt_bird', null, 'Oiseau capturé !');
            } else {
              // FAIL: bird startled and flies away
              obj.state = 'startled';
              obj._startledAt = now;
              slime.triggerAction('question', 500, 0.8);
              brain.logInteraction('hunt_bird', null, "L'oiseau s'est envolé...");
            }
            brain.endsAt = now + 500; // end behavior
          }
        }
        brake(brain, slime);
      }
      break;
    }

    case 'communicate': {
      // Share a known food position with a nearby hungry slime
      if (!tc) break;
      brake(brain, slime);
      faceTo(slime, target);

      if (!brain._communicatedThisBehavior) {
        brain._communicatedThisBehavior = true;
        const ob = target?._prairieBrain;
        if (ob) {
          // Share own food knowledge or last eaten position
          const sharedPos = brain.knownFoodPos || brain._lastFoodPos;
          if (sharedPos) {
            ob.knownFoodPos = { ...sharedPos };
            ob.logInteraction('communicate', brain.selfId, 'Position de nourriture reçue');
          }
          brain.addBias(brain.targetId, 0.04);
        }
        brain.logInteraction('communicate', brain.targetId, 'Partage la position d\'une source de nourriture');
      }
      keepAction(slime, 'question', 0.7);
      break;
    }

    case 'falcon_dive': {
      // Gaseous instable dive-bomb: ascend → dive → massive impact
      if (!tc) { startBehavior(brain, 'wander', null, now); break; }
      const elapsed      = now - brain.startedAt;
      const ascendDur    = 1600; // 1.6s rising phase
      const ferBoost     = 0.7 + sigmoid(s.ferocity || 50) * 0.8;

      if (elapsed < ascendDur) {
        // ── Phase 1: ASCEND — hover higher above target ──
        brain._falconPhase = 'ascend';
        const driftDir = Math.sign(tc.x - sc.x) || 1;
        // Apply gentle upward impulse each tick to gain altitude
        applyKnockbackToSlime(slime, driftDir * 0.6, -1.4);
        slime.facing = driftDir;
      } else {
        // ── Phase 2: DIVE — rocket toward target ──
        brain._falconPhase = 'dive';
        const kDir = Math.sign(tc.x - sc.x) || slime.facing;

        if (dist > 35) {
          // Strong horizontal + downward dive
          applyKnockbackToSlime(slime, kDir * 3.2, 3.0);
          slime.facing = kDir;
        } else {
          // ── IMPACT: send target flying ──
          applyKnockbackToSlime(target, kDir * (8 + ferBoost * 3), -5);
          target.triggerAction('hurt', 1400, 1.3);
          slime.triggerAction('attack', 700, 1.1);
          const ob = target?._prairieBrain;
          if (ob) {
            ob.addBias(brain.selfId, -0.12);
            startBehavior(ob, 'recoil', brain.selfId, now);
          }
          brain.logInteraction('falcon_dive', brain.targetId, 'Piqué de faucon !');
          applyFightStatChanges(slime, brain, true, brain.targetId, getSlimeName(target));
          if (ob) applyFightStatChanges(target, ob, false, brain.selfId, getSlimeName(slime));
          brain.endsAt = now + 200;  // end soon
        }
      }
      keepAction(slime, brain._falconPhase === 'dive' ? 'attack' : 'observe',
        brain._falconPhase === 'dive' ? 1.1 : 0.6);
      break;
    }

    // ═══ BENCH ═══

    case 'sit_bench': {
      const obj = brain.targetObj;
      if (!obj || obj.type !== 'bench') { startBehavior(brain, 'wander', null, now); break; }

      const elapsed = now - brain.startedAt;
      const benchDist = Math.abs(sc.x - obj.x);

      // Register this slime as a sitter (use obj._sitters array)
      if (!obj._sitters) obj._sitters = new Set();
      if (!obj._sitters.has(brain.selfId)) {
        if (obj._sitters.size >= 2) {
          // Bench full, pick another activity
          startBehavior(brain, 'wander', null, now);
          break;
        }
        obj._sitters.add(brain.selfId);
        obj._sitterCount = obj._sitters.size;
      }

      if (benchDist > 40) {
        moveToward(slime, brain, obj.x + (obj._sitters.size === 2 && [...obj._sitters][0] === brain.selfId ? -22 : 22), 0.35 * energy);
      } else {
        brake(brain, slime);
        // Gentle happy sway
        const sway = Math.sin(now * 0.0015 + brain.seed * 8) * 3;
        if (Math.abs(sway) > 1.5) {
          const saved = slime.moveAcceleration;
          slime.moveAcceleration = saved * 0.04;
          slime.applyHorizontalInput(Math.sign(sway));
          slime.moveAcceleration = saved;
        }
        // If sharing bench with a partner, generate warm bias
        if (obj._sitters.size === 2 && Math.random() < 0.006) {
          for (const sid of obj._sitters) {
            if (sid !== brain.selfId) {
              brain.addBias(sid, 0.04);
              const partnerEntry = others.find(e => e.id === sid);
              if (partnerEntry?.slime?._prairieBrain)
                partnerEntry.slime._prairieBrain.addBias(brain.selfId, 0.03);
            }
          }
        }
        // Occasionally play a chime for bench harmony
        if (elapsed > 2000 && Math.random() < 0.003)
          SlimeSoundEngine.playGroupChime(obj._sitters.size);
      }
      keepAction(slime, 'observe', 0.75 + clamp01(elapsed / 4000) * 0.25);
      break;
    }

    case 'eject_bench': {
      const obj = brain.targetObj;
      if (!obj || obj.type !== 'bench' || !obj._sitters || obj._sitters.size === 0) {
        startBehavior(brain, 'wander', null, now); break;
      }
      const elapsed = now - brain.startedAt;
      const benchDist = Math.abs(sc.x - obj.x);

      if (benchDist > 55) {
        moveToward(slime, brain, obj.x, 1.0 * energy);
      } else if (elapsed < 600) {
        // SLAM into bench — big knockback to all sitters
        brain._pendingBubble = { emotion: 'angry' };
        SlimeSoundEngine.playBump(slime);
        for (const sid of [...(obj._sitters || [])]) {
          const sitterEntry = others.find(e => e.id === sid);
          if (!sitterEntry) continue;
          const sitter = sitterEntry.slime;
          const sDir = Math.sign(getCenter(sitter).x - sc.x) || (Math.random() > 0.5 ? 1 : -1);
          applyKnockbackToSlime(sitter, sDir * 10, -6);
          sitter.triggerAction('hurt', 800, 1.2);
          const sb = sitter._prairieBrain;
          if (sb) {
            sb._pendingBubble = { emotion: 'scared' };
            sb.addBias(brain.selfId, -0.12);
            // Force sitter off bench
            if (obj._sitters) obj._sitters.delete(sid);
            obj._sitterCount = obj._sitters?.size || 0;
            startBehavior(sb, 'recoil', brain.selfId, now);
          }
        }
        // Aggressor sits down triumphantly
        if (!obj._sitters) obj._sitters = new Set();
        obj._sitters.add(brain.selfId);
        obj._sitterCount = obj._sitters.size;
        startBehavior(brain, 'sit_bench', null, now, obj);
      }
      keepAction(slime, 'attack', 1.1);
      break;
    }
  }

  // ── Drive face expressions based on current behavior ──────────────────────
  driveFace(slime, brain.behavior, brain, target, dist, now);
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
    if (now - this._lastTick < getTickMs()) return;
    this._lastTick = now;

    const pObjects = prairieObjects || [];

    // Ensure brains + apply per-frame drive patch once
    for (const { id, slime } of entries) {
      if (!slime._prairieBrain) {
        slime._prairieBrain = new SlimeBrain(id);
        startBehavior(slime._prairieBrain, 'wander', null, now);
        // Patch the prototype once on first brain creation
        ensureAIDrivePatch(Object.getPrototypeOf(slime));
      }
      // Init AI drive fields if missing
      if (slime._aiMoveDir  === undefined) slime._aiMoveDir  = 0;
      if (slime._aiSpeedMul === undefined) slime._aiSpeedMul = 0;
    }

    for (const { id, slime } of entries) {
      const brain = slime._prairieBrain;
      if (brain) brain.decayBias();

      if (slime.draggedNode) {
        // Clear drive while player is dragging — don't fight the input
        slime._aiMoveDir  = 0;
        slime._aiSpeedMul = 0;
        continue;
      }

      // ── Fight resolution: runs when fight_clash expires ──
      if (brain.behavior === 'fight_clash' && brain._fightTargetId && now >= brain.endsAt) {
        const ft = entries.find(e => e.id === brain._fightTargetId);
        if (ft?.slime) {
          resolveFightClash(brain, slime, ft.slime, now);
        } else {
          brain._fightTargetId = null;
          brain._fightScore    = null;
        }
        // If this slime won, resolveFightClash left behavior as fight_clash;
        // fall through so normal chain selection picks wander/idle_look.
        // If this slime lost, startBehavior('recoil') was called inside
        // resolveFightClash and endsAt is in the future — skip chain.
        if (brain.behavior !== 'fight_clash') {
          execBehavior(brain, slime, entries, world, now);
          if (brain.targetId) updateSocialRelationship(brain, slime, entries, now);
          continue;
        }
      }

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
        // Store fight score when entering fight_clash via chain/re-pick
        if (next.name === 'fight_clash' && next.target && !brain._fightTargetId) {
          brain._fightScore    = computeFightScore(slime) + Math.random() * 20;
          brain._fightTargetId = next.target;
          const ft = entries.find(e => e.id === next.target);
          if (ft?.slime?._prairieBrain && !ft.slime._prairieBrain._fightTargetId) {
            ft.slime._prairieBrain._fightScore    = computeFightScore(ft.slime) + Math.random() * 20;
            ft.slime._prairieBrain._fightTargetId = brain.selfId;
            startBehavior(ft.slime._prairieBrain, 'fight_clash', brain.selfId, now);
          }
        }
        // Log behavior transition
        brain.logInteraction(next.name, next.target, next.obj ? next.obj.type : '');
      }

      // Execute
      execBehavior(brain, slime, entries, world, now);

      // ── Reckless chase trigger ─────────────────────────────────────────────
      // A combatant temperament slime sees its prey fleeing/teleporting → refuses to let go.
      // Conditions: combatant, high ferocity, target is fleeing/teleporting, cooldown elapsed.
      if (brain.behavior === 'challenge' || brain.behavior === 'fight_clash') {
        const temperament = getTemperament(slime);
        const ferocity = slime.stats?.ferocity || 50;
        if (temperament === 'combatant' && ferocity > 68
            && brain.targetId
            && now - brain._lastRecklessChaseAt > 12000) {
          const prey = entries.find(e => e.id === brain.targetId)?.slime;
          const preyBrain = prey?._prairieBrain;
          if (preyBrain && (preyBrain.behavior === 'flee'
                         || preyBrain.behavior === 'teleport_flee'
                         || preyBrain.behavior === 'recoil')) {
            brain._lastRecklessChaseAt = now;
            startBehavior(brain, 'reckless_chase', brain.targetId, now);
            brain._pendingBubble = { emotion: 'combat' };
          }
        }
      }

      // Persistent social relationship updates (writes to livingState.relationshipLedger)
      if (brain.targetId) {
        updateSocialRelationship(brain, slime, entries, now);
      }

      // Stat micro-learning (very rare)
      if (brain.targetId && Math.random() < 0.003) {
        const t = entries.find(e => e.id === brain.targetId)?.slime;
        if (t?.stats && slime.stats) {
          const learnMap = {
            observe: 'curiosity', approach: 'curiosity', investigate: 'curiosity',
            follow: 'empathy', bond: 'empathy', romance: 'empathy', calm: 'empathy',
            challenge: 'ferocity', flee: 'stability', recoil: 'stability',
            fight_clash: 'ferocity', reckless_chase: 'ferocity',
            teleport_flee: 'stability',
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

      // ── Hunger tick ────────────────────────────────────────────────────────
      // Every 10 seconds, increase hunger based on laziness gene.
      // Active (laziness=0) → +3/tick, Lazy (laziness=1) → +0.8/tick
      const HUNGER_INTERVAL = 10000;
      if (now - brain._lastHungerTick > HUNGER_INTERVAL) {
        brain._lastHungerTick = now;
        const laziness = slime.genome?.laziness ?? 0.5;
        brain.hunger = Math.min(100, brain.hunger + (0.8 + (1 - laziness) * 2.2));
      }

      // ── Mood transfer (emotional contagion) ────────────────────────────────
      // Slimes within 150px influence each other's emotional state via empathy.
      const slimeCtr = getCenter(slime);
      for (const { id: otherId, slime: other } of entries) {
        if (otherId === brain.selfId) continue;
        const oc = getCenter(other);
        if (Math.hypot(slimeCtr.x - oc.x, slimeCtr.y - oc.y) > 150) continue;
        const ob = other._prairieBrain;
        if (!ob) continue;

        const blendRate = (sigmoid(slime.stats?.empathy || 50) + sigmoid(other.stats?.empathy || 50)) * 0.5 * 0.04;

        // Happiness converges toward each other
        const hA = brain.emotionalState.happiness, hB = ob.emotionalState.happiness;
        brain.emotionalState.happiness = lerp(hA, hB, blendRate);
        ob.emotionalState.happiness    = lerp(hB, hA, blendRate);

        // Fear propagates from a fleeing slime to its neighbors
        const fearingA = brain.behavior === 'flee' || brain.behavior === 'recoil' || brain.behavior === 'teleport_flee';
        const fearingB = ob.behavior   === 'flee' || ob.behavior   === 'recoil' || ob.behavior   === 'teleport_flee';
        if (fearingA) ob.emotionalState.fear = Math.min(1, ob.emotionalState.fear + blendRate * 0.6);
        if (fearingB) brain.emotionalState.fear = Math.min(1, brain.emotionalState.fear + blendRate * 0.6);
        // Fear fades when no threat is sensed
        if (!fearingA) brain.emotionalState.fear = Math.max(0, brain.emotionalState.fear - 0.008);
      }
    }

    // ── Crowd bump — passive body collision when too tightly packed ──
    // Even idle slimes can shoulder-check each other when space is scarce
    if (!this._lastCrowdBump) this._lastCrowdBump = 0;
    if (entries.length >= 2 && now - this._lastCrowdBump > 2800) {
      for (let i = 0; i < entries.length; i++) {
        const ea = entries[i];
        if (ea.slime.draggedNode) continue;
        const ba = ea.slime._prairieBrain;
        if (!ba || now < ba._bumpCooldown) continue;
        // Only bump if the slime is in an agitated state but NOT already in challenge
        const agitated = ['intimidate','fight_clash','reckless_chase'].includes(ba.behavior);
        if (!agitated) continue;
        const ca = getCenter(ea.slime);
        for (let j = 0; j < entries.length; j++) {
          if (i === j) continue;
          const eb = entries[j];
          if (eb.slime.draggedNode) continue;
          const cb = getCenter(eb.slime);
          const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
          if (d < 52 && Math.random() < 0.08) {
            this._lastCrowdBump = now;
            ba._bumpCooldown = now + 4000;
            const dir = Math.sign(cb.x - ca.x) || 1;
            applyKnockbackToSlime(eb.slime, dir * 7, -4);
            eb.slime.triggerAction('hurt', 500, 1.0);
            const bb = eb.slime._prairieBrain;
            if (bb) bb._pendingBubble = { emotion: 'pain' };
            SlimeSoundEngine.playBump(ea.slime);
            break;
          }
        }
      }
    }
  }

  removeSlime(id) {
    // Drive fields will be GC'd with the slime object — nothing to do.
    // Per-slime Maps (_passiveBlockCooldowns, _obstacleCooldowns) live on
    // the brain which is also GC'd, so no explicit cleanup needed.
  }

  handleEnvironmentInteractions(slime, objects, now) {
    const brain = slime._prairieBrain;
    
    slime._platformFloor = null;
    const center = getCenter(slime);
    const radius = slime.baseRadius || 30;

    for (const obj of objects) {
      if (!obj.interactive && obj.type !== 'terrarium') continue;

      // ── Terrarium House (Solid hitboxes) ──
      if (obj.type === 'terrarium') {
        const floorY = obj.y - obj.h;
        const hutLeft = obj.x;
        const hutRight = obj.x + obj.w;
        const roofY = floorY - obj.houseH;

        // On applique la collision si le centre du slime est dans le périmètre de la maison
        if (center.x > hutLeft - 20 && center.x < hutRight + 20 && center.y < floorY + 20 && center.y > roofY - 20) {
          slime._platformFloor = floorY;
          for (const node of slime.nodes) {
            // Clamping horizontal (Murs)
            if (node.x < hutLeft) {
              node.x = hutLeft;
              node.oldX = Math.min(node.oldX, node.x);
            } else if (node.x > hutRight) {
              node.x = hutRight;
              node.oldX = Math.max(node.oldX, node.x);
            }
            // Clamping vertical (Sol et Toit)
            if (node.y > floorY) {
              node.y = floorY;
              node.oldY = Math.max(node.oldY, node.y);
            } else if (node.y < roofY) {
              node.y = roofY;
              node.oldY = Math.min(node.oldY, node.y);
            }
          }
        }
        continue;
      }

      const dx = center.x - obj.x;
      const dy = center.y - (obj.y || 0);
      const dist = Math.hypot(dx, dy);

      // ── Trampoline Logic (Trigger only if falling or pushed) ──
      if (obj.type === 'trampoline' && Math.abs(dx) < obj.w * 0.5 + 20 && dy > -radius - 20 && dy < 10) {
        const vel = slime.getAverageVelocity?.() || { y: 0 };
        if (vel.y > 0.8 || slime.draggedNode) {
          applyKnockbackToSlime(slime, 0, -18);
          slime.triggerAction('jump', 400, 1.2);
          SlimeSoundEngine.playTrampoline();
        }
      }

      // ── Jump Ball Logic (Downward woosh) ──
      if (obj.type === 'jump_ball' && dist < radius + obj.r) {
        applyKnockbackToSlime(slime, 0, 26);
        slime.triggerAction('hurt', 600, 1.3);
        SlimeSoundEngine.playMagicWoosh();
      }

      // ── Teleporter Logic ──
      if (brain && obj.type === 'teleporter' && dist < 50 && now > brain._teleportCooldown) {
        const vel = slime.getAverageVelocity?.() || { y: 0 };
        if (vel.y > 1.5 || slime.draggedNode) {
          brain._teleportCooldown = now + 1500;
          teleportSlime(slime, obj.targetX, obj.targetY);
          SlimeSoundEngine.playTeleport();
          slime.triggerAction('observe', 500, 1.0);
        }
      }
    }
  }

  reset() { this._lastTick = 0; }

  /**
   * Called by prairie-feature when the player drops a slime near an interactive object.
   * Immediately starts the appropriate behavior toward that object, bypassing the
   * weight picker — as if the slime "noticed" the object the moment it lands.
   *
   * @param {string} slimeId  canonical ID of the slime
   * @param {object} slime    the live Slime instance
   * @param {object} obj      the nearest prairieObject (must be interactive)
   */
  nudgeTowardObject(slimeId, slime, obj) {
    const brain = slime._prairieBrain;
    if (!brain) return;
    // Don't interrupt active social or combat behaviors
    const passiveBehaviors = ['wander','idle_look','explore_jump','sniff_object',
      'play_ball','sit_stump','seek_food','eat_berry','sit_bench'];
    if (!passiveBehaviors.includes(brain.behavior) && brain.behavior !== null) return;

    const now = performance.now();
    // Map object type → behavior
    const TYPE_TO_BEHAVIOR = {
      ball:        'play_ball',
      stump:       'sit_stump',
      bench:       'sit_bench',
      berry_bush:  'seek_food',
      flower:      'sniff_object',
      mushroom:    'sniff_object',
      puddle:      'sniff_object',
      rock:        'sniff_object',
    };
    const behaviorName = TYPE_TO_BEHAVIOR[obj.type];
    if (!behaviorName) return;

    // Respect overdose: check recent behaviors
    const recent = brain.recentBehaviors.filter(b => b === behaviorName).length;
    if (recent >= 3) return; // already did this a lot — skip

    startBehavior(brain, behaviorName, null, now, obj);
    brain.logInteraction(behaviorName, null, `nudged by player near ${obj.type}`);
  }
}
