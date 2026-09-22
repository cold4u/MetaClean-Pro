// Polyfill roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        if (!radii) radii = 0;
        if (typeof radii === 'number') radii = [radii, radii, radii, radii];
        const [tl, tr, br, bl] = radii;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x, y + tl);
        this.closePath();
        return this;
    };
}

class GolfEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        // Ball physics
        this.ball = {
            x: 150,
            y: 300,
            vx: 0,
            vy: 0,
            radius: 7.5,
            lastTeeX: 150,
            lastTeeY: 300
        };

        this.friction = 0.985;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragCurrent = { x: 0, y: 0 };

        // 9 Holes Definition
        this.currentHoleIndex = 0;
        this.totalHoles = 9;
        this.holes = this.createHoles();

        // Game State & Scorecard
        this.strokesThisHole = 0;
        this.totalStrokes = 0;
        this.scorecard = [];
        this.holeCompleted = false;
        this.victory = false;

        this.particles = [];
        this.loadHole(0);
    }

    createHoles() {
        return [
            // Hole 1: Neon Straightway
            {
                name: "Neon Straightway", par: 2,
                tee: { x: 120, y: 300 }, cup: { x: 680, y: 300 },
                walls: [
                    { p1: { x: 60, y: 200 }, p2: { x: 740, y: 200 } },
                    { p1: { x: 740, y: 200 }, p2: { x: 740, y: 400 } },
                    { p1: { x: 740, y: 400 }, p2: { x: 60, y: 400 } },
                    { p1: { x: 60, y: 400 }, p2: { x: 60, y: 200 } }
                ],
                boosters: [], wormholes: [], bumpers: [], vortex: null
            },
            // Hole 2: Cyber Chicane
            {
                name: "Cyber Chicane", par: 3,
                tee: { x: 120, y: 450 }, cup: { x: 680, y: 150 },
                walls: [
                    { p1: { x: 60, y: 100 }, p2: { x: 740, y: 100 } },
                    { p1: { x: 740, y: 100 }, p2: { x: 740, y: 500 } },
                    { p1: { x: 740, y: 500 }, p2: { x: 60, y: 500 } },
                    { p1: { x: 60, y: 500 }, p2: { x: 60, y: 100 } },
                    // Center chicane divider walls
                    { p1: { x: 300, y: 100 }, p2: { x: 300, y: 360 } },
                    { p1: { x: 500, y: 240 }, p2: { x: 500, y: 500 } }
                ],
                boosters: [], wormholes: [], bumpers: [], vortex: null
            },
            // Hole 3: Quantum Teleporter
            {
                name: "Quantum Teleporter", par: 2,
                tee: { x: 120, y: 300 }, cup: { x: 680, y: 300 },
                walls: [
                    { p1: { x: 60, y: 180 }, p2: { x: 740, y: 180 } },
                    { p1: { x: 740, y: 180 }, p2: { x: 740, y: 420 } },
                    { p1: { x: 740, y: 420 }, p2: { x: 60, y: 420 } },
                    { p1: { x: 60, y: 420 }, p2: { x: 60, y: 180 } },
                    // Impassable void barrier
                    { p1: { x: 380, y: 180 }, p2: { x: 380, y: 420 } }
                ],
                boosters: [],
                wormholes: [{ in: { x: 320, y: 300 }, out: { x: 480, y: 300 } }],
                bumpers: [], vortex: null
            },
            // Hole 4: Speed Booster Funnel
            {
                name: "Speed Booster Funnel", par: 3,
                tee: { x: 100, y: 300 }, cup: { x: 700, y: 300 },
                walls: [
                    { p1: { x: 60, y: 160 }, p2: { x: 740, y: 160 } },
                    { p1: { x: 740, y: 160 }, p2: { x: 740, y: 440 } },
                    { p1: { x: 740, y: 440 }, p2: { x: 60, y: 440 } },
                    { p1: { x: 60, y: 440 }, p2: { x: 60, y: 160 } }
                ],
                boosters: [{ x: 320, y: 250, w: 80, h: 100, boostVx: 450, boostVy: 0 }],
                wormholes: [], bumpers: [], vortex: null
            },
            // Hole 5: Kinetic Bumpers
            {
                name: "Kinetic Bumpers", par: 3,
                tee: { x: 100, y: 300 }, cup: { x: 690, y: 300 },
                walls: [
                    { p1: { x: 60, y: 140 }, p2: { x: 740, y: 140 } },
                    { p1: { x: 740, y: 140 }, p2: { x: 740, y: 460 } },
                    { p1: { x: 740, y: 460 }, p2: { x: 60, y: 460 } },
                    { p1: { x: 60, y: 460 }, p2: { x: 60, y: 140 } }
                ],
                boosters: [], wormholes: [],
                bumpers: [
                    { x: 300, y: 220, r: 24 },
                    { x: 300, y: 380, r: 24 },
                    { x: 480, y: 300, r: 28 }
                ],
                vortex: null
            },
            // Hole 6: Dual Path Split
            {
                name: "Dual Path Split", par: 3,
                tee: { x: 100, y: 300 }, cup: { x: 700, y: 300 },
                walls: [
                    { p1: { x: 60, y: 120 }, p2: { x: 740, y: 120 } },
                    { p1: { x: 740, y: 120 }, p2: { x: 740, y: 480 } },
                    { p1: { x: 740, y: 480 }, p2: { x: 60, y: 480 } },
                    { p1: { x: 60, y: 480 }, p2: { x: 60, y: 120 } },
                    // Central island
                    { p1: { x: 260, y: 250 }, p2: { x: 500, y: 250 } },
                    { p1: { x: 500, y: 250 }, p2: { x: 500, y: 350 } },
                    { p1: { x: 500, y: 350 }, p2: { x: 260, y: 350 } },
                    { p1: { x: 260, y: 350 }, p2: { x: 260, y: 250 } }
                ],
                boosters: [{ x: 340, y: 150, w: 60, h: 60, boostVx: 300, boostVy: 0 }],
                wormholes: [], bumpers: [], vortex: null
            },
            // Hole 7: Laser Gate
            {
                name: "Laser Gate", par: 3,
                tee: { x: 100, y: 300 }, cup: { x: 680, y: 300 },
                walls: [
                    { p1: { x: 60, y: 140 }, p2: { x: 740, y: 140 } },
                    { p1: { x: 740, y: 140 }, p2: { x: 740, y: 460 } },
                    { p1: { x: 740, y: 460 }, p2: { x: 60, y: 460 } },
                    { p1: { x: 60, y: 460 }, p2: { x: 60, y: 140 } }
                ],
                boosters: [], wormholes: [],
                bumpers: [{ x: 400, y: 200, r: 20 }, { x: 400, y: 400, r: 20 }],
                vortex: null
            },
            // Hole 8: The S-Curve
            {
                name: "The S-Curve", par: 3,
                tee: { x: 100, y: 180 }, cup: { x: 700, y: 420 },
                walls: [
                    { p1: { x: 60, y: 120 }, p2: { x: 740, y: 120 } },
                    { p1: { x: 740, y: 120 }, p2: { x: 740, y: 480 } },
                    { p1: { x: 740, y: 480 }, p2: { x: 60, y: 480 } },
                    { p1: { x: 60, y: 480 }, p2: { x: 60, y: 120 } },
                    { p1: { x: 300, y: 120 }, p2: { x: 300, y: 320 } },
                    { p1: { x: 500, y: 280 }, p2: { x: 500, y: 480 } }
                ],
                boosters: [], wormholes: [], bumpers: [], vortex: null
            },
            // Hole 9: Singularity Vortex
            {
                name: "The Singularity", par: 4,
                tee: { x: 100, y: 300 }, cup: { x: 680, y: 300 },
                walls: [
                    { p1: { x: 60, y: 120 }, p2: { x: 740, y: 120 } },
                    { p1: { x: 740, y: 120 }, p2: { x: 740, y: 480 } },
                    { p1: { x: 740, y: 480 }, p2: { x: 60, y: 480 } },
                    { p1: { x: 60, y: 480 }, p2: { x: 60, y: 120 } }
                ],
                boosters: [], wormholes: [], bumpers: [],
                vortex: { x: 450, y: 300, pull: 320, r: 120 }
            }
        ];
    }

    loadHole(index) {
        this.currentHoleIndex = index;
        const h = this.holes[index];
        this.ball.x = h.tee.x;
        this.ball.y = h.tee.y;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.lastTeeX = h.tee.x;
        this.ball.lastTeeY = h.tee.y;
        this.strokesThisHole = 0;
        this.holeCompleted = false;
    }

    isBallStopped() {
        return Math.hypot(this.ball.vx, this.ball.vy) < 1.5;
    }

    putt(impulseX, impulseY) {
        if (!this.isBallStopped() || this.holeCompleted) return;

        this.ball.vx = impulseX;
        this.ball.vy = impulseY;
        this.strokesThisHole++;
        this.totalStrokes++;

        const powerNorm = Math.min(1.0, Math.hypot(impulseX, impulseY) / 600);
        if (this.audio) this.audio.putt(powerNorm);
    }

    update(dt) {
        if (this.holeCompleted || this.victory) return;

        const b = this.ball;
        const curHole = this.holes[this.currentHoleIndex];

        // Gravitational vortex pull
        if (curHole.vortex) {
            const dx = curHole.vortex.x - b.x;
            const dy = curHole.vortex.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < curHole.vortex.r && dist > 5) {
                const pullForce = (1 - dist / curHole.vortex.r) * curHole.vortex.pull;
                b.vx += (dx / dist) * pullForce * dt;
                b.vy += (dy / dist) * pullForce * dt;
            }
        }

        // Sub-stepping for physics accuracy
        const steps = 4;
        const subDt = dt / steps;

        for (let s = 0; s < steps; s++) {
            b.x += b.vx * subDt;
            b.y += b.vy * subDt;

            b.vx *= Math.pow(this.friction, subDt * 60);
            b.vy *= Math.pow(this.friction, subDt * 60);

            if (Math.hypot(b.vx, b.vy) < 1.5) {
                b.vx = 0;
                b.vy = 0;
            }

            // Wall Collisions
            for (const w of curHole.walls) {
                if (this.resolveLineCollision(b, w.p1, w.p2, 0.78)) {
                    if (this.audio && Math.hypot(b.vx, b.vy) > 40) this.audio.wallBounce();
                }
            }

            // Pop Bumper Collisions
            for (const bmp of curHole.bumpers) {
                const dx = b.x - bmp.x;
                const dy = b.y - bmp.y;
                const dist = Math.hypot(dx, dy);
                if (dist < bmp.r + b.radius) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    b.vx = nx * 450;
                    b.vy = ny * 450;
                    if (this.audio) this.audio.wallBounce();
                    this.spawnParticles(bmp.x, bmp.y, '#ff007f', 8);
                }
            }

            // Speed Boosters
            for (const bst of curHole.boosters) {
                if (b.x > bst.x && b.x < bst.x + bst.w && b.y > bst.y && b.y < bst.y + bst.h) {
                    b.vx += bst.boostVx * subDt * 10;
                    b.vy += bst.boostVy * subDt * 10;
                    if (this.audio && Math.random() < 0.2) this.audio.booster();
                }
            }

            // Wormholes
            for (const wh of curHole.wormholes) {
                const distIn = Math.hypot(b.x - wh.in.x, b.y - wh.in.y);
                if (distIn < 18) {
                    b.x = wh.out.x;
                    b.y = wh.out.y;
                    if (this.audio) this.audio.wormhole();
                    this.spawnParticles(wh.out.x, wh.out.y, '#a855f7', 12);
                }
            }

            // Cup detection
            const distCup = Math.hypot(b.x - curHole.cup.x, b.y - curHole.cup.y);
            if (distCup < 14 && Math.hypot(b.vx, b.vy) < 220) {
                this.handleHoleInCup();
                break;
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    resolveLineCollision(ball, p1, p2, restitution = 0.78) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return false;

        let u = ((ball.x - p1.x) * dx + (ball.y - p1.y) * dy) / lenSq;
        u = Math.max(0, Math.min(1, u));

        const closeX = p1.x + u * dx;
        const closeY = p1.y + u * dy;

        const distVecX = ball.x - closeX;
        const distVecY = ball.y - closeY;
        const dist = Math.hypot(distVecX, distVecY);

        if (dist < ball.radius && dist > 0.0001) {
            const nx = distVecX / dist;
            const ny = distVecY / dist;

            ball.x = closeX + nx * ball.radius;
            ball.y = closeY + ny * ball.radius;

            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - (1 + restitution) * dot * nx);
                ball.vy = (ball.vy - (1 + restitution) * dot * ny);
                return true;
            }
        }
        return false;
    }

    handleHoleInCup() {
        this.holeCompleted = true;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.x = this.holes[this.currentHoleIndex].cup.x;
        this.ball.y = this.holes[this.currentHoleIndex].cup.y;

        if (this.audio) this.audio.cupIn();
        this.spawnParticles(this.ball.x, this.ball.y, '#39ff14', 16);

        this.scorecard.push({
            hole: this.currentHoleIndex + 1,
            par: this.holes[this.currentHoleIndex].par,
            strokes: this.strokesThisHole
        });

        setTimeout(() => {
            if (this.currentHoleIndex + 1 < this.totalHoles) {
                this.loadHole(this.currentHoleIndex + 1);
            } else {
                this.victory = true;
                if (this.audio) this.audio.victory();
            }
        }, 1200);
    }

    spawnParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                color,
                life: 0.35,
                maxLife: 0.35
            });
        }
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Backdrop
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Top Course Header & Scorecard
        this.renderHUD(ctx);

        const curHole = this.holes[this.currentHoleIndex];

        // Green Grass / Cyber Turf
        ctx.fillStyle = '#06131d';
        ctx.fillRect(60, 100, 680, 400);

        // Boosters
        for (const bst of curHole.boosters) {
            ctx.fillStyle = '#00f0ff33';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.fillRect(bst.x, bst.y, bst.w, bst.h);
            ctx.strokeRect(bst.x, bst.y, bst.w, bst.h);
            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('>> >>', bst.x + 12, bst.y + bst.h / 2 + 5);
        }

        // Wormholes
        for (const wh of curHole.wormholes) {
            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(wh.in.x, wh.in.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(wh.out.x, wh.out.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Vortex
        if (curHole.vortex) {
            ctx.strokeStyle = '#a855f755';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(curHole.vortex.x, curHole.vortex.y, curHole.vortex.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Walls
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        for (const w of curHole.walls) {
            ctx.beginPath();
            ctx.moveTo(w.p1.x, w.p1.y);
            ctx.lineTo(w.p2.x, w.p2.y);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Bumpers
        for (const bmp of curHole.bumpers) {
            ctx.fillStyle = '#ff007f';
            ctx.shadowColor = '#ff007f';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Cup (Hole)
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(curHole.cup.x, curHole.cup.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Flag
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(curHole.cup.x, curHole.cup.y);
        ctx.lineTo(curHole.cup.x, curHole.cup.y - 30);
        ctx.stroke();
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(curHole.cup.x, curHole.cup.y - 30);
        ctx.lineTo(curHole.cup.x + 14, curHole.cup.y - 24);
        ctx.lineTo(curHole.cup.x, curHole.cup.y - 18);
        ctx.fill();

        // Ball
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Drag Aim Arrow
        if (this.isDragging && this.isBallStopped()) {
            this.renderAimArrow(ctx);
        }

        // Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Overlays
        this.renderOverlays(ctx);
    }

    renderAimArrow(ctx) {
        const dx = this.dragStart.x - this.dragCurrent.x;
        const dy = this.dragStart.y - this.dragCurrent.y;
        const power = Math.min(600, Math.hypot(dx, dy) * 4.5);
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(this.ball.x, this.ball.y);
        ctx.lineTo(this.ball.x + Math.cos(angle) * (power * 0.25), this.ball.y + Math.sin(angle) * (power * 0.25));
        ctx.stroke();

        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${Math.round((power / 600) * 100)}%`, this.ball.x + 15, this.ball.y - 15);
        ctx.restore();
    }

    renderHUD(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(60, 20, 680, 65, 8);
        ctx.fill();
        ctx.stroke();

        const curHole = this.holes[this.currentHoleIndex];
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`HOLE ${this.currentHoleIndex + 1} OF ${this.totalHoles}: ${curHole.name.toUpperCase()}`, 80, 48);

        ctx.fillStyle = '#8b949e';
        ctx.font = '12px sans-serif';
        ctx.fillText(`PAR: ${curHole.par}  |  STROKES: ${this.strokesThisHole}  |  TOTAL STROKES: ${this.totalStrokes}`, 80, 72);

        ctx.restore();
    }

    renderOverlays(ctx) {
        if (this.victory) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.9)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = '#ffe600';
            ctx.shadowColor = '#ffe600';
            ctx.shadowBlur = 25;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("COURSE COMPLETED! ⛳", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '20px sans-serif';
            ctx.fillText(`Total Strokes: ${this.totalStrokes} (Par 26)`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Click or press SPACE to Tee Off Again', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GolfEngine };
}
