import { inputState } from '../../../runtime/runtimeState.js';
import { clamp, lerp } from '../../../shared/math.js';

export function installAnimation(Slime) {
  Slime.prototype.triggerAction = function(action, duration = 880, intensity = 1) {
    const allowed = new Set(['attack', 'hurt', 'observe', 'flee', 'question', 'study']);
    if (!allowed.has(action)) return false;
    this.actionState = action;
    this.actionUntil = performance.now() + Math.max(120, duration);
    this.actionIntensity = clamp(intensity, 0, 1.35);
    if (typeof this.recordEvent === 'function') {
      this.recordEvent('action_triggered', { action, duration, intensity: this.actionIntensity }, {
        importance: action === 'hurt' || action === 'attack' ? 'significant' : 'routine',
        persistLongTerm: action === 'hurt'
      });
    }
    return true;
  };

  Slime.prototype.clearAction = function() {
    this.actionState = 'none';
    this.actionUntil = 0;
    this.actionIntensity = 0;
  };

  Slime.prototype.updateAnimationController = function() {
    const now = performance.now();
    const groundedRatio = this.getGroundedRatio();
    const avgVelocity = this.getAverageVelocity();
    const horizontalSpeed = Math.abs(avgVelocity.x);
    const verticalSpeed = avgVelocity.y;
    const movementDrive = clamp(horizontalSpeed / Math.max(1, this.maxMoveSpeed), 0, 1.2);
    const hasMoveInput = !!(inputState.left || inputState.right);
    
    const desiredFacing = horizontalSpeed > 0.16
        ? Math.sign(avgVelocity.x)
        : (inputState.right ? 1 : (inputState.left ? -1 : this.facing));
    if (desiredFacing) this.facing = desiredFacing;
    
    if (this.lastGroundedRatio < 0.12 && groundedRatio >= 0.18 && this.lastAverageVelocityY > 1.6) {
        this.landingPulse = clamp(this.lastAverageVelocityY / 10.5, 0, 1.2);
    }
    this.landingPulse *= groundedRatio > 0.12 ? 0.82 : 0.94;
    this.jumpLift *= groundedRatio < 0.12 ? 0.965 : 0.84;
    if (this.jumpLift < 0.001) this.jumpLift = 0;
    
    if (this.actionState !== 'none' && now >= this.actionUntil) {
        this.clearAction();
    }
    const targetActionBlend = this.actionState !== 'none' ? this.actionIntensity : 0;
    this.actionBlend = lerp(this.actionBlend, targetActionBlend, this.actionState !== 'none' ? 0.25 : 0.12);
    
    let locomotion = 'idle';
    if (this.draggedNode) locomotion = 'dragged';
    else if (groundedRatio < 0.12) locomotion = verticalSpeed < -0.65 ? 'jump' : 'fall';
    else if (this.landingPulse > 0.16) locomotion = 'land';
    else if (horizontalSpeed > 0.28 || hasMoveInput) locomotion = 'move';
    this.locomotionState = locomotion;
    
    this.moveCycle += 0.09 + movementDrive * 0.22 + (locomotion === 'move' ? 0.14 : 0);
    this.idleCycle += 0.018 + (locomotion === 'idle' ? 0.028 : 0.006);
    this.observeCycle += 0.045 + (this.actionState === 'study' ? 0.02 : 0);
    
    const idleBreath = Math.sin(this.idleCycle + this.animSeed * 0.01);
    const gait = Math.sin(this.moveCycle);
    const gaitAbs = Math.abs(gait);
    
    const pose = {
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        liftY: 0,
        roll: 0,
        shadowX: 1,
        shadowY: 1,
        shadowAlphaBoost: 0
    };
    // Face animations — driven by actionState and locomotionState
    const face = {
        lookBiasX: 0,
        lookBiasY: 0,
        eyeScaleX: 1,
        eyeScaleY: 1,
        mouthScaleX: 1,
        mouthScaleY: 1,
        mouthShiftY: 0,
        browLift: 0,
        browTilt: 0,
        faceOffsetY: 0,
        jitterX: 0,
        jitterY: 0,
        overrideEyeStyle: null,
        overrideMouthStyle: null,
        symbol: null,
        symbolAlpha: 0
    };

    // ── Locomotion face reactions ────────────────────────────────────────────
    if (locomotion === 'move') {
        face.eyeScaleX = 1 + movementDrive * 0.06;
        face.eyeScaleY = 1 - movementDrive * 0.08; // squint while running
        face.browTilt  = this.facing * movementDrive * 0.12;
        face.lookBiasX = this.facing * movementDrive * 6;
    } else if (locomotion === 'jump') {
        face.eyeScaleY = 1 + this.jumpLift * 0.18;
        face.browLift  = 0.3 + this.jumpLift * 0.2;
        face.mouthScaleY = 1.1;
    } else if (locomotion === 'land') {
        const impact = clamp(this.landingPulse, 0, 1.2);
        face.eyeScaleY = clamp(1 - impact * 0.35, 0.2, 1);
        face.faceOffsetY = impact * 2.5;
        face.browLift  = -impact * 0.15;
    } else if (locomotion === 'idle') {
        // Gentle idle look drift — breathing-sync eye blink
        face.eyeScaleY = 1 + idleBreath * 0.04;
        face.lookBiasX = Math.sin(this.idleCycle * 0.31 + this.animSeed) * 2.5;
        face.lookBiasY = Math.sin(this.idleCycle * 0.18 + this.animSeed * 0.7) * 1.5;
    }

    // ── Action face reactions (override locomotion) ─────────────────────────
    if (this.actionBlend > 0.03) {
        const ab = clamp(this.actionBlend, 0, 1.3);
        switch (this.actionState) {
            case 'attack': {
                face.eyeScaleY  = clamp(1 - ab * 0.55, 0.12, 1);
                face.browTilt   = this.facing * 0.65 * ab;
                face.browLift   = -0.15 * ab;
                face.lookBiasX  = this.facing * 10 * ab;
                face.mouthScaleX = 1 + ab * 0.18;
                face.overrideMouthStyle = ab > 0.3 ? 'fangs' : null;
                break;
            }
            case 'hurt': {
                const shake = Math.sin(now * 0.08 + this.animSeed) * ab;
                face.eyeScaleY  = clamp(1 - ab * 0.65, 0.12, 1);
                face.browLift   = 0.5 * ab;
                face.browTilt   = -0.4 * ab;
                face.jitterX    = shake * 4;
                face.jitterY    = Math.abs(shake) * 2.5;
                face.overrideMouthStyle = ab > 0.25 ? 'tiny_frown' : null;
                break;
            }
            case 'observe': {
                face.eyeScaleX  = 1 + ab * 0.18;
                face.eyeScaleY  = 1 + ab * 0.25;
                face.browLift   = 0.4 * ab;
                face.lookBiasX  = this.facing * 7 * ab;
                face.overrideMouthStyle = ab > 0.35 ? 'tiny_o' : null;
                break;
            }
            case 'flee': {
                face.eyeScaleX  = 1 + ab * 0.22;
                face.eyeScaleY  = 1 + ab * 0.28;
                face.browLift   = 0.6 * ab;
                face.browTilt   = 0.35 * ab;
                face.lookBiasX  = -this.facing * 9 * ab;
                face.overrideMouthStyle = ab > 0.3 ? 'tiny_frown' : null;
                break;
            }
            case 'question': {
                face.eyeScaleY  = 1 + ab * 0.15;
                face.browLift   = 0.5 * ab;
                face.browTilt   = -this.facing * 0.35 * ab;
                face.lookBiasY  = -4 * ab;
                face.overrideMouthStyle = ab > 0.3 ? 'hmm' : null;
                break;
            }
            case 'study': {
                face.eyeScaleX  = 1 - ab * 0.12;
                face.eyeScaleY  = clamp(1 - ab * 0.3, 0.3, 1);
                face.browTilt   = this.facing * 0.3 * ab;
                face.lookBiasX  = this.facing * 6 * ab;
                face.lookBiasY  = -3 * ab;
                break;
            }
        }
    }

    // Body-only locomotion animations (squash/stretch du corps uniquement)
    if (locomotion === 'idle') {
        pose.scaleX -= idleBreath * 0.012;
        pose.scaleY += idleBreath * 0.02;
        pose.liftY += Math.sin(this.idleCycle * 0.52 + this.animSeed * 0.5) * 1.1;

        // Instable: trembling (rapid noise) + strong pulsation
        if (this.genome?.isInstable) {
          const mass = this.genome.instabilityMass || 'heavy';
          const tFreq = mass === 'heavy' ? 0.30 : 0.16;
          const tAmp  = mass === 'heavy' ? 0.040 : 0.022;
          pose.scaleX += Math.sin(now * tFreq        + this.animSeed * 7.3) * tAmp;
          pose.scaleY -= Math.sin(now * tFreq * 1.31 + this.animSeed * 4.1) * tAmp * 0.65;
          // Slow swell: gaseous bloats and shrinks like a lung
          const pulse = Math.sin(this.idleCycle * 0.11 + this.animSeed) * (mass === 'gaseous' ? 0.06 : 0.038);
          pose.scaleX += pulse;
          pose.scaleY -= pulse * 0.7;
        }
    } else if (locomotion === 'move') {
        pose.scaleX += gaitAbs * 0.055 + movementDrive * 0.03;
        pose.scaleY -= gaitAbs * 0.042;
        pose.skewX += this.facing * (0.02 + movementDrive * 0.045);
        pose.roll += gait * 0.05 * Math.max(0.35, movementDrive);
        pose.liftY += gaitAbs * 1.6;
        // Instable: trembling while moving
        if (this.genome?.isInstable) {
          const tFreq = this.genome.instabilityMass === 'heavy' ? 0.26 : 0.14;
          pose.scaleX += Math.sin(now * tFreq + this.animSeed * 5.2) * 0.022;
          pose.scaleY -= Math.sin(now * tFreq * 1.4 + this.animSeed * 3.8) * 0.016;
        }
    } else if (locomotion === 'jump') {
        pose.scaleX *= 0.93;
        pose.scaleY *= 1.08 + this.jumpLift * 0.05;
        pose.liftY -= 2.6 + this.jumpLift * 2.2;
        pose.shadowX *= 0.82;
        pose.shadowAlphaBoost -= 0.08;
    } else if (locomotion === 'fall') {
        pose.scaleX *= 1.06;
        pose.scaleY *= 0.93;
        pose.liftY += 1.5;
        pose.shadowX *= 0.9;
    } else if (locomotion === 'land') {
        const impact = clamp(this.landingPulse, 0, 1.2);
        pose.scaleX *= 1 + impact * 0.18;
        pose.scaleY *= 1 - impact * 0.13;
        pose.liftY += impact * 1.8;
        pose.shadowX *= 1 + impact * 0.15;
        pose.shadowAlphaBoost += impact * 0.08;
    } else if (locomotion === 'dragged') {
        const dragDx = this.draggedNode ? clamp((this.dragX - this.visualCenterX) / Math.max(20, this.baseRadius), -1.4, 1.4) : 0;
        const dragDy = this.draggedNode ? clamp((this.dragY - this.visualCenterY) / Math.max(20, this.baseRadius), -1.4, 1.4) : 0;
        pose.scaleX *= 1 - Math.abs(dragDy) * 0.04 + Math.abs(dragDx) * 0.02;
        pose.scaleY *= 1 + Math.abs(dragDy) * 0.08;
        pose.skewX += dragDx * 0.06;
        pose.roll += dragDx * 0.08;
    }

    // Body-only action animations (corps uniquement, pas de face)
    const actionBlend = clamp(this.actionBlend, 0, 1.25);
    if (actionBlend > 0.01) {
        switch (this.actionState) {
            case 'attack': {
                pose.scaleX *= 1 + 0.05 * actionBlend;
                pose.scaleY *= 1 - 0.04 * actionBlend;
                pose.skewX += this.facing * 0.09 * actionBlend;
                pose.roll += this.facing * 0.05 * actionBlend;
                break;
            }
            case 'hurt': {
                const shake = Math.sin(now * 0.065 + this.animSeed) * 1.7 * actionBlend;
                pose.scaleX *= 1 + 0.07 * actionBlend;
                pose.scaleY *= 1 - 0.05 * actionBlend;
                pose.roll += shake * 0.012;
                break;
            }
            case 'flee': {
                pose.skewX -= this.facing * 0.1 * actionBlend;
                pose.roll -= this.facing * 0.03 * actionBlend;
                break;
            }
        }
    }

    pose.scaleX = clamp(pose.scaleX, 0.82, 1.28);
    pose.scaleY = clamp(pose.scaleY, 0.78, 1.24);
    pose.skewX = clamp(pose.skewX, -0.18, 0.18);
    pose.roll = clamp(pose.roll, -0.16, 0.16);
    pose.shadowX = clamp(pose.shadowX, 0.72, 1.32);
    pose.shadowY = clamp(pose.shadowY, 0.8, 1.18);
    
    face.lookBiasX = clamp(face.lookBiasX, -10, 10);
    face.lookBiasY = clamp(face.lookBiasY, -8, 8);
    face.eyeScaleX = clamp(face.eyeScaleX, 0.8, 1.22);
    face.eyeScaleY = clamp(face.eyeScaleY, 0.18, 1.28);
    face.mouthScaleX = clamp(face.mouthScaleX, 0.72, 1.35);
    face.mouthScaleY = clamp(face.mouthScaleY, 0.52, 1.35);
    face.browLift = clamp(face.browLift, -0.2, 0.72);
    face.browTilt = clamp(face.browTilt, -0.1, 0.8);
    face.symbolAlpha = clamp(face.symbolAlpha || 0, 0, 1);
    
    this.renderPose = pose;
    this.faceAnimation = face;
    this.lastGroundedRatio = groundedRatio;
    this.lastAverageVelocityX = avgVelocity.x;
    this.lastAverageVelocityY = avgVelocity.y;
  };

}
