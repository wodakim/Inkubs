// ── Helpers ──────────────────────────────────────────────────────────────────
export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function randRange(a, b) { return a + Math.random() * (b - a); }
export function sigmoid(stat) { return 1 / (1 + Math.exp(-0.07 * ((stat || 50) - 48))); }

export function getCenter(slime) {
    return slime.getRawVisualCenter?.() || slime.getVisualCenter?.() || { x: 0, y: 0 };
}

export function statDrive(stats, keys) {
    let sum = 0, n = 0;
    for (const k of keys) {
        const v = stats?.[k];
        if (typeof v === 'number') { sum += sigmoid(v); n++; }
    }
    return n > 0 ? sum / n : 0.5;
}

export function getSlimeName(slime) {
    return slime?._canonicalName || 'Inkübus';
}

// ── Per-slime brain ──────────────────────────────────────────────────────────
export class SlimeBrain {
    constructor(id, initialAffinities = null) {
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
        
        if (initialAffinities) {
            for (const [targetId, bias] of Object.entries(initialAffinities)) {
                this.biasByTarget.set(targetId, bias);
            }
        }
        
        this.recentBehaviors = [];
        this.interactionLog = [];
        this.statChangeLog = [];
        this._pendingBubble = null;
        this._lastTeleportAt = 0;
        this._recklessChaseTargetId = null;
        this._lastRecklessChaseAt = 0;
        this._pendingReply = null;
        
        // Needs & emotions
        this.hunger = 10 + Math.random() * 20; 
        this._lastHungerTick = 0; 
        this.emotionalState = { happiness: 0.5 + Math.random() * 0.3, fear: 0 };
        this.knownFoodPos = null;
        
        // Hunt & physics states
        this._huntTargetId = null; 
        this._huntJumpAt = 0;     
        this._bumpCooldown = 0;        
        this._teleportCooldown = 0;    
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

    exportStrongAffinities() {
        const result = {};
        for (const [id, value] of this.biasByTarget) {
            if (value > 0.6 || value < -0.6) {
                result[id] = value;
            }
        }
        return result;
    }
}