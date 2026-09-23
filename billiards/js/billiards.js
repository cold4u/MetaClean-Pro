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

class BilliardsEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        // Table bounds
        this.table = {
            x: 50,
            y: 110,
            w: 700,
            h: 380,
            rail: 28,
            get left() { return this.x + this.rail; },
            get right() { return this.x + this.w - this.rail; },
            get top() { return this.y + this.rail; },
            get bottom() { return this.y + this.h - this.rail; }
        };

        this.ballRadius = 11;
        this.friction = 0.988;

        // 6 Pockets
        this.pocketRadius = 22;
        this.pockets = [
            { x: this.table.left + 2, y: this.table.top + 2 },
            { x: this.table.x + this.table.w / 2, y: this.table.top - 2 },
            { x: this.table.right - 2, y: this.table.top + 2 },
            { x: this.table.left + 2, y: this.table.bottom - 2 },
            { x: this.table.x + this.table.w / 2, y: this.table.bottom + 2 },
            { x: this.table.right - 2, y: this.table.bottom - 2 }
        ];

        // Balls
        this.balls = [];
        this.cueBall = null;

        // Aiming & Cue Stick
        this.aimAngle = 0;
        this.power = 0;
        this.isAiming = false;
        this.maxPower = 1300;

        // Game State
        this.score = 0;
        this.shotsTaken = 0;
        this.ballsPocketedCount = 0;
        this.foulMessage = "";
        this.foulTimer = 0;
        this.gameOver = false;
        this.victory = false;

        this.initRack();
    }

    initRack() {
        this.balls = [];

        // Cue ball (White)
        this.cueBall = {
            id: 0,
            x: this.table.x + 180,
            y: this.table.y + this.table.h / 2,
            vx: 0,
            vy: 0,
            color: '#f8fafc',
            num: 0,
            active: true
        };
        this.balls.push(this.cueBall);

        // 9-Ball Diamond Rack at foot spot
        const startX = this.table.x + 520;
        const startY = this.table.y + this.table.h / 2;
        const r = this.ballRadius;
        const d = r * 2 + 1;
        const sqrt3 = Math.sqrt(3);

        const ballColors = [
            '#facc15', // 1 Yellow
            '#38bdf8', // 2 Blue
            '#ef4444', // 3 Red
            '#a855f7', // 4 Purple
            '#f97316', // 5 Orange
            '#22c55e', // 6 Green
            '#991b1b', // 7 Maroon
            '#18181b', // 8 Black
            '#eab308'  // 9 Gold
        ];

        // Diamond formation layout offsets (col, rowOffset)
        const diamondSlots = [
            { col: 0, row: 0, num: 1 },
            { col: 1, row: -0.5, num: 2 },
            { col: 1, row: 0.5, num: 3 },
            { col: 2, row: -1.0, num: 4 },
            { col: 2, row: 0, num: 9 }, // 9-ball in center!
            { col: 2, row: 1.0, num: 5 },
            { col: 3, row: -0.5, num: 6 },
            { col: 3, row: 0.5, num: 7 },
            { col: 4, row: 0, num: 8 }
        ];

        diamondSlots.forEach(slot => {
            this.balls.push({
                id: slot.num,
                x: startX + slot.col * (d * sqrt3 / 2),
                y: startY + slot.row * d,
                vx: 0,
                vy: 0,
                color: ballColors[slot.num - 1],
                num: slot.num,
                active: true
            });
        });
    }

    allStopped() {
        return this.balls.every(b => !b.active || (Math.hypot(b.vx, b.vy) < 1.5));
    }

    strikeCue(powerRatio, angle) {
        if (!this.allStopped() || !this.cueBall.active) return;

        const impulse = Math.min(1.0, Math.max(0.1, powerRatio)) * this.maxPower;
        this.cueBall.vx = Math.cos(angle) * impulse;
        this.cueBall.vy = Math.sin(angle) * impulse;

        this.shotsTaken++;
        if (this.audio) this.audio.cueHit(powerRatio);
    }

    update(dt) {
        if (this.foulTimer > 0) this.foulTimer -= dt;

        // Physics sub-stepping for tunneling prevention
        const steps = 4;
        const subDt = dt / steps;

        for (let step = 0; step < steps; step++) {
            // Move & Apply friction
            for (const b of this.balls) {
                if (!b.active) continue;

                b.x += b.vx * subDt;
                b.y += b.vy * subDt;

                b.vx *= Math.pow(this.friction, subDt * 60);
                b.vy *= Math.pow(this.friction, subDt * 60);

                if (Math.hypot(b.vx, b.vy) < 2.0) {
                    b.vx = 0;
                    b.vy = 0;
                }

                // Check Pocket suction
                for (const p of this.pockets) {
                    const dist = Math.hypot(b.x - p.x, b.y - p.y);
                    if (dist < this.pocketRadius) {
                        this.handlePocket(b);
                        break;
                    }
                }

                if (!b.active) continue;

                // Cushion bounces
                if (b.x - this.ballRadius < this.table.left) {
                    b.x = this.table.left + this.ballRadius;
                    b.vx = -b.vx * 0.82;
                    if (this.audio && Math.abs(b.vx) > 30) this.audio.cushionHit();
                } else if (b.x + this.ballRadius > this.table.right) {
                    b.x = this.table.right - this.ballRadius;
                    b.vx = -b.vx * 0.82;
                    if (this.audio && Math.abs(b.vx) > 30) this.audio.cushionHit();
                }

                if (b.y - this.ballRadius < this.table.top) {
                    b.y = this.table.top + this.ballRadius;
                    b.vy = -b.vy * 0.82;
                    if (this.audio && Math.abs(b.vy) > 30) this.audio.cushionHit();
                } else if (b.y + this.ballRadius > this.table.bottom) {
                    b.y = this.table.bottom - this.ballRadius;
                    b.vy = -b.vy * 0.82;
                    if (this.audio && Math.abs(b.vy) > 30) this.audio.cushionHit();
                }
            }

            // Ball-to-Ball Collisions
            for (let i = 0; i < this.balls.length; i++) {
                const b1 = this.balls[i];
                if (!b1.active) continue;

                for (let j = i + 1; j < this.balls.length; j++) {
                    const b2 = this.balls[j];
                    if (!b2.active) continue;

                    const dx = b2.x - b1.x;
                    const dy = b2.y - b1.y;
                    const dist = Math.hypot(dx, dy);
                    const minDist = this.ballRadius * 2;

                    if (dist < minDist && dist > 0.0001) {
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Position separation
                        const overlap = minDist - dist;
                        b1.x -= nx * (overlap * 0.5);
                        b1.y -= ny * (overlap * 0.5);
                        b2.x += nx * (overlap * 0.5);
                        b2.y += ny * (overlap * 0.5);

                        // Relative velocity
                        const rvx = b1.vx - b2.vx;
                        const rvy = b1.vy - b2.vy;
                        const velAlongNormal = rvx * nx + rvy * ny;

                        if (velAlongNormal > 0) {
                            const restitution = 0.94;
                            const impulse = ((1 + restitution) * velAlongNormal) / 2;

                            b1.vx -= impulse * nx;
                            b1.vy -= impulse * ny;
                            b2.vx += impulse * nx;
                            b2.vy += impulse * ny;

                            if (this.audio) {
                                const speedNorm = Math.min(1.0, velAlongNormal / 500);
                                this.audio.ballHit(speedNorm);
                            }
                        }
                    }
                }
            }
        }
    }

    handlePocket(ball) {
        ball.active = false;
        ball.vx = 0;
        ball.vy = 0;

        if (ball.num === 0) {
            // Scratch! Cue ball pocketed
            this.foulMessage = "SCRATCH! FOUL -50 PTS";
            this.foulTimer = 2.5;
            this.score = Math.max(0, this.score - 50);
            if (this.audio) this.audio.foul();

            setTimeout(() => {
                ball.x = this.table.x + 180;
                ball.y = this.table.y + this.table.h / 2;
                ball.vx = 0;
                ball.vy = 0;
                ball.active = true;
            }, 800);
        } else {
            // Object ball pocketed
            this.ballsPocketedCount++;
            this.score += 150;
            if (this.audio) this.audio.pocket();

            if (ball.num === 9) {
                // Pocketed the 9-ball: Victory!
                this.victory = true;
                this.score += 1000;
                if (this.audio) this.audio.victory();
                if (typeof CGZBridge !== 'undefined') {
                    CGZBridge.vibrate([40, 60, 100]);
                    CGZBridge.unlockAchievement('cue_wizard');
                    CGZBridge.reportScore('billiards', this.score);
                }
            } else if (typeof CGZBridge !== 'undefined') {
                CGZBridge.vibrate(20);
                CGZBridge.reportScore('billiards', this.score);
            }
        }
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Dark background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Header Stats
        this.renderStats(ctx);

        // Outer Table Wood/Carbon Rim
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff44';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.roundRect(this.table.x, this.table.y, this.table.w, this.table.h, 16);
        ctx.fill();
        ctx.stroke();

        // Inner Felt (Cyber Obsidian Felt)
        ctx.fillStyle = '#09151e';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.roundRect(this.table.left, this.table.top, this.table.w - this.table.rail * 2, this.table.h - this.table.rail * 2, 8);
        ctx.fill();

        // Table markings (Head string line & Foot spot)
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.table.x + 180, this.table.top);
        ctx.lineTo(this.table.x + 180, this.table.bottom);
        ctx.stroke();

        // 6 Pockets
        for (const p of this.pockets) {
            ctx.fillStyle = '#020408';
            ctx.strokeStyle = '#00f0ff66';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.pocketRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Aiming Guideline & Cue Stick if ready
        if (this.allStopped() && this.cueBall.active) {
            this.renderAimLine(ctx);
        }

        // Balls
        for (const b of this.balls) {
            if (!b.active) continue;
            ctx.save();
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, this.ballRadius, 0, Math.PI * 2);
            ctx.fill();

            // Ball number or cue dot
            if (b.num > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 0;
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${b.num}`, b.x, b.y);
            }
            ctx.restore();
        }

        // Cue Stick
        if (this.allStopped() && this.cueBall.active && this.isAiming) {
            this.renderCueStick(ctx);
        }

        // Foul Message
        if (this.foulTimer > 0) {
            ctx.save();
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.foulMessage, this.width / 2, this.table.y + 40);
            ctx.restore();
        }

        // Overlays
        this.renderOverlays(ctx);
    }

    renderAimLine(ctx) {
        const cb = this.cueBall;
        const dx = Math.cos(this.aimAngle);
        const dy = Math.sin(this.aimAngle);

        ctx.save();
        ctx.strokeStyle = '#00f0ffaa';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(cb.x, cb.y);
        ctx.lineTo(cb.x + dx * 280, cb.y + dy * 280);
        ctx.stroke();
        ctx.restore();
    }

    renderCueStick(ctx) {
        const cb = this.cueBall;
        const stickLen = 220;
        const pullBack = 15 + this.power * 50;
        const cos = Math.cos(this.aimAngle);
        const sin = Math.sin(this.aimAngle);

        const tipX = cb.x - cos * (this.ballRadius + pullBack);
        const tipY = cb.y - sin * (this.ballRadius + pullBack);
        const buttX = tipX - cos * stickLen;
        const buttY = tipY - sin * stickLen;

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(buttX, buttY);
        ctx.stroke();

        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderStats(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(50, 20, 700, 70, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('SCORE', 70, 42);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(`${this.score}`, 70, 72);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('SHOTS TAKEN', 260, 42);
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(`${this.shotsTaken}`, 260, 72);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('POCKETED', 450, 42);
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(`${this.ballsPocketedCount} / 9`, 450, 72);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('TARGET', 620, 42);
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('POCKET 9-BALL', 620, 72);

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
            ctx.fillText("9-BALL POCKETED! VICTORY!", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '20px sans-serif';
            ctx.fillText(`Final Score: ${this.score}  |  Shots: ${this.shotsTaken}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Click or press SPACE to Rack Again', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BilliardsEngine };
}
