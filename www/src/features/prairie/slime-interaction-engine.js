import { getPerformanceTier } from '../../utils/device-performance-profile.js';
import { SlimeSoundEngine } from './slime-sound-engine.js';
import { SlimeBrain, lerp, getCenter, getSlimeName } from './slime-ai-utils.js';
import { applyKnockbackToSlime, teleportSlime, updateSocialRelationship } from './slime-ai-systems.js';
import { getChains, startBehavior, pickBehavior, execBehavior, resolveFightClash } from './slime-ai-behaviors.js';

let _patchesApplied = false;
function ensureAIDrivePatch(SlimeProto) {
    if (_patchesApplied || !SlimeProto?.applyKeyboardControls) return;
    _patchesApplied = true;

    const origKeyboard = SlimeProto.applyKeyboardControls;
    SlimeProto.applyKeyboardControls = function patchedKeyboard() {
        origKeyboard.call(this);
        if (this.draggedNode) return;
        const dir = this._aiMoveDir;
        if (!dir) return;
        const saved = this.moveAcceleration;
        const savedMax = this.maxMoveSpeed;
        this.moveAcceleration = saved * (this._aiSpeedMul || 1);
        this.maxMoveSpeed = savedMax * (this._aiSpeedMul || 1);
        this.applyHorizontalInput(dir);
        this.moveAcceleration = saved;
        this.maxMoveSpeed = savedMax;
    };

    const origAnim = SlimeProto.updateAnimationController;
    SlimeProto.updateAnimationController = function patchedAnim() {
        origAnim.call(this);

        if (this.locomotionState === 'move' && this.renderPose) {
            const p = this.renderPose;
            p.scaleX = 1 + (p.scaleX - 1) * 0.4;
            p.scaleY = 1 + (p.scaleY - 1) * 0.5;
            p.skewX = 0;
            p.roll = 0;
        }

        if (this.faceAnimation) {
            const avgV = this.getAverageVelocity?.();
            const speedX = avgV ? avgV.x : 0;
            const absSpeed = Math.abs(speedX);
            const drive = Math.min(1, absSpeed / Math.max(1, this.maxMoveSpeed || 4));
            const f = this.faceAnimation;
            const isMoving = this.locomotionState === 'move' && drive > 0.05;

            const ov = this._aiFaceOverride;
            if (!ov || ov.lookBiasX == null) {
                const targetInertiaX = isMoving ? -Math.sign(speedX) * drive * 8 : 0;
                f.lookBiasX = (f.lookBiasX || 0) + (targetInertiaX - (f.lookBiasX || 0)) * (isMoving ? 0.09 : 0.20);
            }
            const targetBiasY = isMoving ? -drive * 4.5 : 0;
            f.lookBiasY = (f.lookBiasY || 0) + (targetBiasY - (f.lookBiasY || 0)) * 0.18;
        }

        const ov = this._aiFaceOverride;
        if (!ov || !this.faceAnimation) return;
        const f = this.faceAnimation;
        const T = 0.18;
        
        if (ov.eyeScaleX != null) f.eyeScaleX = f.eyeScaleX + (ov.eyeScaleX - f.eyeScaleX) * T;
        if (ov.eyeScaleY != null) f.eyeScaleY = f.eyeScaleY + (ov.eyeScaleY - f.eyeScaleY) * T;
        if (ov.browLift != null) f.browLift = f.browLift + (ov.browLift - f.browLift) * T;
        if (ov.browTilt != null) f.browTilt = f.browTilt + (ov.browTilt - f.browTilt) * T;
        if (ov.lookBiasX != null) f.lookBiasX = f.lookBiasX + (ov.lookBiasX - f.lookBiasX) * T;
        if (ov.lookBiasY != null) f.lookBiasY = f.lookBiasY + (ov.lookBiasY - f.lookBiasY) * T;
        if (ov.mouthScaleX != null) f.mouthScaleX = f.mouthScaleX + (ov.mouthScaleX - f.mouthScaleX) * T;
        
        if (typeof ov.overrideEyeStyle === 'string') f.overrideEyeStyle = ov.overrideEyeStyle;
        if (typeof ov.overrideMouthStyle === 'string') f.overrideMouthStyle = ov.overrideMouthStyle;
        
        f.eyeScaleX = Math.max(0.7, Math.min(1.28, f.eyeScaleX));
        f.eyeScaleY = Math.max(0.15, Math.min(1.28, f.eyeScaleY));
        f.browLift = Math.max(-0.2, Math.min(0.72, f.browLift));
        f.browTilt = Math.max(-0.1, Math.min(0.8, f.browTilt));
        f.lookBiasX = Math.max(-10, Math.min(10, f.lookBiasX));
        f.lookBiasY = Math.max(-8, Math.min(8, f.lookBiasY));
    };
}

