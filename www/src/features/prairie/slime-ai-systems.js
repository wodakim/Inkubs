import { clamp01, lerp, randRange, sigmoid, getCenter, getSlimeName } from './slime-ai-utils.js';
import { recordSlimeEvent, recordObjectInteraction, getObjectMemory } from '../../vendor/inku-slime-v3/engine/lifecycle/livingState.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
//  MOVEMENT & PHYSICS PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

export function applyKnockbackToSlime(slime, vx, vy) {
    if (!slime?.nodes?.length) return;
    for (const node of slime.nodes) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
        node.oldX = node.x - vx;
        node.oldY = node.y - vy;
    }
}

export function teleportSlime(slime, tx, ty) {
    const c = getCenter(slime);
    const dx = tx - c.x;
    const dy = ty - c.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    for (const node of slime.nodes) {
        node.x += dx;
        node.y += dy;
        node.oldX += dx;
        node.oldY += dy;
    }
}

export function statSpeed(slime) {
    const s = slime.stats || {};
    const agi = sigmoid(s.agility || 50);
    const fer = sigmoid(s.ferocity || 50);
    const vit = sigmoid(s.vitality || 50);
    return 0.7 + agi * 0.9 + fer * 0.35 + vit * 0.25;
}

export function moveToward(slime, brain, tx, speedMul) {
    const cx = getCenter(slime).x;
    const dx = tx - cx;
    if (Math.abs(dx) < 5) {
        brain.intentDir *= 0.7;
        slime._aiMoveDir = 0;
        slime._aiSpeedMul = 0;
        return;
    }
    const dir = Math.sign(dx);
    brain.intentDir = lerp(brain.intentDir, dir, 0.25);
    if (Math.abs(brain.intentDir) > 0.04) {
        slime.facing = Math.sign(brain.intentDir);
        const ss = statSpeed(slime);
        slime._aiMoveDir = Math.sign(brain.intentDir);
        slime._aiSpeedMul = Math.max(0.4, speedMul) * ss;
    }
}

export function moveAway(slime, brain, fromX, speedMul, world) {
    const cx = getCenter(slime).x;
    const tx = Math.max(world.left + 80, Math.min(world.right - 80, cx + (cx - fromX) * 2.5));
    moveToward(slime, brain, tx, speedMul);
}

export function clearAIDrive(slime) {
    slime._aiMoveDir = 0;
    slime._aiSpeedMul = 0;
}

export function brake(brain, slime) {
    brain.intentDir *= 0.55;
    if (slime) {
        slime._aiMoveDir = 0;
        slime._aiSpeedMul = 0;
    }
}

export function faceTo(slime, target) {
    const sc = getCenter(slime), tc = getCenter(target);
    const dx = tc.x - sc.x;
    if (Math.abs(dx) > 3) slime.facing = Math.sign(dx);
}

export function tryJump(slime, brain, now, forceMul) {
    if (now - brain.lastJumpAt < 400) return;
    const gr = slime.getGroundedRatio?.() ?? 0;
    if (gr > 0.2 && slime.jumpCooldownFrames <= 0) {
        const s = slime.stats || {};
        const agi = sigmoid(s.agility || 50);
        const vit = sigmoid(s.vitality || 50);
        const heightMul = (0.85 + agi * 0.45 + vit * 0.3) * (forceMul || 1);
        const savedJump = slime.jumpImpulse;
        
        slime.jumpImpulse = savedJump * heightMul;
        slime.tryJump();
        SlimeSoundEngine.playJump(heightMul * 8, slime);
        
        slime.jumpImpulse = savedJump;
        brain.lastJumpAt = now;
    }
}

