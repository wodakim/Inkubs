import { worldWidth, worldHeight, inputState } from '../../../runtime/runtimeState.js';
import { recordSlimeEvent, touchLivingStateFrame } from '../../lifecycle/livingState.js';
import { SlimeSoundEngine } from '../../../../../features/prairie/slime-sound-engine.js';

export function installPhysics(Slime) {
  Slime.prototype.update = function() {
    if (!this.draggedNode) this.age++;
    touchLivingStateFrame(this);
    this.applyKeyboardControls();
    const hasPlayerInput = !!(this.draggedNode || inputState.left || inputState.right || inputState.jumpQueued);
    if (hasPlayerInput) this.idleFrames = 0;
    else this.idleFrames++;
    
    let gravity = 0.8;
    if (this.genome?.isInstable) {
      const mass = this.genome.instabilityMass;
      if (mass === 'gaseous' && !this._instableGrounded) gravity = 0.06;
      else if (mass === 'medium')                        gravity = 0.42;
    }
    const box = this.getBoxBounds();
    let floor = (this._platformFloor !== null && this._platformFloor !== undefined) ? this._platformFloor : box.bottom;
    let margin = box.left;
    let rightMargin = box.right;
    let topMargin = box.top;
    
    for (let pt of this.nodes) {
        if (pt === this.draggedNode) {
            pt.x = this.dragX;
            pt.y = this.dragY;
            pt.oldX = pt.x; 
            pt.oldY = pt.y;
            continue;
        }
    
        let vx = (pt.x - pt.oldX) * this.friction;
        let vy = (pt.y - pt.oldY) * this.friction;

        const isNearFloor = pt.y >= floor - 4.0;
        if (isNearFloor) {
            const groundFriction = 0.55;
            vx *= groundFriction;
            if (Math.abs(vx) < this.staticFrictionVelocityThreshold * 2.0) {
                vx *= 0.22;
            }
            if (Math.abs(vx) < 0.03) vx = 0;
        }
    
        pt.oldX = pt.x;
        pt.oldY = pt.y;
        pt.x += vx;
        pt.y += vy + gravity;
    }
    
    let iterations = 6;
    const MAX_STRETCH_RATIO = 2.8;
    const TENSION_DAMPING   = 0.35;

    for (let iter = 0; iter < iterations; iter++) {
        const centroid = this.getConstraintCenter();

        for (let i = 0; i < this.numNodes; i++) {
            const pt = this.nodes[i];
            if (pt === this.draggedNode) continue;
            const dx = pt.x - centroid.x;
            const dy = pt.y - centroid.y;
            const dist = Math.hypot(dx, dy) || 1;
            const maxDist = this.baseRadius * MAX_STRETCH_RATIO;
            if (dist > maxDist) {
                const scale = maxDist / dist;
                pt.x = centroid.x + dx * scale;
                pt.y = centroid.y + dy * scale;
                const vx = pt.x - pt.oldX;
                const vy = pt.y - pt.oldY;
                const nx = dx / dist;
                const ny = dy / dist;
                const radialV = vx * nx + vy * ny;
                pt.oldX += nx * radialV * TENSION_DAMPING;
                pt.oldY += ny * radialV * TENSION_DAMPING;
            }
        }

        for (let i = 0; i < this.numNodes; i++) {
            let p1 = this.nodes[i];
            let p2 = this.nodes[(i + 1) % this.numNodes];
    
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.hypot(dx, dy) || 1;
    
            let diff = this.perimeterDist - dist;
            let percent = (diff / dist) * 0.5; 
            let offsetX = dx * percent;
            let offsetY = dy * percent;
    
            if (p1 !== this.draggedNode) { p1.x -= offsetX; p1.y -= offsetY; }
            if (p2 !== this.draggedNode) { p2.x += offsetX; p2.y += offsetY; }
        }
    
        const shapeOffsets = new Array(this.numNodes);
        let shapeShiftX = 0;
        let shapeShiftY = 0;
        let shapeCount = 0;
        for (let i = 0; i < this.numNodes; i++) {
            let pt = this.nodes[i];
            let dx = pt.x - centroid.x;
            let dy = pt.y - centroid.y;
            let dist = Math.hypot(dx, dy) || 1;
    
            let diff = this.targetDistances[i] - dist;
            let percent = (diff / dist) * this.rigidity;
            let offsetX = dx * percent;
            let offsetY = dy * percent;
            shapeOffsets[i] = { offsetX, offsetY, locked: pt === this.draggedNode };
            if (pt !== this.draggedNode) {
                shapeShiftX += offsetX;
                shapeShiftY += offsetY;
                shapeCount++;
            }
        }
        const avgShapeShiftX = shapeCount ? shapeShiftX / shapeCount : 0;
        const avgShapeShiftY = shapeCount ? shapeShiftY / shapeCount : 0;
        for (let i = 0; i < this.numNodes; i++) {
            let pt = this.nodes[i];
            const data = shapeOffsets[i];
            if (!data || data.locked) continue;
            pt.x += data.offsetX - avgShapeShiftX;
            pt.y += data.offsetY - avgShapeShiftY;
        }
    
        let areaHoldStrength = this.surfaceSmoothness;
        const smoothOffsets = new Array(this.numNodes);
        let smoothShiftX = 0;
        let smoothShiftY = 0;
        let smoothCount = 0;
        for (let i = 0; i < this.numNodes; i++) {
            let pt = this.nodes[i];
            let prev = this.nodes[(i - 1 + this.numNodes) % this.numNodes];
            let next = this.nodes[(i + 1) % this.numNodes];
    
            let smoothX = (prev.x + next.x) * 0.5;
            let smoothY = (prev.y + next.y) * 0.5;
            let offsetX = (smoothX - pt.x) * areaHoldStrength;
            let offsetY = (smoothY - pt.y) * areaHoldStrength;
            smoothOffsets[i] = { offsetX, offsetY, locked: pt === this.draggedNode };
            if (pt !== this.draggedNode) {
                smoothShiftX += offsetX;
                smoothShiftY += offsetY;
                smoothCount++;
            }
        }
        const avgSmoothShiftX = smoothCount ? smoothShiftX / smoothCount : 0;
        const avgSmoothShiftY = smoothCount ? smoothShiftY / smoothCount : 0;
        for (let i = 0; i < this.numNodes; i++) {
            let pt = this.nodes[i];
            const data = smoothOffsets[i];
            if (!data || data.locked) continue;
            pt.x += data.offsetX - avgSmoothShiftX;
            pt.y += data.offsetY - avgSmoothShiftY;
        }
    
        let repulsionRadius = this.baseRadius * 0.45; 
        for (let i = 0; i < this.numNodes; i++) {
            for (let j = i + 2; j < this.numNodes; j++) {
                if (i === 0 && j === this.numNodes - 1) continue; 
    
                let p1 = this.nodes[i];
                let p2 = this.nodes[j];
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                let dist = Math.hypot(dx, dy);
    
                if (dist > 0 && dist < repulsionRadius) {
                    let diff = repulsionRadius - dist;
                    let percent = (diff / dist) * 0.5;
                    let offsetX = dx * percent;
                    let offsetY = dy * percent;
    
                    if (p1 !== this.draggedNode) { p1.x -= offsetX; p1.y -= offsetY; }
                    if (p2 !== this.draggedNode) { p2.x += offsetX; p2.y += offsetY; }
                }
            }
        }
    
        const effectiveFloor = (this.genome?.isInstable
          && this.genome.instabilityMass === 'gaseous'
          && !this._instableGrounded)
          ? floor - this.baseRadius * 3.0
          : floor;

        let maxImpactVelocity = 0;

        for (let pt of this.nodes) {
            if (pt.y > effectiveFloor) {
                let vy = pt.y - pt.oldY;
                if (vy > maxImpactVelocity) maxImpactVelocity = vy;

                pt.y = effectiveFloor;
                let vx = pt.x - pt.oldX;
                const descendingImpact = vy > 0.55;
                const nearRestContact = Math.abs(vy) < 0.9;
                let retention = descendingImpact ? this.groundVelocityRetention : 0.04;
                if (nearRestContact && Math.abs(vx) < this.staticFrictionVelocityThreshold) {
                    retention = this.groundStickRetention;
                }
                pt.oldX = pt.x - vx * retention;
                pt.oldY = pt.y + vy * this.bounceDamping;
                if (nearRestContact && Math.abs(vx) < this.staticFrictionVelocityThreshold) {
                    pt.oldX = pt.x;
                }
            }
            if (pt.x < margin) { pt.x = margin; pt.oldX = pt.x + (pt.x - pt.oldX) * 0.5; }
            if (pt.x > rightMargin) { pt.x = rightMargin; pt.oldX = pt.x + (pt.x - pt.oldX) * 0.5; }
            if (pt.y < topMargin) { pt.y = topMargin; pt.oldY = pt.y + (pt.y - pt.oldY) * 0.5; }
        }

        // Détection de l'atterrissage et appel au son
        if (maxImpactVelocity > 2.5 && !this._wasGrounded) {
            SlimeSoundEngine.playLand(maxImpactVelocity, this);
        }
    }

    // Réinitialisation du statut au sol pour le saut suivant
    if (this.getGroundedRatio() > 0.1) {
        this._wasGrounded = true;
    } else {
        this._wasGrounded = false;
    }
    
    this.applySelfRighting();
    
    const rawCenter = this.getRawVisualCenter();
    const previousCenterX = Number.isFinite(this.visualCenterX) ? this.visualCenterX : rawCenter.x;
    const previousCenterY = Number.isFinite(this.visualCenterY) ? this.visualCenterY : rawCenter.y;
    const centerSmoothing = this.draggedNode ? 0.32 : 0.18;
    const smoothedCenterX = previousCenterX + (rawCenter.x - previousCenterX) * centerSmoothing;
    const smoothedCenterY = previousCenterY + (rawCenter.y - previousCenterY) * centerSmoothing;
    
    this.prevVisualCenterX = previousCenterX;
    this.prevVisualCenterY = previousCenterY;
    this.visualCenterX = Number.isFinite(smoothedCenterX) ? smoothedCenterX : rawCenter.x;
    this.visualCenterY = Number.isFinite(smoothedCenterY) ? smoothedCenterY : rawCenter.y;
    
    this.updateAnimationController();
  };

  Slime.prototype.getBoxBounds = function() {
    const pad = Number.isFinite(this.boxPadding) ? this.boxPadding : Math.max(22, Math.min(worldWidth, worldHeight) * 0.04);
    const bounds = this.worldBounds && typeof this.worldBounds === 'object' ? this.worldBounds : null;
    return {
        left: Number.isFinite(bounds?.left) ? bounds.left : pad,
        top: Number.isFinite(bounds?.top) ? bounds.top : pad,
        right: Number.isFinite(bounds?.right) ? bounds.right : (worldWidth - pad),
        bottom: Number.isFinite(bounds?.bottom) ? bounds.bottom : (worldHeight - pad)
    };
  };

  Slime.prototype.getGroundedRatio = function() {
    const box = this.getBoxBounds();
    const floor = (this._platformFloor !== null && this._platformFloor !== undefined) ? this._platformFloor : box.bottom;
    let groundedCount = 0;
    for (const pt of this.nodes) {
        if (!Number.isFinite(pt.y)) continue;
        if (pt.y >= floor - 1.5) groundedCount++;
    }
    return groundedCount / this.nodes.length;
  };

  Slime.prototype.getAverageVelocity = function() {
    let sumVx = 0;
    let sumVy = 0;
    let count = 0;
    for (const pt of this.nodes) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.oldX) || !Number.isFinite(pt.y) || !Number.isFinite(pt.oldY)) continue;
        sumVx += (pt.x - pt.oldX);
        sumVy += (pt.y - pt.oldY);
        count++;
    }
    if (!count) return { x: 0, y: 0 };
    return { x: sumVx / count, y: sumVy / count };
  };

  Slime.prototype.restoreSurfaceIntegrity = function({ preserveVelocity = false } = {}) {
    const center = this.getRawVisualCenter();
    const velocity = preserveVelocity ? this.getAverageVelocity() : { x: 0, y: 0 };
    for (let i = 0; i < this.numNodes; i++) {
        const angle = (i / this.numNodes) * Math.PI * 2;
        const radius = this.targetDistances?.[i] ?? this.baseRadius;
        const nx = center.x + Math.cos(angle) * radius;
        const ny = center.y + Math.sin(angle) * radius;
        const pt = this.nodes[i];
        pt.x = nx;
        pt.y = ny;
        pt.oldX = nx - velocity.x;
        pt.oldY = ny - velocity.y;
    }
    this.draggedNode = null;
    this.visualCenterX = center.x;
    this.visualCenterY = center.y;
    this.prevVisualCenterX = center.x - velocity.x;
    this.prevVisualCenterY = center.y - velocity.y;
  };

  Slime.prototype.applyHorizontalInput = function(direction) {
    if (!direction) return;
    const groundedRatio = this.getGroundedRatio();
    const controlFactor = groundedRatio > 0.18 ? 1 : this.airControlFactor;
    const avgVelocity = this.getAverageVelocity();
    const targetSpeed = direction * this.maxMoveSpeed;
    const speedGap = targetSpeed - avgVelocity.x;
    const impulse = Math.max(-this.moveAcceleration, Math.min(this.moveAcceleration, speedGap * 0.18)) * controlFactor;
    if (Math.abs(impulse) < 1e-4) return;
    for (const pt of this.nodes) {
        if (!Number.isFinite(pt.oldX)) continue;
        pt.oldX -= impulse;
    }
  };

  Slime.prototype.tryJump = function() {
    if (this.jumpCooldownFrames > 0) return;
    const groundedRatio = this.getGroundedRatio();
    if (groundedRatio < 0.22) return;
    const avgVelocity = this.getAverageVelocity();
    const jumpStrength = this.jumpImpulse + Math.max(0, avgVelocity.y * 0.15);
    
    for (const pt of this.nodes) {
        if (!Number.isFinite(pt.oldY)) continue;
        pt.oldY += jumpStrength;
    }
    
    this.jumpLift = Math.max(this.jumpLift, 1);
    this.jumpCooldownFrames = 16;
    SlimeSoundEngine.playJump(jumpStrength, this);

    recordSlimeEvent(this, 'jump', { groundedRatio, jumpStrength }, { importance: 'routine' });
  };

  Slime.prototype.applyKeyboardControls = function() {
    if (this.draggedNode) return;
    const direction = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    if (direction !== 0) this.applyHorizontalInput(direction);
    if (inputState.jumpQueued) {
        this.tryJump();
        inputState.jumpQueued = false;
    }
    if (this.jumpCooldownFrames > 0) this.jumpCooldownFrames--;
  };

  Slime.prototype.getCurrentRotation = function() {
    const bottomIndex = Math.floor(this.numNodes / 4);
    const topIndex = Math.floor(this.numNodes * 0.75);
    const bottom = this.nodes[bottomIndex];
    const top = this.nodes[topIndex];
    if (!bottom || !top) return 0;
    const dx = bottom.x - top.x;
    const dy = bottom.y - top.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return Math.atan2(dy, dx) - Math.PI / 2;
  };

  Slime.prototype.normalizeAngle = function(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  Slime.prototype.applySelfRighting = function() {
    if (this.draggedNode) {
        this.prevBodyRotation = this.getCurrentRotation();
        return;
    }
    const groundedRatio = this.getGroundedRatio();
    const rotation = this.getCurrentRotation();
    if (groundedRatio < 0.06) {
        this.prevBodyRotation = rotation;
        return;
    }
    const prevRotation = Number.isFinite(this.prevBodyRotation) ? this.prevBodyRotation : rotation;
    const angularVelocity = this.normalizeAngle(rotation - prevRotation);
    const angleError = this.normalizeAngle(rotation);
    const absError = Math.abs(angleError);
    const overturnedBoost = Math.min(1, Math.max(0, (absError - 0.15) / (Math.PI - 0.15)));

    const recoveryActive = absError > 0.35;

    let assist = (0.025 + overturnedBoost * 0.045) * Math.min(1, groundedRatio * 1.5);
    let damping = 0.08 + overturnedBoost * 0.08;
    if (recoveryActive) {
        assist += 0.012 + overturnedBoost * 0.02;
        damping += 0.02;
    }

    let angularImpulse = (-angleError * assist) - (angularVelocity * damping);
    angularImpulse = Math.max(-0.08, Math.min(0.08, angularImpulse));

    if (Math.abs(angularImpulse) > 1e-5) {
        const center = this.getRawVisualCenter();
        const radiusNorm = Math.max(12, this.baseRadius);
        const rightingImpX = new Array(this.numNodes);
        const rightingImpY = new Array(this.numNodes);
        let sumImpX = 0, sumImpY = 0;
        for (let i = 0; i < this.numNodes; i++) {
            const pt = this.nodes[i];
            const rx = pt.x - center.x;
            const ry = pt.y - center.y;
            const tangentX = -ry;
            const tangentY = rx;
            const lowerBias = Math.max(0, (pt.y - center.y) / radiusNorm);
            const supportBias = 0.18 + lowerBias * 0.82;
            rightingImpX[i] = tangentX * angularImpulse * supportBias * 0.42;
            rightingImpY[i] = tangentY * angularImpulse * supportBias * 0.58;
            sumImpX += rightingImpX[i];
            sumImpY += rightingImpY[i];
        }
        const avgImpX = sumImpX / this.numNodes;
        const avgImpY = sumImpY / this.numNodes;
        for (let i = 0; i < this.numNodes; i++) {
            this.nodes[i].oldX -= (rightingImpX[i] - avgImpX);
            this.nodes[i].oldY -= (rightingImpY[i] - avgImpY);
        }
    }

    if (recoveryActive && groundedRatio > 0.18 && absError > 0.8) {
        const avgVelocity = this.getAverageVelocity();
        const speed = Math.hypot(avgVelocity.x, avgVelocity.y);
        if (speed < 1.5 && (this.age - this.lastIdleRecoveryHopFrame) >= 18) {
            const center = this.getRawVisualCenter();
            const hopStrength = Math.min(3.5, 1.2 + absError * 0.8);
            const rollSign = Math.sign(angleError) || 1;
            const hopImpX = new Array(this.numNodes);
            const hopImpY = new Array(this.numNodes);
            let hopSumX = 0, hopSumY = 0;
            for (let i = 0; i < this.numNodes; i++) {
                const pt = this.nodes[i];
                const belowCenter = Math.max(0, (pt.y - center.y) / Math.max(12, this.baseRadius));
                const side = (pt.x - center.x) / Math.max(12, this.baseRadius);
                const supportBias = Math.min(1, belowCenter * 1.15);
                hopImpY[i] = hopStrength * (0.15 + supportBias * 0.3);
                hopImpX[i] = -rollSign * 0.08 * side * (0.08 + supportBias * 0.18);
                hopSumX += hopImpX[i];
                hopSumY += hopImpY[i];
            }
            const hopAvgX = hopSumX / this.numNodes;
            const hopAvgY = hopSumY / this.numNodes;
            for (let i = 0; i < this.numNodes; i++) {
                this.nodes[i].oldY += (hopImpY[i] - hopAvgY);
                this.nodes[i].oldX += (hopImpX[i] - hopAvgX);
            }
            this.lastIdleRecoveryHopFrame = this.age;
        }
    }
    this.prevBodyRotation = rotation;
  };
}