function getTickMs() {
    const tier = getPerformanceTier();
    if (tier === 'low') return 120;
    if (tier === 'medium') return 75;
    return 50;
}

export class SlimeInteractionEngine {
    constructor() {
        this._lastTick = 0;
    }

    tick(entries, world, prairieObjects) {
        const now = performance.now();
        if (now - this._lastTick < getTickMs()) return;
        this._lastTick = now;

        const pObjects = prairieObjects || [];

        for (const { id, slime } of entries) {
            if (!slime._prairieBrain) {
                slime._prairieBrain = new SlimeBrain(id);
                startBehavior(slime._prairieBrain, 'wander', null, now);
                ensureAIDrivePatch(Object.getPrototypeOf(slime));
            }
            if (slime._aiMoveDir === undefined) slime._aiMoveDir = 0;
            if (slime._aiSpeedMul === undefined) slime._aiSpeedMul = 0;
        }

        for (const { id, slime } of entries) {
            const brain = slime._prairieBrain;
            if (brain) brain.decayBias();

            if (slime.draggedNode) {
                slime._aiMoveDir = 0;
                slime._aiSpeedMul = 0;
                continue;
            }

            if (brain.behavior === 'fight_clash' && brain._fightTargetId && now >= brain.endsAt) {
                const ft = entries.find(e => e.id === brain._fightTargetId);
                if (ft?.slime) {
                    resolveFightClash(brain, slime, ft.slime, now);
                } else {
                    brain._fightTargetId = null;
                    brain._fightScore = null;
                }
                if (brain.behavior !== 'fight_clash') {
                    execBehavior(brain, slime, entries, world, now);
                    if (brain.targetId) updateSocialRelationship(brain, slime, entries, now);
                    continue;
                }
            }

            if (now >= brain.endsAt) {
                const chain = getChains()[brain.behavior];
                let next = null;

                if (chain && Math.random() < 0.7) {
                    const opts = chain.map(name => {
                        let w = 0.5;
                        if (brain.targetId && !['wander','idle_look','explore_jump'].includes(name)) {
                            const t = entries.find(e => e.id === brain.targetId);
                            if (!t || t.slime.draggedNode) w = 0.05;
                            else {
                                const d = Math.hypot(getCenter(slime).x - getCenter(t.slime).x, getCenter(slime).y - getCenter(t.slime).y);
                                if (d > 500) w *= 0.2;
                            }
                        }
                        const rc = brain.recentBehaviors.filter(b => b === name).length;
                        w *= Math.max(0.2, 1 - rc * 0.2);
                        return { name, target: brain.targetId, w };
                    });
                    const tw = opts.reduce((s, o) => s + o.w, 0);
                    let r = Math.random() * tw;
                    for (const o of opts) { r -= o.w; if (r <= 0) { next = o; break; } }
                }

                if (!next) {
                    const pick = pickBehavior(brain, slime, entries, world, now, pObjects);
                    next = { name: pick.name, target: pick.target, obj: pick.obj };
                }

                startBehavior(brain, next.name, next.target, now, next.obj);
                
                if (next.name === 'fight_clash' && next.target && !brain._fightTargetId) {
                    brain._fightScore = computeFightScore(slime) + Math.random() * 20;
                    brain._fightTargetId = next.target;
                    const ft = entries.find(e => e.id === next.target);
                    if (ft?.slime?._prairieBrain && !ft.slime._prairieBrain._fightTargetId) {
                        ft.slime._prairieBrain._fightScore = computeFightScore(ft.slime) + Math.random() * 20;
                        ft.slime._prairieBrain._fightTargetId = brain.selfId;
                        startBehavior(ft.slime._prairieBrain, 'fight_clash', brain.selfId, now);
                    }
                }
                brain.logInteraction(next.name, next.target, next.obj ? next.obj.type : '');
            }

            execBehavior(brain, slime, entries, world, now);

            if (brain.behavior === 'challenge' || brain.behavior === 'fight_clash') {
                const ferocity = slime.stats?.ferocity || 50;
                if (ferocity > 68 && brain.targetId && now - brain._lastRecklessChaseAt > 12000) {
                    const prey = entries.find(e => e.id === brain.targetId)?.slime;
                    const preyBrain = prey?._prairieBrain;
                    if (preyBrain && ['flee', 'teleport_flee', 'recoil'].includes(preyBrain.behavior)) {
                        brain._lastRecklessChaseAt = now;
                        startBehavior(brain, 'reckless_chase', brain.targetId, now);
                        brain._pendingBubble = { emotion: 'combat' };
                    }
                }
            }

            if (brain.targetId) updateSocialRelationship(brain, slime, entries, now);

            const HUNGER_INTERVAL = 10000;
            if (now - brain._lastHungerTick > HUNGER_INTERVAL) {
                brain._lastHungerTick = now;
                const laziness = slime.genome?.laziness ?? 0.5;
                brain.hunger = Math.min(100, brain.hunger + (0.8 + (1 - laziness) * 2.2));
            }

            const slimeCtr = getCenter(slime);
            for (const { id: otherId, slime: other } of entries) {
                if (otherId === brain.selfId) continue;
                const oc = getCenter(other);
                if (Math.hypot(slimeCtr.x - oc.x, slimeCtr.y - oc.y) > 150) continue;
                const ob = other._prairieBrain;
                if (!ob) continue;

                const blendRate = (sigmoid(slime.stats?.empathy || 50) + sigmoid(other.stats?.empathy || 50)) * 0.5 * 0.04;

                const hA = brain.emotionalState.happiness, hB = ob.emotionalState.happiness;
                brain.emotionalState.happiness = lerp(hA, hB, blendRate);
                ob.emotionalState.happiness = lerp(hB, hA, blendRate);

                const fearingA = ['flee', 'recoil', 'teleport_flee'].includes(brain.behavior);
                const fearingB = ['flee', 'recoil', 'teleport_flee'].includes(ob.behavior);
                if (fearingA) ob.emotionalState.fear = Math.min(1, ob.emotionalState.fear + blendRate * 0.6);
                if (fearingB) brain.emotionalState.fear = Math.min(1, brain.emotionalState.fear + blendRate * 0.6);
                if (!fearingA) brain.emotionalState.fear = Math.max(0, brain.emotionalState.fear - 0.008);
            }
        }

        if (!this._lastCrowdBump) this._lastCrowdBump = 0;
        if (entries.length >= 2 && now - this._lastCrowdBump > 2800) {
            for (let i = 0; i < entries.length; i++) {
                const ea = entries[i];
                if (ea.slime.draggedNode) continue;
                const ba = ea.slime._prairieBrain;
                if (!ba || now < ba._bumpCooldown) continue;
                if (!['intimidate','fight_clash','reckless_chase'].includes(ba.behavior)) continue;
                const ca = getCenter(ea.slime);
                for (let j = 0; j < entries.length; j++) {
                    if (i === j) continue;
                    const eb = entries[j];
                    if (eb.slime.draggedNode) continue;
                    const cb = getCenter(eb.slime);
                    if (Math.hypot(ca.x - cb.x, ca.y - cb.y) < 52 && Math.random() < 0.08) {
                        this._lastCrowdBump = now;
                        ba._bumpCooldown = now + 4000;
                        const dir = Math.sign(cb.x - ca.x) || 1;
                        applyKnockbackToSlime(eb.slime, dir * 7, -4);
                        eb.slime.triggerAction('hurt', 500, 1.0);
                        if (eb.slime._prairieBrain) eb.slime._prairieBrain._pendingBubble = { emotion: 'pain' };
                        SlimeSoundEngine.playBump(ea.slime);
                        break;
                    }
                }
            }
        }
    }

