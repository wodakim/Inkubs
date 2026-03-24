import { ctx, worldWidth, worldHeight } from '../../../runtime/runtimeState.js';

export function installGeometry(Slime) {
  Slime.prototype.drawContainmentBox = function() {
    const box = this.getBoxBounds();
    const boxWidth = box.right - box.left;
    const boxHeight = box.bottom - box.top;
    
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(box.left, box.top, boxWidth, boxHeight, 24);
    } else {
        ctx.rect(box.left, box.top, boxWidth, boxHeight);
    }
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(box.left + 8, box.top + 8, boxWidth - 16, boxHeight - 16, 18);
    } else {
        ctx.rect(box.left + 8, box.top + 8, boxWidth - 16, boxHeight - 16);
    }
    ctx.stroke();
    ctx.restore();
  };

  Slime.prototype.getRawVisualCenter = function() {
    let twiceArea = 0;
    let centroidX = 0;
    let centroidY = 0;
    let validVertices = 0;
    
    for (let i = 0; i < this.numNodes; i++) {
        const p1 = this.nodes[i];
        const p2 = this.nodes[(i + 1) % this.numNodes];
        if (!Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) continue;
        const cross = p1.x * p2.y - p2.x * p1.y;
        twiceArea += cross;
        centroidX += (p1.x + p2.x) * cross;
        centroidY += (p1.y + p2.y) * cross;
        validVertices++;
    }
    
    if (validVertices >= 3 && Math.abs(twiceArea) > 1e-3) {
        return {
            x: centroidX / (3 * twiceArea),
            y: centroidY / (3 * twiceArea)
        };
    }
    
    let visualX = 0;
    let visualY = 0;
    let validCount = 0;
    for (let pt of this.nodes) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        visualX += pt.x;
        visualY += pt.y;
        validCount++;
    }
    if (validCount === 0) {
        return { x: worldWidth * 0.5, y: worldHeight * 0.5 };
    }
    return {
        x: visualX / validCount,
        y: visualY / validCount
    };
  };

  Slime.prototype.getConstraintCenter = function() {
    // Les contraintes doivent s'appuyer sur le centre géométrique instantané,
    // pas sur le centre visuel lissé, sinon on injecte une traction latérale parasite.
    return this.getRawVisualCenter();
  };

  Slime.prototype.getVisualCenter = function() {
    const rawCenter = this.getRawVisualCenter();
    if (!Number.isFinite(this.visualCenterX) || !Number.isFinite(this.visualCenterY)) {
        return rawCenter;
    }
    return {
        x: this.visualCenterX,
        y: this.visualCenterY
    };
  };

  Slime.prototype.getBodyFrame = function(visualX, visualY, rotation) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (let pt of this.nodes) {
        const dx = pt.x - visualX;
        const dy = pt.y - visualY;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        if (localX < minX) minX = localX;
        if (localX > maxX) maxX = localX;
        if (localY < minY) minY = localY;
        if (localY > maxY) maxY = localY;
    }
    
    return { minX, maxX, minY, maxY };
  };

  Slime.prototype.createAccessoryAttachment = function() {
    if (this.accessory === 'none') return null;
    
    let localX = 0;
    let localY = -1;
    let skinOffset = -this.baseRadius * 0.014;
    let rotationOffset = 0;
    let scaleBoost = 1;
    
    if (this.accessory === 'bow') {
        localX = Math.random() > 0.5 ? -0.34 : 0.34;
        localY = -0.94;
        skinOffset = -this.baseRadius * 0.018;
        scaleBoost = 1.02;
    } else if (this.accessory === 'leaf' || this.accessory === 'sprout') {
        localX = Math.random() > 0.5 ? -0.26 : 0.26;
        localY = -0.97;
        skinOffset = -this.baseRadius * 0.012;
        rotationOffset = localX < 0 ? -0.2 : 0.2;
    } else if (this.accessory === 'horns' || this.accessory === 'crown') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.006;
    } else if (this.accessory === 'flower' || this.accessory === 'star_pin') {
        localX = Math.random() > 0.5 ? -0.38 : 0.38;
        localY = -0.9;
        skinOffset = -this.baseRadius * 0.01;
        rotationOffset = localX < 0 ? -0.1 : 0.1;
        scaleBoost = 0.95;
    } else if (this.accessory === 'mushroom') {
        localX = Math.random() > 0.5 ? -0.2 : 0.2;
        localY = -0.98;
        skinOffset = -this.baseRadius * 0.004;
        scaleBoost = 0.96;
    } else if (this.accessory === 'spikes') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.004;
        scaleBoost = 1.06;
    } else if (this.accessory === 'antenna') {
        localX = Math.random() > 0.5 ? -0.12 : 0.12;
        localY = -1;
        skinOffset = -this.baseRadius * 0.002;
    } else if (this.accessory === 'halo' || this.accessory === 'broken_halo') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.1;
        scaleBoost = 1.05;
    } else if (this.accessory === 'clover' || this.accessory === 'feather' || this.accessory === 'shell_pin' || this.accessory === 'bone_pin') {
        localX = Math.random() > 0.5 ? -0.32 : 0.32;
        localY = -0.86;
        skinOffset = -this.baseRadius * 0.006;
        rotationOffset = localX < 0 ? -0.18 : 0.18;
        scaleBoost = 0.94;
    }
    // ── New cute accessories ─────────────────────────────────────────────────
    else if (this.accessory === 'ribbon_bow') {
        localX = Math.random() > 0.5 ? -0.28 : 0.28;
        localY = -0.96;
        skinOffset = -this.baseRadius * 0.016;
        scaleBoost = 1.0;
    } else if (this.accessory === 'mini_crown' || this.accessory === 'crystal_tiara' || this.accessory === 'starfall_crown' || this.accessory === 'void_crown') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.006;
        scaleBoost = 1.02;
    } else if (this.accessory === 'candy_pin' || this.accessory === 'cherry_clip') {
        localX = Math.random() > 0.5 ? -0.36 : 0.36;
        localY = -0.92;
        skinOffset = -this.baseRadius * 0.01;
        rotationOffset = localX < 0 ? -0.12 : 0.12;
        scaleBoost = 0.92;
    } else if (this.accessory === 'cloud_puff') {
        localX = Math.random() > 0.5 ? -0.22 : 0.22;
        localY = -0.98;
        skinOffset = -this.baseRadius * 0.022;
        scaleBoost = 1.0;
    } else if (this.accessory === 'rainbow_halo' || this.accessory === 'halo' || this.accessory === 'celestial_halo') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.12;
        scaleBoost = 1.05;
    } else if (this.accessory === 'petal_wreath') {
        localX = 0;
        localY = -0.98;
        skinOffset = -this.baseRadius * 0.02;
        scaleBoost = 1.0;
    }
    // ── New normal accessories ───────────────────────────────────────────────
    else if (this.accessory === 'twig' || this.accessory === 'wind_streamer') {
        localX = Math.random() > 0.5 ? -0.24 : 0.24;
        localY = -0.97;
        skinOffset = -this.baseRadius * 0.01;
        rotationOffset = localX < 0 ? -0.22 : 0.22;
        scaleBoost = 0.96;
    } else if (this.accessory === 'bandana') {
        localX = 0;
        localY = -0.82;
        skinOffset = this.baseRadius * 0.04;
        scaleBoost = 1.0;
    } else if (this.accessory === 'monocle_top') {
        localX = Math.random() > 0.5 ? -0.3 : 0.3;
        localY = -0.9;
        skinOffset = -this.baseRadius * 0.008;
        scaleBoost = 0.92;
    } else if (this.accessory === 'lantern_float') {
        localX = Math.random() > 0.5 ? -0.18 : 0.18;
        localY = -1;
        skinOffset = -this.baseRadius * 0.035;
        scaleBoost = 0.88;
    } else if (this.accessory === 'beret') {
        localX = Math.random() > 0.5 ? -0.22 : 0.22;
        localY = -0.97;
        skinOffset = -this.baseRadius * 0.006;
        scaleBoost = 1.0;
    } else if (this.accessory === 'ancient_rune' || this.accessory === 'gem_cluster') {
        localX = Math.random() > 0.5 ? -0.34 : 0.34;
        localY = -0.94;
        skinOffset = -this.baseRadius * 0.01;
        rotationOffset = localX < 0 ? -0.14 : 0.14;
        scaleBoost = 0.9;
    } else if (this.accessory === 'spirit_orbs') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.04;
        scaleBoost = 0.95;
    }
    // ── New scary accessories ────────────────────────────────────────────────
    else if (this.accessory === 'thorn_ring') {
        localX = 0;
        localY = -0.96;
        skinOffset = -this.baseRadius * 0.014;
        scaleBoost = 1.0;
    } else if (this.accessory === 'skull_pin' || this.accessory === 'bone_pin') {
        localX = Math.random() > 0.5 ? -0.3 : 0.3;
        localY = -0.92;
        skinOffset = -this.baseRadius * 0.01;
        rotationOffset = localX < 0 ? -0.16 : 0.16;
        scaleBoost = 0.94;
    } else if (this.accessory === 'iron_mask') {
        localX = 0;
        localY = -0.88;
        skinOffset = this.baseRadius * 0.01;
        scaleBoost = 1.02;
    } else if (this.accessory === 'eye_crown' || this.accessory === 'cursed_chain') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.008;
        scaleBoost = 1.0;
    } else if (this.accessory === 'demon_wings' || this.accessory === 'fairy_wings' || this.accessory === 'shadow_cloak') {
        localX = 0;
        localY = -0.78;
        skinOffset = this.baseRadius * 0.06;
        scaleBoost = 1.08;
    } else if (this.accessory === 'eldritch_eye') {
        localX = Math.random() > 0.5 ? -0.24 : 0.24;
        localY = -0.96;
        skinOffset = -this.baseRadius * 0.014;
        scaleBoost = 0.96;
    }
    // ── Physics accessories — attachment unused (physics system anchors directly)
    // but we return a valid default so drawAccessory() has a safe fallback.
    else if (this.accessory === 'silk_ribbon') {
        localX = 0.05;
        localY = -0.80;
        skinOffset = this.baseRadius * 0.08;
        scaleBoost = 1;
    } else if (this.accessory === 'spectral_tail') {
        localX = 0;
        localY = 0.92;
        skinOffset = this.baseRadius * 0.06;
        scaleBoost = 1;
    } else if (this.accessory === 'spring_antenna') {
        localX = 0;
        localY = -1;
        skinOffset = -this.baseRadius * 0.04;
        scaleBoost = 1;
    }
    
    const len = Math.hypot(localX, localY) || 1;
    return {
        localX: localX / len,
        localY: localY / len,
        skinOffset,
        rotationOffset,
        scaleBoost
    };
  };

  Slime.prototype.getSurfaceAnchorFromLocal = function(localDirX, localDirY, visualX, visualY, rotation) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const worldDirX = localDirX * cos - localDirY * sin;
    const worldDirY = localDirX * sin + localDirY * cos;
    return this.getSurfaceAnchor(worldDirX, worldDirY, visualX, visualY);
  };

  Slime.prototype.getSurfaceAnchor = function(directionX, directionY, visualX, visualY) {
    const dirLen = Math.hypot(directionX, directionY) || 1;
    const nx = directionX / dirLen;
    const ny = directionY / dirLen;
    
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < this.numNodes; i++) {
        const pt = this.nodes[i];
        const dx = pt.x - visualX;
        const dy = pt.y - visualY;
        const score = dx * nx + dy * ny;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    
    const prev = this.nodes[(bestIndex - 1 + this.numNodes) % this.numNodes];
    const current = this.nodes[bestIndex];
    const next = this.nodes[(bestIndex + 1) % this.numNodes];
    
    const anchorX = (prev.x + current.x + next.x) / 3;
    const anchorY = (prev.y + current.y + next.y) / 3;
    let tangentX = next.x - prev.x;
    let tangentY = next.y - prev.y;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    tangentX /= tangentLen;
    tangentY /= tangentLen;
    
    let normalX = anchorX - visualX;
    let normalY = anchorY - visualY;
    const normalLen = Math.hypot(normalX, normalY) || 1;
    normalX /= normalLen;
    normalY /= normalLen;
    
    return {
        x: anchorX,
        y: anchorY,
        tangentX,
        tangentY,
        normalX,
        normalY,
        rotation: Math.atan2(tangentY, tangentX)
    };
  };

  Slime.prototype.buildBodyPath = function() {
    ctx.beginPath();
    let startX = (this.nodes[0].x + this.nodes[this.numNodes - 1].x) / 2;
    let startY = (this.nodes[0].y + this.nodes[this.numNodes - 1].y) / 2;
    ctx.moveTo(startX, startY);
    
    for (let i = 0; i < this.numNodes; i++) {
        let nextNode = this.nodes[(i + 1) % this.numNodes];
        let mx = (this.nodes[i].x + nextNode.x) / 2;
        let my = (this.nodes[i].y + nextNode.y) / 2;
        ctx.quadraticCurveTo(this.nodes[i].x, this.nodes[i].y, mx, my);
    }
    ctx.closePath();
  };

}
