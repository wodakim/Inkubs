import { ctx, viewportWidth, viewportHeight, particles, setCurrentSlime } from '../../../runtime/runtimeState.js';
import { Particle } from '../Particle.js';
import { recordSlimeEvent } from '../../lifecycle/livingState.js';

export function installInteraction(Slime) {
  Slime.prototype.checkGrab = function(x, y) {
    // Gaseous instable: untouchable when floating
    if (this.genome?.isInstable
        && this.genome.instabilityMass === 'gaseous'
        && !this._instableGrounded) return;

    let minDist = Infinity;
    let closestNode = null;
    for (let pt of this.nodes) {
        let d = Math.hypot(pt.x - x, pt.y - y);
        if (d < minDist) {
            minDist = d;
            closestNode = pt;
        }
    }

    if (minDist < this.baseRadius * 1.5) {
        this.draggedNode = closestNode;
        this.dragX = x;
        this.dragY = y;
        recordSlimeEvent(this, 'grab_start', { x, y, minDist }, { importance: 'routine' });
    }
  };

  Slime.prototype.updateGrab = function(x, y) {
    if (this.draggedNode) {
        this.dragX = x;
        this.dragY = y;
    }
  };

  Slime.prototype.releaseGrab = function() {
    if (this.draggedNode) {
        recordSlimeEvent(this, 'grab_release', { x: this.dragX, y: this.dragY }, { importance: 'routine' });
    }
    this.draggedNode = null;
  };

  Slime.prototype.explode = function() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    
    recordSlimeEvent(this, 'exploded', { reason: 'surface_integrity_failure' }, { importance: 'significant', persistLongTerm: true });

    for (let i = 0; i < 40; i++) {
        let sourceNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
        particles.push(new Particle(sourceNode.x, sourceNode.y, this.color));
    }
    setCurrentSlime(new this.constructor());
  };

}