export function keepAction(slime, action, intensity) {
    const now = performance.now();
    if (slime.actionState !== action || now > slime.actionUntil - 300) {
        slime.actionState = action;
        slime.actionUntil = now + 800;
        slime.actionIntensity = Math.min(1.3, Math.max(intensity, slime.actionIntensity * 0.7 + intensity * 0.3));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SOCIAL & TEMPERAMENT SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════

export function getOrInitAffinity(slime, targetId, targetName) {
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

export function writeRelMemory(slime, targetId, targetName, eventKind, note) {
    const rel = getOrInitAffinity(slime, targetId, targetName);
    if (!rel) return;
    rel.significantEvents.push({ kind: eventKind, at: new Date().toISOString(), note });
    if (rel.significantEvents.length > 10) rel.significantEvents.shift();
    recordSlimeEvent(slime, 'social_' + eventKind, {
        targetId, targetName, note, relType: rel.type, bias: rel.bias,
    }, { importance: 'significant', persistLongTerm: true });
}

export function updateSocialRelationship(brain, slime, entries, now) {
    if (!brain.targetId || !slime?.livingState) return;
    const targetEntry = entries.find(e => e.id === brain.targetId);
    if (!targetEntry?.slime) return;
    const targetSlime = targetEntry.slime;
    const targetName = getSlimeName(targetSlime);
    const selfName = getSlimeName(slime);

    if (!brain._relTrack) brain._relTrack = new Map();
    let track = brain._relTrack.get(brain.targetId);
    if (!track) {
        track = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 };
        brain._relTrack.set(brain.targetId, track);
    }

    const rel = getOrInitAffinity(slime, brain.targetId, targetName);
    if (!rel) return;

    if (rel.interactionCount === 0) {
        rel.interactionCount = 1;
        rel.lastSeenAt = new Date().toISOString();
        rel.bias = brain.getBias(brain.targetId);
        writeRelMemory(slime, brain.targetId, targetName, 'first_contact', `Premier contact avec ${targetName}`);
        if (targetSlime.livingState) {
            const tRel = getOrInitAffinity(targetSlime, brain.selfId, selfName);
            if (tRel && tRel.interactionCount === 0) {
                tRel.interactionCount = 1;
                tRel.lastSeenAt = new Date().toISOString();
                writeRelMemory(targetSlime, brain.selfId, selfName, 'first_contact', `Premier contact avec ${selfName}`);
            }
        }
        return;
    }

    rel.bias = brain.getBias(brain.targetId);
    rel.lastSeenAt = new Date().toISOString();
    rel.displayName = targetName;
    if (now - track.lastThresholdCheck < 2000) return;
    track.lastThresholdCheck = now;

    const currentBias = rel.bias;

    if (currentBias >= 0.80)       rel.type = 'lover';
    else if (currentBias >= 0.55)  rel.type = 'friend';
    else if (currentBias >= 0.25)  rel.type = 'friendly';
    else if (currentBias <= -0.55) rel.type = 'rival';
    else if (currentBias <= -0.25) rel.type = 'hostile';
    else                           rel.type = 'neutral';

    const hasFightMem = rel.significantEvents?.some(e => e.kind === 'fight_won' || e.kind === 'fight_lost');
    if (hasFightMem && (slime.stats?.ferocity || 50) > 62 && (targetSlime.stats?.ferocity || 50) > 62 && currentBias > -0.25 && currentBias < 0.55) {
        rel.type = 'combat_partner';
    }
    if (!rel.crossedCombatPartner && rel.type === 'combat_partner') {
        rel.crossedCombatPartner = true;
        writeRelMemory(slime, brain.targetId, targetName, 'combat_partner', `Partenaire de combat avec ${targetName}`);
    }

    const rl = slime.livingState.relationshipLedger;
    const affs = Object.values(rl.affinities);
    rl.socialFlags.friendships = affs.filter(r => r.type === 'friend' || r.type === 'friendly' || r.type === 'lover').length;
    rl.socialFlags.rivalries   = affs.filter(r => r.type === 'rival'  || r.type === 'hostile').length;
    rl.socialFlags.bonded      = affs.some(r => r.type === 'friend' || r.type === 'lover');

    if (!rel.crossedFriendly && currentBias >= 0.25) { rel.crossedFriendly = true; writeRelMemory(slime, brain.targetId, targetName, 'friendly_bond', `Amitié naissante avec ${targetName}`); }
    if (!rel.crossedFriend && currentBias >= 0.55) { rel.crossedFriend = true; writeRelMemory(slime, brain.targetId, targetName, 'true_friend', `Véritable ami de ${targetName}`); }
    if (!rel.crossedDeepBond && currentBias >= 0.80) { rel.crossedDeepBond = true; writeRelMemory(slime, brain.targetId, targetName, 'deep_bond', `Lien profond avec ${targetName}`); }
    if (!rel.crossedHostile && currentBias <= -0.25) { rel.crossedHostile = true; writeRelMemory(slime, brain.targetId, targetName, 'hostility', `Hostilité envers ${targetName}`); }
    if (!rel.crossedRival && currentBias <= -0.55) { rel.crossedRival = true; writeRelMemory(slime, brain.targetId, targetName, 'rivalry', `Rivalité établie avec ${targetName}`); }

    if (brain.behavior === 'romance' && currentBias >= 0.25 && now - track.lastRomanceMem > 60000) {
        track.lastRomanceMem = now;
        writeRelMemory(slime, brain.targetId, targetName, 'romantic_moment', `Moment romantique avec ${targetName}`);
    }
}

export function writeConflictMemoryPair(attacker, attackerId, attackerName, victim, victimId, victimName, now) {
    const ab = attacker._prairieBrain;
    if (ab && attacker.livingState) {
        if (!ab._relTrack) ab._relTrack = new Map();
        let aTrack = ab._relTrack.get(victimId);
        if (!aTrack) { aTrack = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 }; ab._relTrack.set(victimId, aTrack); }
        if (now - aTrack.lastConflictMem > 30000) {
            aTrack.lastConflictMem = now;
            writeRelMemory(attacker, victimId, victimName, 'conflict', `Confrontation avec ${victimName}`);
        }
    }
    const vb = victim._prairieBrain;
    if (vb && victim.livingState) {
        if (!vb._relTrack) vb._relTrack = new Map();
        let vTrack = vb._relTrack.get(attackerId);
        if (!vTrack) { vTrack = { lastThresholdCheck: 0, lastRomanceMem: 0, lastConflictMem: 0 }; vb._relTrack.set(attackerId, vTrack); }
        if (now - vTrack.lastConflictMem > 30000) {
            vTrack.lastConflictMem = now;
            writeRelMemory(victim, attackerId, attackerName, 'conflict_victim', `Confronté par ${attackerName}`);
        }
    }
}

export function getTemperament(slime) {
    const s = slime?.stats || {};
    const prog = slime?.livingState?.progressionLedger;
    const wins = prog?.combatWins || 0;
    const losses = prog?.combatLosses || 0;

    let tag = 'neutral';
    if ((s.ferocity || 50) >= 68 && wins >= 2) tag = 'combatant';
    else if ((s.stability || 50) <= 35 && losses >= 2) tag = 'fearful';
    else if ((s.stability || 50) >= 65 && losses >= 1) tag = 'resilient';
    else if ((s.empathy || 50) >= 65 && (s.ferocity || 50) <= 45) tag = 'pacifist';

    if (prog) prog.temperament = tag;
    return tag;
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMBAT & FOOD SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════

export function computeFightScore(slime) {
    const s = slime.stats || {};
    return (s.ferocity || 50) * 0.5 + (s.vitality || 50) * 0.3 + (s.stability || 50) * 0.2;
}

export function applyFightStatChanges(slime, brain, won, opponentId, opponentName) {
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
        if (s.ferocity > 68) brain.addBias(opponentId, 0.05);
        writeRelMemory(slime, opponentId, opponentName, 'fight_won', `A vaincu ${opponentName} au combat`);
        const progW = slime?.livingState?.progressionLedger;
        if (progW) progW.combatWins = (progW.combatWins || 0) + 1;
    } else {
        const vitalityLoss = randRange(2, 5);
        const stabilityLoss = randRange(0.5, 3);
        const oldVit = s.vitality;
        const oldStab = s.stability;
        s.vitality = Math.max(1, s.vitality - vitalityLoss);
        s.stability = Math.max(1, s.stability - stabilityLoss);
        brain.logStatChange('vitality', oldVit, s.vitality, 'fight_lost');
        brain.logStatChange('stability', oldStab, s.stability, 'fight_lost');
        brain.addBias(opponentId, -0.12);
        writeRelMemory(slime, opponentId, opponentName, 'fight_lost', `A été vaincu par ${opponentName}`);
        const progL = slime?.livingState?.progressionLedger;
        if (progL) progL.combatLosses = (progL.combatLosses || 0) + 1;
        if (oldStab > 55) {
            s.stability = Math.min(99, s.stability + 0.5);
        }
    }
}

export function applyFoodGain(slime, brain, foodCategory, subType, diet, now) {
    if (!slime?.stats) return;
    const s = slime.stats;
    const objectKey = foodCategory === 'berry' ? `berry_${subType}` : 'bird_meat';

    brain.hunger = Math.max(0, brain.hunger - 40 - Math.random() * 20);

    if (foodCategory === 'berry') {
        if (diet === 'herbivore') {
            const agiGain = 1.5 + Math.random() * 2.5;
            const stabGain = 0.5 + Math.random() * 1.5;
            const oldAgi = s.agility;
            const oldStab = s.stability;
            s.agility = Math.min(99, s.agility + agiGain);
            s.stability = Math.min(99, s.stability + stabGain);
            brain.logStatChange('agility', oldAgi, s.agility, 'ate_berry');
            brain.logStatChange('stability', oldStab, s.stability, 'ate_berry');
            recordObjectInteraction(slime, objectKey, +0.4);
            brain.logInteraction('eat_berry', null, `Délicieuses baies ! (+Agilité)`);
        } else if (diet === 'omnivore') {
            const agiGain = 0.5 + Math.random() * 1.5;
            const oldAgi = s.agility;
            s.agility = Math.min(99, s.agility + agiGain);
            brain.logStatChange('agility', oldAgi, s.agility, 'ate_berry');
            recordObjectInteraction(slime, objectKey, +0.15);
            brain.logInteraction('eat_berry', null, `Baies mangées. (+Agilité)`);
        } else {
            const agiLoss = 0.5 + Math.random() * 1.0;
            const stabLoss = 0.3 + Math.random() * 0.7;
            const oldAgi = s.agility;
            const oldStab = s.stability;
            s.agility = Math.max(1, s.agility - agiLoss);
            s.stability = Math.max(1, s.stability - stabLoss);
            brain.logStatChange('agility', oldAgi, s.agility, 'ate_wrong_food');
            brain.logStatChange('stability', oldStab, s.stability, 'ate_wrong_food');
            recordObjectInteraction(slime, objectKey, -0.6);
            brain.logInteraction('eat_berry', null, `Beurk... Ces baies me rendent malade.`);
            slime.triggerAction('hurt', 600, 0.8);
        }
    } else if (foodCategory === 'bird') {
        if (diet === 'carnivore') {
            const ferGain = 1.5 + Math.random() * 2.5;
            const vitGain = 0.8 + Math.random() * 2.0;
            const empGain = 0.5 + Math.random() * 1.5;
            const oldFer = s.ferocity;
            const oldVit = s.vitality;
            const oldEmp = s.empathy;
            s.ferocity = Math.min(99, s.ferocity + ferGain);
            s.vitality = Math.min(99, s.vitality + vitGain);
            s.empathy = Math.min(99, s.empathy + empGain);
            brain.logStatChange('ferocity', oldFer, s.ferocity, 'ate_bird');
            brain.logStatChange('vitality', oldVit, s.vitality, 'ate_bird');
            brain.logStatChange('empathy', oldEmp, s.empathy, 'ate_bird');
            recordObjectInteraction(slime, objectKey, +0.5);
            brain.logInteraction('hunt_bird', null, `Festin ! (+Férocité, +Vitalité)`);
        } else if (diet === 'omnivore') {
            const ferGain = 0.5 + Math.random() * 1.5;
            const vitGain = 0.3 + Math.random() * 1.0;
            const oldFer = s.ferocity;
            const oldVit = s.vitality;
            s.ferocity = Math.min(99, s.ferocity + ferGain);
            s.vitality = Math.min(99, s.vitality + vitGain);
            brain.logStatChange('ferocity', oldFer, s.ferocity, 'ate_bird');
            brain.logStatChange('vitality', oldVit, s.vitality, 'ate_bird');
            recordObjectInteraction(slime, objectKey, +0.2);
            brain.logInteraction('hunt_bird', null, `Oiseau mangé. (+Férocité)`);
        }
    }

    brain._lastFoodPos = { x: getCenter(slime).x, objectType: objectKey };
}