import { worldWidth, worldHeight } from '../../runtime/runtimeState.js';
import { applyCanonicalClaim, buildCanonicalClaimPayload, buildCanonicalSnapshot } from '../canonical/canonicalRecord.js';
import { appendMemoryEcho, captureLivingStateSnapshot, recordSlimeEvent } from '../lifecycle/livingState.js';
import { buildProceduralBlueprint } from '../genetics/proceduralBlueprint.js';
import { VerletPoint } from '../physics/VerletPoint.js';
import { installPhysics } from './slime/installPhysics.js';
import { installAnimation } from './slime/installAnimation.js';
import { installGeometry } from './slime/installGeometry.js';
import { installRender } from './slime/installRender.js';
import { installInteraction } from './slime/installInteraction.js';

export class Slime {
  constructor(options = {}) {
    const blueprint = options.blueprint || buildProceduralBlueprint(options);

    this.identity = blueprint.identity;
    this.type = blueprint.type;
    this.baseRadius = blueprint.baseRadius;
    this.numNodes = blueprint.numNodes;
    this.genome = blueprint.genome;
    this.stats = blueprint.stats;
    this.bodyProfile = blueprint.bodyProfile;
    this.livingState = blueprint.livingState;

    const genome = this.genome;
    this.hue = genome.hue;
    this.saturation = genome.saturation;
    this.lightness = genome.lightness;
    this.bodyShape = genome.bodyShape;
    this.eyeStyle = genome.eyeStyle;
    this.mouthStyle = genome.mouthStyle;
    this.mood = genome.mood;
    this.accessory = genome.accessory;
    this.detailTrait = genome.detailTrait;
    this.friction = genome.friction;
    this.rigidity = genome.rigidity;
    this.bounceDamping = genome.bounceDamping;
    this.surfaceSmoothness = genome.surfaceSmoothness;
    this.volumeBias = genome.volumeBias;
    this.faceScale = genome.faceScale;
    this.eyeSpacingBias = genome.eyeSpacingBias;
    this.eyeSizeBias = genome.eyeSizeBias;
    this.mouthOffsetY = genome.mouthOffsetY;
    this.cheekIntensity = genome.cheekIntensity;
    this.accessorySizeBias = genome.accessorySizeBias;
    this.color = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
    this.darkColor = `hsl(${this.hue}, ${Math.max(35, this.saturation - 8)}%, ${Math.max(12, this.lightness - 16)}%)`;
    this.highlightColor = `hsla(${this.hue}, ${Math.max(30, this.saturation - 10)}%, ${Math.min(96, this.lightness + 18)}%, 0.32)`;
    this.colorPattern = genome.colorPattern || 'solid';
    this.rarityTier  = genome.rarityTier  || 'common';
    this.rarityScore = genome.rarityScore || 0;

    // Fallback safe values for visual properties
    if (!this.eyeStyle || typeof this.eyeStyle !== 'string') this.eyeStyle = 'dot';
    if (!this.mouthStyle || typeof this.mouthStyle !== 'string') this.mouthStyle = 'smile';

    this.friction = Number.isFinite(this.friction) ? this.friction : 0.96;
    this.rigidity = Number.isFinite(this.rigidity) ? Math.max(0.02, this.rigidity) : 0.08;
    this.bounceDamping = Number.isFinite(this.bounceDamping) ? this.bounceDamping : 0.2;
    this.surfaceSmoothness = Number.isFinite(this.surfaceSmoothness) ? this.surfaceSmoothness : 0.035;
    this.volumeBias = Number.isFinite(this.volumeBias) ? this.volumeBias : 1;
    this.faceScale = Number.isFinite(this.faceScale) ? this.faceScale : 1;
    this.eyeSpacingBias = Number.isFinite(this.eyeSpacingBias) ? this.eyeSpacingBias : 0;
    this.eyeSizeBias = Number.isFinite(this.eyeSizeBias) ? this.eyeSizeBias : 0;
    this.mouthOffsetY = Number.isFinite(this.mouthOffsetY) ? this.mouthOffsetY : 0;
    this.cheekIntensity = Number.isFinite(this.cheekIntensity) ? this.cheekIntensity : 0.5;
    this.accessorySizeBias = Number.isFinite(this.accessorySizeBias) ? this.accessorySizeBias : 1;

    this.accessoryAttachment = this.createAccessoryAttachment();
    this.nextBlink = Date.now() + Math.random() * 4000 + 1000;
    this.isBlinking = false;

    const startX = Number.isFinite(options.spawnX) ? options.spawnX : (worldWidth / 2);
    const startY = Number.isFinite(options.spawnY) ? options.spawnY : (worldHeight / 2);
    const spawnImpulseY = Number.isFinite(options.spawnImpulseY) ? options.spawnImpulseY : ((Math.random() - 0.5) * 4);
    const spawnImpulseX = Number.isFinite(options.spawnImpulseX) ? options.spawnImpulseX : 0;

    this.nodes = [];
    this.visualCenterX = startX;
    this.visualCenterY = startY;
    this.prevVisualCenterX = startX - spawnImpulseX;
    this.prevVisualCenterY = startY - spawnImpulseY;
    this.targetDistances = [];

    for (let i = 0; i < this.numNodes; i++) {
      const angle = (i / this.numNodes) * Math.PI * 2;
      const r = this.bodyProfile?.radii?.[i] ?? this.baseRadius;
      const nx = startX + Math.cos(angle) * r;
      const ny = startY + Math.sin(angle) * r;
      const pt = new VerletPoint(nx, ny);
      pt.oldX = nx - spawnImpulseX;
      pt.oldY = ny - spawnImpulseY;
      this.nodes.push(pt);
      this.targetDistances.push(r);
    }

    const n1 = this.nodes[0];
    const n2 = this.nodes[1];
    this.perimeterDist = Math.hypot(n2.x - n1.x, n2.y - n1.y);

    const initialCenter = this.getRawVisualCenter();
    const shiftX = startX - initialCenter.x;
    const shiftY = startY - initialCenter.y;
    if (Number.isFinite(shiftX) && Number.isFinite(shiftY)) {
      for (const pt of this.nodes) {
        pt.x += shiftX;
        pt.y += shiftY;
        pt.oldX += shiftX;
        pt.oldY += shiftY;
      }
      this.visualCenterX = startX;
      this.visualCenterY = startY;
      this.prevVisualCenterX = startX - spawnImpulseX;
      this.prevVisualCenterY = startY - spawnImpulseY;
    }

    this.state = 'bouncing';
    this.age = 0;
    this.draggedNode = null;
    this.surfaceIntegrityExplosionEnabled = options.surfaceIntegrityExplosionEnabled !== false;
    this.boxPadding = Number.isFinite(options.boxPadding) ? Math.max(0, options.boxPadding) : Math.max(22, Math.min(worldWidth, worldHeight) * 0.04);
    this.worldBounds = options.worldBounds && typeof options.worldBounds === 'object' ? {
      left: Number.isFinite(options.worldBounds.left) ? options.worldBounds.left : null,
      top: Number.isFinite(options.worldBounds.top) ? options.worldBounds.top : null,
      right: Number.isFinite(options.worldBounds.right) ? options.worldBounds.right : null,
      bottom: Number.isFinite(options.worldBounds.bottom) ? options.worldBounds.bottom : null,
    } : null;
    this.groundVelocityRetention = 0.08;
    this.staticFrictionVelocityThreshold = 0.32;
    this.groundStickRetention = 0.0;

    this.moveAcceleration = 0.34;
    this.maxMoveSpeed = 6.4;
    this.airControlFactor = 0.38;
    this.jumpImpulse = 12.5;
    this.jumpCooldownFrames = 0;
    this.selfRightingStrength = 0.0072;
    this.selfRightingDamping = 0.058;
    this.prevBodyRotation = 0;
    this.idleFrames = 0;
    this.idleRecoveryDelayFrames = 52;
    this.idleRecoveryHopCooldownFrames = 24;
    this.lastIdleRecoveryHopFrame = -9999;

    this.animSeed = Math.random() * 1000;
    this.facing = Math.random() > 0.5 ? 1 : -1;
    this.moveCycle = Math.random() * Math.PI * 2;
    this.idleCycle = Math.random() * Math.PI * 2;
    this.observeCycle = Math.random() * Math.PI * 2;
    this.jumpLift = 0;
    this.landingPulse = 0;
    this.locomotionState = 'idle';
    this.actionState = 'none';
    this.actionUntil = 0;
    this.actionIntensity = 0;
    this.actionBlend = 0;
    this.faceLookX = 0;
    this.faceLookY = 0;
    this.lastGroundedRatio = 0;
    this.lastAverageVelocityX = 0;
    this.lastAverageVelocityY = 0;
    this.renderPose = { scaleX: 1, scaleY: 1, skewX: 0, liftY: 0, roll: 0, shadowX: 1, shadowY: 1, shadowAlphaBoost: 0 };
    this.faceAnimation = { lookBiasX: 0, lookBiasY: 0, eyeScaleX: 1, eyeScaleY: 1, mouthScaleX: 1, mouthScaleY: 1, mouthShiftY: 0, browLift: 0, browTilt: 0, faceOffsetY: 0, jitterX: 0, jitterY: 0, overrideEyeStyle: null, overrideMouthStyle: null, symbol: null, symbolAlpha: 0 };

    recordSlimeEvent(this, 'spawned', {
      type: this.type,
      bodyShape: this.bodyShape,
      proceduralSeed: this.identity?.proceduralSeed || null
    }, { importance: 'significant', persistLongTerm: true });
  }

  isCanonical() {
    return this.identity.canonical.status === 'claimed' && !!this.identity.canonical.canonicalId;
  }

  exportCanonicalSnapshot() {
    return buildCanonicalSnapshot(this);
  }

  exportLivingStateSnapshot() {
    return captureLivingStateSnapshot(this);
  }

  exportCanonicalClaimPayload(options = {}) {
    return buildCanonicalClaimPayload(this, options);
  }

  recordEvent(eventType, payload = {}, options = {}) {
    return recordSlimeEvent(this, eventType, payload, options);
  }

  remember(kind, payload = {}, options = {}) {
    appendMemoryEcho(this, kind, payload, options);
  }

  bindCanonicalClaim(canonicalRecord) {
    return applyCanonicalClaim(this, canonicalRecord);
  }
}


installPhysics(Slime);
installAnimation(Slime);
installGeometry(Slime);
installRender(Slime);
installInteraction(Slime);
