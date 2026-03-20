function getViewportSize(refs) {
    const viewport = window.visualViewport;
    const width = Math.max(Math.floor(viewport?.width || refs.shell?.clientWidth || window.innerWidth), 1);
    const height = Math.max(Math.floor(viewport?.height || refs.shell?.clientHeight || window.innerHeight), 1);
    return { width, height };
}

class DustParticle {
    constructor(width, height) {
        this.reset(width, height);
    }

    reset(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.2;
        this.velocityY = -Math.random() * 0.4;
        const a = Math.random() * 0.4;
        this.fillStyle = `rgba(16,185,129,${a.toFixed(3)})`;
    }

    update(width, height) {
        this.y += this.velocityY;
        if (this.y < 0) {
            this.reset(width, height);
            this.y = height + (Math.random() * 24);
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.fillStyle;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function createDustBackgroundController({ refs }) {
    const canvas = refs.dustCanvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const particles = [];
    let width = 0;
    let height = 0;
    let rafId = 0;
    let isRunning = false;

    function prefersReducedMotion() {
        return mediaQuery.matches;
    }

    function getParticleTarget() {
        if (prefersReducedMotion()) {
            return 0;
        }

        const area = width * height;
        if (area <= 0) {
            return 0;
        }

        return Math.min(40, Math.max(24, Math.round(area / 18000)));
    }

    function syncCanvasSize() {
        const viewport = getViewportSize(refs);
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        width = viewport.width;
        height = viewport.height;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const targetCount = getParticleTarget();
        if (particles.length > targetCount) {
            particles.length = targetCount;
        }
        while (particles.length < targetCount) {
            particles.push(new DustParticle(width, height));
        }
    }

    function frame() {
        ctx.clearRect(0, 0, width, height);
        for (const particle of particles) {
            particle.update(width, height);
            particle.draw(ctx);
        }
        rafId = window.requestAnimationFrame(frame);
    }

    function start() {
        isRunning = true;
        syncCanvasSize();
        if (!prefersReducedMotion() && rafId === 0) {
            rafId = window.requestAnimationFrame(frame);
        }
    }

    function stop() {
        isRunning = false;
        window.cancelAnimationFrame(rafId);
        rafId = 0;
    }

    function handleVisibilityChange() {
        if (document.hidden || !isRunning) {
            stop();
            return;
        }

        if (!prefersReducedMotion() && rafId === 0) {
            rafId = window.requestAnimationFrame(frame);
        }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return {
        start,
        stop,
        syncCanvasSize,
        destroy() {
            stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        },
    };
}
