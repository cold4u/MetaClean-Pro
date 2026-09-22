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

class PinballEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        // Table viewport is 500x600 centered horizontally
        this.tableX = (this.width - 500) / 2;
        this.tableY = 0;
        this.tableW = 500;
        this.tableH = 600;

        this.gravity = 620;

        // Flippers
        this.leftFlipper = {
            x: this.tableX + 160,
            y: 530,
            length: 68,
            angle: 0.45,
            restAngle: 0.45,
            activeAngle: -0.45,
            angularVel: 0,
            isPressed: false
        };

        this.rightFlipper = {
            x: this.tableX + 300,
            y: 530,
            length: 68,
            angle: Math.PI - 0.45,
            restAngle: Math.PI - 0.45,
            activeAngle: Math.PI + 0.45,
            angularVel: 0,
            isPressed: false
        };

        // Plunger
        this.plunger = {
            x: this.tableX + 468,
            y: 540,
            charge: 0,
            isCharging: false
        };

        // Balls
        this.balls = [];
        this.ballsRemaining = 3;
        this.score = 0;
        this.highScore = 0;
        this.multiplier = 1;
        this.ballSaverTimer = 0;
        this.gameOver = false;

        // Playfield elements
        this.bumpers = [
            { x: this.tableX + 180, y: 190, r: 24, score: 100, flash: 0, color: '#00f0ff' },
            { x: this.tableX + 280, y: 190, r: 24, score: 100, flash: 0, color: '#00f0ff' },
            { x: this.tableX + 230, y: 130, r: 26, score: 250, flash: 0, color: '#ff007f' }
        ];

        this.dropTargets = [
            { x: this.tableX + 50, y: 240, w: 12, h: 26, active: true },
            { x: this.tableX + 50, y: 275, w: 12, h: 26, active: true },
            { x: this.tableX + 50, y: 310, w: 12, h: 26, active: true }
        ];

        this.rolloverLanes = [
            { x: this.tableX + 180, y: 65, w: 20, h: 10, lit: false, char: 'A' },
            { x: this.tableX + 230, y: 65, w: 20, h: 10, lit: false, char: 'G' },
            { x: this.tableX + 280, y: 65, w: 20, h: 10, lit: false, char: 'Y' }
        ];

        this.slingshots = [
            { p1: { x: this.tableX + 110, y: 410 }, p2: { x: this.tableX + 150, y: 480 }, nx: 0.86, ny: -0.5, flash: 0 },
            { p1: { x: this.tableX + 350, y: 410 }, p2: { x: this.tableX + 310, y: 480 }, nx: -0.86, ny: -0.5, flash: 0 }
        ];

        this.vaultLockedBalls = 0;
        this.particles = [];

        this.buildStaticWalls();
        this.spawnBall();
    }

    buildStaticWalls() {
        const tx = this.tableX;
        this.walls = [
            // Left boundary
            { p1: { x: tx + 40, y: 100 }, p2: { x: tx + 40, y: 480 } },
            // Right boundary separating plunger lane
            { p1: { x: tx + 445, y: 120 }, p2: { x: tx + 445, y: 560 } },
            // Right outer plunger wall
            { p1: { x: tx + 485, y: 100 }, p2: { x: tx + 485, y: 560 } },
            // Plunger bottom stop
            { p1: { x: tx + 445, y: 560 }, p2: { x: tx + 485, y: 560 } },
            // Inlane / Outlane guides
            { p1: { x: tx + 40, y: 480 }, p2: { x: tx + 140, y: 535 } },
            { p1: { x: tx + 445, y: 480 }, p2: { x: tx + 320, y: 535 } },
            // Left & right outlane divider posts
            { p1: { x: tx + 80, y: 460 }, p2: { x: tx + 80, y: 530 } },
            { p1: { x: tx + 380, y: 460 }, p2: { x: tx + 380, y: 530 } }
        ];
    }

    spawnBall() {
        if (this.ballsRemaining <= 0) {
            this.gameOver = true;
            return;
        }
        this.balls.push({
            x: this.tableX + 465,
            y: 520,
            vx: 0,
            vy: 0,
            radius: 8.5
        });
        this.ballSaverTimer = 12.0;
    }

    update(dt) {
        if (this.gameOver) return;

        // Ball saver timer
        if (this.ballSaverTimer > 0) {
            this.ballSaverTimer -= dt;
        }

        // Update flippers
        this.updateFlipper(this.leftFlipper, dt, true);
        this.updateFlipper(this.rightFlipper, dt, false);

        // Plunger charging
        if (this.plunger.isCharging) {
            this.plunger.charge = Math.min(1.0, this.plunger.charge + dt * 1.5);
        }

        // Update balls physics
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];

            // Gravity
            b.vy += this.gravity * dt;

            // Velocity clamp
            const speed = Math.hypot(b.vx, b.vy);
            if (speed > 1100) {
                b.vx = (b.vx / speed) * 1100;
                b.vy = (b.vy / speed) * 1100;
            }

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Top curved arch boundary
            const archCenterX = this.tableX + 245;
            const archCenterY = 120;
            const archRadius = 205;
            const dxArch = b.x - archCenterX;
            const dyArch = b.y - archCenterY;
            const distArch = Math.hypot(dxArch, dyArch);
            if (b.y < archCenterY && distArch > archRadius - b.radius) {
                // Collide with curved ceiling
                const nx = dxArch / distArch;
                const ny = dyArch / distArch;
                b.x = archCenterX + nx * (archRadius - b.radius);
                b.y = archCenterY + ny * (archRadius - b.radius);
                const dot = b.vx * nx + b.vy * ny;
                b.vx = (b.vx - 1.7 * dot * nx) * 0.85;
                b.vy = (b.vy - 1.7 * dot * ny) * 0.85;
            }

            // Collide with static walls
            for (const w of this.walls) {
                this.resolveLineCollision(b, w.p1, w.p2, 0.75);
            }

            // Collide with Bumpers
            for (const bmp of this.bumpers) {
                const dx = b.x - bmp.x;
                const dy = b.y - bmp.y;
                const dist = Math.hypot(dx, dy);
                if (dist < bmp.r + b.radius) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    b.x = bmp.x + nx * (bmp.r + b.radius);
                    b.y = bmp.y + ny * (bmp.r + b.radius);

                    // High impulse kick
                    b.vx = nx * 520;
                    b.vy = ny * 520;

                    bmp.flash = 0.25;
                    this.score += bmp.score * this.multiplier;
                    if (this.audio) this.audio.bumper();
                    this.spawnBumperSparks(bmp.x, bmp.y, bmp.color);
                }
                if (bmp.flash > 0) bmp.flash -= dt;
            }

            // Collide with Slingshots
            for (const sling of this.slingshots) {
                if (this.resolveLineCollision(b, sling.p1, sling.p2, 0.8)) {
                    b.vx += sling.nx * 420;
                    b.vy += sling.ny * 420;
                    sling.flash = 0.2;
                    this.score += 50 * this.multiplier;
                    if (this.audio) this.audio.slingshot();
                }
                if (sling.flash > 0) sling.flash -= dt;
            }

            // Collide with Drop Targets
            for (const dtg of this.dropTargets) {
                if (dtg.active && b.x - b.radius < dtg.x + dtg.w && b.x + b.radius > dtg.x &&
                    b.y - b.radius < dtg.y + dtg.h && b.y + b.radius > dtg.y) {
                    dtg.active = false;
                    b.vx = -b.vx * 0.8;
                    this.score += 200 * this.multiplier;
                    if (this.audio) this.audio.target();
                    this.checkDropTargets();
                }
            }

            // Check Rollover lanes
            for (const roll of this.rolloverLanes) {
                if (!roll.lit && Math.abs(b.x - roll.x) < roll.w / 2 && Math.abs(b.y - roll.y) < roll.h) {
                    roll.lit = true;
                    this.score += 150;
                    if (this.audio) this.audio.rollover();
                    this.checkRolloverLanes();
                }
            }

            // Collide with Flippers
            this.resolveFlipperCollision(b, this.leftFlipper);
            this.resolveFlipperCollision(b, this.rightFlipper);

            // Ball Draining check
            if (b.y > this.tableH + 20) {
                if (this.ballSaverTimer > 0) {
                    // Ball saved!
                    b.x = this.tableX + 465;
                    b.y = 520;
                    b.vx = 0;
                    b.vy = -600;
                    if (this.audio) this.audio.plungerRelease();
                } else {
                    // Remove drained ball
                    this.balls.splice(i, 1);
                    if (this.audio) this.audio.drain();

                    if (this.balls.length === 0) {
                        this.ballsRemaining--;
                        if (this.ballsRemaining > 0) {
                            setTimeout(() => this.spawnBall(), 600);
                        } else {
                            this.gameOver = true;
                            if (this.score > this.highScore) {
                                this.highScore = this.score;
                            }
                        }
                    }
                }
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

    updateFlipper(flipper, dt, isLeft) {
        const targetAngle = flipper.isPressed ? flipper.activeAngle : flipper.restAngle;
        const speed = 28; // radians / sec
        const diff = targetAngle - flipper.angle;
        if (Math.abs(diff) > 0.01) {
            const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
            flipper.angularVel = step / dt;
            flipper.angle += step;
        } else {
            flipper.angle = targetAngle;
            flipper.angularVel = 0;
        }
    }

    resolveFlipperCollision(ball, flipper) {
        const tipX = flipper.x + Math.cos(flipper.angle) * flipper.length;
        const tipY = flipper.y + Math.sin(flipper.angle) * flipper.length;

        const hit = this.resolveLineCollision(ball, { x: flipper.x, y: flipper.y }, { x: tipX, y: tipY }, 0.65);
        if (hit && Math.abs(flipper.angularVel) > 1) {
            // Apply upward impulse from flipper stroke
            const distFromPivot = Math.hypot(ball.x - flipper.x, ball.y - flipper.y);
            const leverage = Math.min(1.0, distFromPivot / flipper.length);
            const flipPower = Math.abs(flipper.angularVel) * leverage * 22;
            ball.vy -= flipPower;
            ball.vx += (flipper.angle < Math.PI / 2 ? 1 : -1) * flipPower * 0.4;
        }
    }

    resolveLineCollision(ball, p1, p2, restitution = 0.75) {
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

        if (dist < ball.radius && dist > 0.001) {
            const nx = distVecX / dist;
            const ny = distVecY / dist;

            // Reposition ball outside line
            ball.x = closeX + nx * ball.radius;
            ball.y = closeY + ny * ball.radius;

            // Reflect velocity
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx = (ball.vx - (1 + restitution) * dot * nx);
                ball.vy = (ball.vy - (1 + restitution) * dot * ny);
                return true;
            }
        }
        return false;
    }

    checkDropTargets() {
        if (this.dropTargets.every(t => !t.active)) {
            // All 3 targets down! Trigger Multiplier boost & Vault Unlock
            this.multiplier = Math.min(5, this.multiplier + 1);
            this.score += 1000 * this.multiplier;
            if (this.audio) this.audio.multiball();
            this.triggerVaultMultiball();
            setTimeout(() => {
                this.dropTargets.forEach(t => t.active = true);
            }, 3000);
        }
    }

    checkRolloverLanes() {
        if (this.rolloverLanes.every(l => l.lit)) {
            this.score += 2000 * this.multiplier;
            this.multiplier = Math.min(5, this.multiplier + 1);
            if (this.audio) this.audio.target();
            setTimeout(() => {
                this.rolloverLanes.forEach(l => l.lit = false);
            }, 1000);
        }
    }

    triggerVaultMultiball() {
        // Spawn 2 extra balls if less than 3 on table
        while (this.balls.length < 3) {
            this.balls.push({
                x: this.tableX + 230 + (Math.random() * 40 - 20),
                y: 200,
                vx: (Math.random() - 0.5) * 300,
                vy: -350,
                radius: 8.5
            });
        }
        this.ballSaverTimer = 15.0;
    }

    pressLeftFlipper() {
        this.leftFlipper.isPressed = true;
        if (this.audio) this.audio.flipper();
    }

    releaseLeftFlipper() {
        this.leftFlipper.isPressed = false;
    }

    pressRightFlipper() {
        this.rightFlipper.isPressed = true;
        if (this.audio) this.audio.flipper();
    }

    releaseRightFlipper() {
        this.rightFlipper.isPressed = false;
    }

    chargePlunger() {
        this.plunger.isCharging = true;
    }

    releasePlunger() {
        if (!this.plunger.isCharging) return;
        this.plunger.isCharging = false;
        const power = this.plunger.charge * 750 + 200;
        this.plunger.charge = 0;

        // Find ball in plunger lane
        const pBall = this.balls.find(b => b.x > this.tableX + 445 && b.y > 450);
        if (pBall) {
            pBall.vy = -power;
            if (this.audio) this.audio.plungerRelease();
        }
    }

    spawnBumperSparks(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                color,
                life: 0.3,
                maxLife: 0.3
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

        // Side Panels (Scores, Stats, Instructions)
        this.renderSidePanels(ctx);

        // Pinball Table Board
        ctx.save();
        ctx.fillStyle = '#0a0e17';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff55';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.roundRect(this.tableX + 35, 10, this.tableW - 40, this.tableH - 20, 16);
        ctx.fill();
        ctx.stroke();

        // Top Arch Ceiling
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.tableX + 245, 120, 205, Math.PI, 0, false);
        ctx.stroke();

        // Static Walls
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        for (const w of this.walls) {
            ctx.beginPath();
            ctx.moveTo(w.p1.x, w.p1.y);
            ctx.lineTo(w.p2.x, w.p2.y);
            ctx.stroke();
        }

        // Pop Bumpers
        for (const bmp of this.bumpers) {
            ctx.fillStyle = bmp.flash > 0 ? '#ffffff' : bmp.color;
            ctx.shadowColor = bmp.color;
            ctx.shadowBlur = bmp.flash > 0 ? 25 : 12;
            ctx.beginPath();
            ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0d1117';
            ctx.beginPath();
            ctx.arc(bmp.x, bmp.y, bmp.r * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Slingshots
        for (const s of this.slingshots) {
            ctx.strokeStyle = s.flash > 0 ? '#ffffff' : '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = s.flash > 0 ? 15 : 6;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(s.p1.x, s.p1.y);
            ctx.lineTo(s.p2.x, s.p2.y);
            ctx.stroke();
        }

        // Drop Targets
        for (const dtg of this.dropTargets) {
            if (dtg.active) {
                ctx.fillStyle = '#ffe600';
                ctx.shadowColor = '#ffe600';
                ctx.shadowBlur = 8;
                ctx.fillRect(dtg.x, dtg.y, dtg.w, dtg.h);
            }
        }

        // Rollover Lanes
        for (const roll of this.rolloverLanes) {
            ctx.fillStyle = roll.lit ? '#ffe600' : '#334155';
            ctx.shadowColor = roll.lit ? '#ffe600' : '#000000';
            ctx.shadowBlur = roll.lit ? 12 : 0;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(roll.char, roll.x, roll.y + 12);
        }

        // Flippers
        this.renderFlipper(ctx, this.leftFlipper, '#00f0ff');
        this.renderFlipper(ctx, this.rightFlipper, '#00f0ff');

        // Plunger spring visual
        const plungerY = this.plunger.y + this.plunger.charge * 30;
        ctx.fillStyle = '#ff007f';
        ctx.fillRect(this.plunger.x - 8, plungerY, 16, 12);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.plunger.x, 560);
        ctx.lineTo(this.plunger.x, plungerY + 12);
        ctx.stroke();

        // Balls
        for (const b of this.balls) {
            ctx.fillStyle = '#f8fafc';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Ball Saver Laser Bar if active
        if (this.ballSaverTimer > 0) {
            ctx.strokeStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.tableX + 140, 535);
            ctx.lineTo(this.tableX + 320, 535);
            ctx.stroke();

            ctx.fillStyle = '#39ff14';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`BALL SAVER: ${this.ballSaverTimer.toFixed(1)}s`, this.tableX + 230, 525);
        }

        ctx.restore();

        // Overlays
        if (this.gameOver) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '20px monospace';
            ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
            ctx.fillText(`High Score: ${this.highScore}`, this.width / 2, this.height / 2 + 45);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Press SPACE to Insert Coin & Play Again', this.width / 2, this.height / 2 + 85);
            ctx.restore();
        }
    }

    renderFlipper(ctx, flipper, color) {
        ctx.save();
        ctx.translate(flipper.x, flipper.y);
        ctx.rotate(flipper.angle);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(0, -6, flipper.length, 12, 6);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderSidePanels(ctx) {
        // Left Info Panel
        ctx.save();
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(20, 20, 110, 180, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('SCORE', 32, 40);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`${this.score}`, 32, 65);

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('BALLS', 32, 95);
        ctx.fillStyle = '#ff007f';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`${this.ballsRemaining}`, 32, 125);

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('MULTIPLIER', 32, 150);
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`${this.multiplier}X`, 32, 175);

        // Right Info Panel
        ctx.beginPath();
        ctx.roundRect(this.width - 130, 20, 110, 100, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('HIGH SCORE', this.width - 118, 40);
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`${this.highScore}`, this.width - 118, 65);

        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PinballEngine };
}