    removeSlime(id) { }

    handleEnvironmentInteractions(slime, objects, now) {
        const brain = slime._prairieBrain;
        slime._platformFloor = null;
        const center = getCenter(slime);
        const radius = slime.baseRadius || 30;

        for (const obj of objects) {
            if (!obj.interactive && obj.type !== 'terrarium') continue;

            if (obj.type === 'terrarium') {
                const floorY = obj.y - obj.h;
                const hutLeft = obj.x;
                const hutRight = obj.x + obj.w;
                const roofY = floorY - obj.houseH;

                if (center.x > hutLeft - 20 && center.x < hutRight + 20 && center.y < floorY + 20 && center.y > roofY - 20) {
                    slime._platformFloor = floorY;
                    for (const node of slime.nodes) {
                        if (node.x < hutLeft) { node.x = hutLeft; node.oldX = Math.min(node.oldX, node.x); }
                        else if (node.x > hutRight) { node.x = hutRight; node.oldX = Math.max(node.oldX, node.x); }
                        if (node.y > floorY) { node.y = floorY; node.oldY = Math.max(node.oldY, node.y); }
                        else if (node.y < roofY) { node.y = roofY; node.oldY = Math.min(node.oldY, node.y); }
                    }
                }
                continue;
            }

            const dx = center.x - obj.x;
            const dy = center.y - (obj.y || 0);
            const dist = Math.hypot(dx, dy);

            if (obj.type === 'trampoline' && Math.abs(dx) < obj.w * 0.5 + 20 && dy > -radius - 20 && dy < 10) {
                const vel = slime.getAverageVelocity?.() || { y: 0 };
                if (vel.y > 0.8 || slime.draggedNode) {
                    applyKnockbackToSlime(slime, 0, -18);
                    slime.triggerAction('jump', 400, 1.2);
                    SlimeSoundEngine.playTrampoline();
                }
            }

            if (obj.type === 'jump_ball' && dist < radius + obj.r) {
                applyKnockbackToSlime(slime, 0, 26);
                slime.triggerAction('hurt', 600, 1.3);
                SlimeSoundEngine.playMagicWoosh();
            }

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

    nudgeTowardObject(slimeId, slime, obj) {
        const brain = slime._prairieBrain;
        if (!brain) return;
        const passiveBehaviors = ['wander','idle_look','explore_jump','sniff_object','play_ball','sit_stump','seek_food','eat_berry','sit_bench'];
        if (!passiveBehaviors.includes(brain.behavior) && brain.behavior !== null) return;

        const now = performance.now();
        const TYPE_TO_BEHAVIOR = {
            ball: 'play_ball', stump: 'sit_stump', bench: 'sit_bench',
            berry_bush: 'seek_food', flower: 'sniff_object', mushroom: 'sniff_object',
            puddle: 'sniff_object', rock: 'sniff_object',
        };
        const behaviorName = TYPE_TO_BEHAVIOR[obj.type];
        if (!behaviorName) return;

        if (brain.recentBehaviors.filter(b => b === behaviorName).length >= 3) return;

        startBehavior(brain, behaviorName, null, now, obj);
        brain.logInteraction(behaviorName, null, `nudged by player near ${obj.type}`);
    }
}