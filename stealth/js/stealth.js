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
        this.lineTo(x + bl, y);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

class StealthEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.level = 1;
        this.maxLevels = 3;
        this.gameState = 'playing'; // 'playing', 'detected', 'level_cleared', 'victory'
        this.score = 0;
        this.alertTimer = 0;
        this.globalAlarm = false;

        // Player
        this.player = {
            x: 60,
            y: 540,
            radius: 12,
            vx: 0,
            vy: 0,
            angle: 0,
            speed: 130,
            isCrouching: false,
            isSprinting: false,
            hacking: false,
            takedowns: 0
        };

        // Controls
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            shift: false,
            crouch: false,
            action: false
        };

        this.walls = [];
        this.terminals = [];
        this.guards = [];
        this.lasers = [];
        this.extraction = { x: 720, y: 40, w: 50, h: 50, unlocked: false };
        this.particles = [];
        this.floatingTexts = [];

        this.loadLevel(this.level);
    }

    loadLevel(lvl) {
        this.level = lvl;
        this.gameState = 'playing';
        this.globalAlarm = false;
        this.alertTimer = 0;

        // Player spawn
        this.player.x = 60;
        this.player.y = 540;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.angle = -Math.PI / 2;
        this.player.hacking = false;

        // Extraction
        this.extraction = { x: 710, y: 30, w: 60, h: 60, unlocked: false };

        if (lvl === 1) {
            // Level 1: Sublevel Archive (Introductory)
            this.walls = [
                // Outer boundary
                { x: 10, y: 10, w: 780, h: 10 },
                { x: 10, y: 580, w: 780, h: 10 },
                { x: 10, y: 10, w: 10, h: 580 },
                { x: 780, y: 10, w: 10, h: 580 },
                // Interior partitions
                { x: 160, y: 160, w: 20, h: 320 },
                { x: 340, y: 80, w: 20, h: 320 },
                { x: 520, y: 200, w: 20, h: 390 },
                { x: 520, y: 80, w: 160, h: 20 }
            ];

            this.terminals = [
                { id: 1, x: 260, y: 240, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 1.8 },
                { id: 2, x: 440, y: 140, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.2 }
            ];

            this.lasers = [
                { x1: 340, y1: 460, x2: 520, y2: 460, active: true, timer: 0, period: 3.5, activeRatio: 0.5 }
            ];

            this.guards = [
                this.createGuard(240, 120, [
                    { x: 240, y: 120 }, { x: 240, y: 460 }
                ], 65),
                this.createGuard(440, 500, [
                    { x: 440, y: 500 }, { x: 440, y: 260 }
                ], 70),
                this.createGuard(640, 200, [
                    { x: 640, y: 200 }, { x: 640, y: 500 }
                ], 75)
            ];
        } else if (lvl === 2) {
            // Level 2: Cybernetics Lab
            this.walls = [
                { x: 10, y: 10, w: 780, h: 10 },
                { x: 10, y: 580, w: 780, h: 10 },
                { x: 10, y: 10, w: 10, h: 580 },
                { x: 780, y: 10, w: 10, h: 580 },
                // Rooms
                { x: 160, y: 120, w: 140, h: 20 },
                { x: 160, y: 120, w: 20, h: 260 },
                { x: 160, y: 440, w: 20, h: 140 },
                { x: 380, y: 20, w: 20, h: 320 },
                { x: 380, y: 420, w: 20, h: 160 },
                { x: 560, y: 160, w: 140, h: 20 },
                { x: 560, y: 320, w: 140, h: 20 }
            ];

            this.terminals = [
                { id: 1, x: 240, y: 200, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.0 },
                { id: 2, x: 480, y: 100, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.2 },
                { id: 3, x: 640, y: 480, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.5 }
            ];

            this.lasers = [
                { x1: 180, y1: 380, x2: 380, y2: 380, active: true, timer: 0, period: 3.0, activeRatio: 0.6 },
                { x1: 560, y1: 240, x2: 700, y2: 240, active: true, timer: 1.5, period: 3.0, activeRatio: 0.6 }
            ];

            this.guards = [
                this.createGuard(80, 260, [{ x: 80, y: 260 }, { x: 80, y: 80 }, { x: 280, y: 80 }], 70),
                this.createGuard(260, 480, [{ x: 260, y: 480 }, { x: 360, y: 480 }, { x: 360, y: 360 }], 75),
                this.createGuard(470, 240, [{ x: 470, y: 240 }, { x: 470, y: 520 }], 80),
                this.createGuard(660, 100, [{ x: 660, y: 100 }, { x: 740, y: 240 }, { x: 660, y: 400 }], 80)
            ];
        } else {
            // Level 3: Megacorp Penthouse Vault
            this.walls = [
                { x: 10, y: 10, w: 780, h: 10 },
                { x: 10, y: 580, w: 780, h: 10 },
                { x: 10, y: 10, w: 10, h: 580 },
                { x: 780, y: 10, w: 10, h: 580 },
                // Vault barriers
                { x: 140, y: 160, w: 20, h: 360 },
                { x: 140, y: 160, w: 180, h: 20 },
                { x: 320, y: 160, w: 20, h: 200 },
                { x: 320, y: 440, w: 20, h: 140 },
                { x: 480, y: 80, w: 20, h: 280 },
                { x: 480, y: 440, w: 20, h: 140 },
                { x: 620, y: 180, w: 20, h: 280 },
                { x: 620, y: 180, w: 100, h: 20 }
            ];

            this.terminals = [
                { id: 1, x: 230, y: 280, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.0 },
                { id: 2, x: 400, y: 220, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.5 },
                { id: 3, x: 550, y: 500, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 2.5 },
                { id: 4, x: 710, y: 320, w: 24, h: 24, hacked: false, hackProgress: 0, requiredTime: 3.0 }
            ];

            this.lasers = [
                { x1: 140, y1: 520, x2: 320, y2: 520, active: true, timer: 0, period: 2.5, activeRatio: 0.5 },
                { x1: 320, y1: 360, x2: 480, y2: 360, active: true, timer: 1.0, period: 2.5, activeRatio: 0.5 },
                { x1: 480, y1: 360, x2: 620, y2: 360, active: true, timer: 2.0, period: 2.5, activeRatio: 0.5 }
            ];

            this.guards = [
                this.createGuard(70, 200, [{ x: 70, y: 200 }, { x: 70, y: 60 }], 75),
                this.createGuard(230, 80, [{ x: 230, y: 80 }, { x: 230, y: 480 }], 80),
                this.createGuard(400, 500, [{ x: 400, y: 500 }, { x: 400, y: 80 }], 85),
                this.createGuard(550, 100, [{ x: 550, y: 100 }, { x: 550, y: 420 }], 85),
                this.createGuard(710, 480, [{ x: 710, y: 480 }, { x: 710, y: 140 }], 90)
            ];
        }
    }

    createGuard(x, y, patrolPoints, speed = 70) {
        return {
            x,
            y,
            radius: 14,
            speed,
            patrolPoints,
            targetIdx: 1 % patrolPoints.length,
            angle: 0,
            state: 'patrol', // 'patrol', 'investigate', 'alert', 'stunned'
            investigateTimer: 0,
            investigatePos: null,
            stunTimer: 0,
            suspicion: 0,
            visionAngle: Math.PI / 2.8, // ~64 degrees cone
            visionRange: 175
        };
    }

    // Line of sight check between two points against rectangular walls
    hasLineOfSight(x1, y1, x2, y2) {
        for (const w of this.walls) {
            if (this.lineIntersectsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) {
                return false;
            }
        }
        return true;
    }

    lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
        // Check 4 segments of rectangle
        return (
            this.lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
            this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
            this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh) ||
            this.lineIntersectsLine(x1, y1, x2, y2, rx, ry + rh, rx, ry)
        );
    }

    lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }

    update(dt) {
        if (this.gameState !== 'playing') return;

        this.updatePlayer(dt);
        this.updateLasers(dt);
        this.updateGuards(dt);
        this.updateTerminals(dt);
        this.updateExtraction();
        this.updateEffects(dt);
    }

    updatePlayer(dt) {
        const p = this.player;

        let moveSpeed = p.speed;
        if (this.keys.shift) {
            moveSpeed = 210;
            p.isSprinting = true;
            p.isCrouching = false;
        } else if (this.keys.crouch) {
            moveSpeed = 75;
            p.isCrouching = true;
            p.isSprinting = false;
        } else {
            p.isSprinting = false;
            p.isCrouching = false;
        }

        let dx = 0;
        let dy = 0;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        if (dx !== 0 || dy !== 0) {
            p.angle = Math.atan2(dy, dx);
            const targetVx = dx * moveSpeed;
            const targetVy = dy * moveSpeed;
            p.vx += (targetVx - p.vx) * 12 * dt;
            p.vy += (targetVy - p.vy) * 12 * dt;

            // Sprint noise alerts nearby guards
            if (p.isSprinting) {
                for (const g of this.guards) {
                    if (g.state === 'stunned') continue;
                    const d = Math.hypot(g.x - p.x, g.y - p.y);
                    if (d < 140) {
                        g.state = 'investigate';
                        g.investigatePos = { x: p.x, y: p.y };
                        g.investigateTimer = 3.0;
                    }
                }
            }
        } else {
            p.vx *= Math.pow(0.05, dt);
            p.vy *= Math.pow(0.05, dt);
        }

        // Sub-step movement and wall collision
        const steps = 3;
        const subDt = dt / steps;
        for (let s = 0; s < steps; s++) {
            p.x += p.vx * subDt;
            this.handlePlayerWallCollisions('x');
            p.y += p.vy * subDt;
            this.handlePlayerWallCollisions('y');
        }

        // Bounds check
        p.x = Math.max(p.radius + 15, Math.min(this.width - p.radius - 15, p.x));
        p.y = Math.max(p.radius + 15, Math.min(this.height - p.radius - 15, p.y));

        // Check takedown input (Space or Action key)
        if (this.keys.action) {
            this.attemptTakedown();
        }
    }

    handlePlayerWallCollisions(axis) {
        const p = this.player;
        for (const w of this.walls) {
            // Find closest point on rectangle
            const closestX = Math.max(w.x, Math.min(p.x, w.x + w.w));
            const closestY = Math.max(w.y, Math.min(p.y, w.y + w.h));
            const distX = p.x - closestX;
            const distY = p.y - closestY;
            const dist = Math.hypot(distX, distY);

            if (dist < p.radius) {
                const overlap = p.radius - dist;
                if (dist > 0.0001) {
                    p.x += (distX / dist) * overlap;
                    p.y += (distY / dist) * overlap;
                } else {
                    if (axis === 'x') p.x += 1;
                    else p.y += 1;
                }
                if (axis === 'x') p.vx = 0;
                else p.vy = 0;
            }
        }
    }

    attemptTakedown() {
        const p = this.player;
        for (const g of this.guards) {
            if (g.state === 'stunned') continue;
            const dist = Math.hypot(g.x - p.x, g.y - p.y);
            if (dist < 40) {
                // Guard must not be facing directly at player
                const angleToPlayer = Math.atan2(p.y - g.y, p.x - g.x);
                let diff = Math.abs(g.angle - angleToPlayer);
                while (diff > Math.PI) diff -= Math.PI * 2;
                diff = Math.abs(diff);

                // If guard's vision does NOT see player (diff > visionAngle / 2) or guard is investigate/alert
                if (diff > g.visionAngle / 2) {
                    // Successful stealth takedown!
                    g.state = 'stunned';
                    g.stunTimer = 12.0;
                    g.suspicion = 0;
                    p.takedowns++;
                    this.score += 250;
                    this.addFloatingText("TAKEDOWN! +250", g.x, g.y - 20, '#00f0ff');
                    this.spawnParticles(g.x, g.y, '#00f0ff', 12);
                    if (this.audio) this.audio.takedown();
                    if (typeof CGZBridge !== 'undefined') {
                        CGZBridge.vibrate(30);
                        CGZBridge.unlockAchievement('ghost_infiltrator');
                        CGZBridge.reportScore('stealth', this.score);
                    }
                    return;
                }
            }
        }
    }

    updateLasers(dt) {
        for (const laser of this.lasers) {
            laser.timer = (laser.timer + dt) % laser.period;
            laser.active = (laser.timer / laser.period) < laser.activeRatio;

            // Check collision with player if laser is active
            if (laser.active) {
                const p = this.player;
                // Distance from point to line segment
                const d = this.distToSegment(p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2);
                if (d < p.radius + 3) {
                    this.triggerAlarm("LASER TRIPWIRE TRIGGERED!");
                }
            }
        }
    }

    distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    updateGuards(dt) {
        const p = this.player;

        for (const g of this.guards) {
            if (g.state === 'stunned') {
                g.stunTimer -= dt;
                if (g.stunTimer <= 0) {
                    g.state = 'patrol';
                    g.suspicion = 0;
                }
                continue;
            }

            // Check sight of player
            const dist = Math.hypot(p.x - g.x, p.y - g.y);
            let canSee = false;

            if (dist < g.visionRange) {
                const angleToP = Math.atan2(p.y - g.y, p.x - g.x);
                let diff = Math.abs(g.angle - angleToP);
                while (diff > Math.PI) diff -= Math.PI * 2;
                diff = Math.abs(diff);

                if (diff < g.visionAngle / 2) {
                    if (this.hasLineOfSight(g.x, g.y, p.x, p.y)) {
                        canSee = true;
                    }
                }
            }

            if (canSee) {
                // Suspicion rate builds faster when sprinting, slower when crouching
                const mult = p.isSprinting ? 2.5 : (p.isCrouching ? 0.6 : 1.2);
                const distFactor = 1 - (dist / g.visionRange) * 0.5; // Closer = faster
                g.suspicion = Math.min(100, g.suspicion + 70 * mult * distFactor * dt);

                if (g.suspicion >= 100) {
                    this.triggerAlarm("INTRUDER CONFIRMED!");
                } else if (g.suspicion > 40 && g.state !== 'alert') {
                    g.state = 'investigate';
                    g.investigatePos = { x: p.x, y: p.y };
                    g.investigateTimer = 4.0;
                    if (this.audio && Math.random() < 0.05) this.audio.suspicionPing();
                }
            } else {
                // Decay suspicion slowly if not in sight
                g.suspicion = Math.max(0, g.suspicion - 25 * dt);
            }

            // Guard state machine
            if (this.globalAlarm || g.state === 'alert') {
                // Pursuit player directly
                const angleToP = Math.atan2(p.y - g.y, p.x - g.x);
                g.angle = angleToP;
                const pursueSpeed = g.speed * 1.35;
                g.x += Math.cos(g.angle) * pursueSpeed * dt;
                g.y += Math.sin(g.angle) * pursueSpeed * dt;

                // If guard catches player
                if (dist < g.radius + p.radius) {
                    this.gameState = 'detected';
                    this.addFloatingText("BUSTED!", p.x, p.y - 30, '#ff0055');
                    if (this.audio) this.audio.alert();
                    return;
                }
            } else if (g.state === 'investigate') {
                if (g.investigatePos) {
                    const d = Math.hypot(g.investigatePos.x - g.x, g.investigatePos.y - g.y);
                    if (d > 10) {
                        g.angle = Math.atan2(g.investigatePos.y - g.y, g.investigatePos.x - g.x);
                        g.x += Math.cos(g.angle) * g.speed * 0.8 * dt;
                        g.y += Math.sin(g.angle) * g.speed * 0.8 * dt;
                    } else {
                        // Look around
                        g.investigateTimer -= dt;
                        g.angle += dt * 2.0;
                        if (g.investigateTimer <= 0) {
                            g.state = 'patrol';
                            g.investigatePos = null;
                        }
                    }
                }
            } else {
                // Patrol along waypoints
                const target = g.patrolPoints[g.targetIdx];
                const d = Math.hypot(target.x - g.x, target.y - g.y);
                if (d < 12) {
                    g.targetIdx = (g.targetIdx + 1) % g.patrolPoints.length;
                } else {
                    const targetAngle = Math.atan2(target.y - g.y, target.x - g.x);
                    let angleDiff = targetAngle - g.angle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    g.angle += angleDiff * 6 * dt;

                    g.x += Math.cos(g.angle) * g.speed * dt;
                    g.y += Math.sin(g.angle) * g.speed * dt;
                }
            }
        }
    }

    triggerAlarm(msg) {
        if (!this.globalAlarm) {
            this.globalAlarm = true;
            for (const g of this.guards) {
                if (g.state !== 'stunned') {
                    g.state = 'alert';
                    g.suspicion = 100;
                }
            }
            this.addFloatingText(msg, this.width / 2, 80, '#ff0055');
            if (this.audio) this.audio.alert();
        }
    }

    updateTerminals(dt) {
        const p = this.player;
        let isNearAny = false;

        for (const t of this.terminals) {
            if (t.hacked) continue;

            const dist = Math.hypot(t.x + t.w / 2 - p.x, t.y + t.h / 2 - p.y);
            if (dist < 38) {
                isNearAny = true;
                // Auto hack or hack while holding action or standing still
                t.hackProgress += dt;
                p.hacking = true;

                if (Math.random() < 0.15 && this.audio) {
                    this.audio.hackTick();
                }

                if (t.hackProgress >= t.requiredTime) {
                    t.hacked = true;
                    t.hackProgress = t.requiredTime;
                    this.score += 500;
                    this.addFloatingText("TERMINAL DECRYPTED! +500", t.x, t.y - 15, '#39ff14');
                    this.spawnParticles(t.x + t.w / 2, t.y + t.h / 2, '#39ff14', 15);
                    if (this.audio) this.audio.hackComplete();
                }
            }
        }

        if (!isNearAny) {
            p.hacking = false;
        }
    }

    updateExtraction() {
        const allHacked = this.terminals.every(t => t.hacked);
        this.extraction.unlocked = allHacked;

        if (this.extraction.unlocked) {
            const p = this.player;
            const ex = this.extraction;
            if (p.x >= ex.x && p.x <= ex.x + ex.w && p.y >= ex.y && p.y <= ex.y + ex.h) {
                // Reached extraction!
                if (this.level < this.maxLevels) {
                    this.score += 1000;
                    if (this.audio) this.audio.extraction();
                    this.loadLevel(this.level + 1);
                } else {
                    this.gameState = 'victory';
                    this.score += 2500;
                    if (this.audio) this.audio.extraction();
                }
            }
        }
    }

    updateEffects(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 90;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.4,
                color
            });
        }
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({ text, x, y, vy: -35, life: 1.2, color });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Clear floor
        ctx.fillStyle = '#05080f';
        ctx.fillRect(0, 0, this.width, this.height);

        // Grid pattern
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Render Walls
        ctx.fillStyle = '#161b22';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        for (const w of this.walls) {
            ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.strokeRect(w.x, w.y, w.w, w.h);
        }

        // Render Lasers
        for (const laser of this.lasers) {
            ctx.save();
            if (laser.active) {
                ctx.strokeStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 12;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(laser.x1, laser.y1);
                ctx.lineTo(laser.x2, laser.y2);
                ctx.stroke();

                // Laser nodes
                ctx.fillStyle = '#ff0055';
                ctx.beginPath();
                ctx.arc(laser.x1, laser.y1, 4, 0, Math.PI * 2);
                ctx.arc(laser.x2, laser.y2, 4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(255, 0, 85, 0.2)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(laser.x1, laser.y1);
                ctx.lineTo(laser.x2, laser.y2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Render Extraction Zone
        const ex = this.extraction;
        ctx.save();
        if (ex.unlocked) {
            ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
            ctx.strokeStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2;
            ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
            ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
            ctx.fillStyle = '#39ff14';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("EXTRACTION", ex.x + ex.w / 2, ex.y + ex.h / 2 + 4);
        } else {
            ctx.fillStyle = 'rgba(139, 148, 158, 0.08)';
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;
            ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
            ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("LOCKED", ex.x + ex.w / 2, ex.y + ex.h / 2 + 4);
        }
        ctx.restore();

        // Render Terminals
        for (const t of this.terminals) {
            ctx.save();
            ctx.fillStyle = t.hacked ? '#238636' : '#1f6feb';
            ctx.strokeStyle = t.hacked ? '#39ff14' : '#58a6ff';
            ctx.lineWidth = 2;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = t.hacked ? 8 : 12;
            ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.strokeRect(t.x, t.y, t.w, t.h);

            // Screen symbol
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(t.hacked ? "✓" : "⚡", t.x + t.w / 2, t.y + t.h / 2 + 4);

            // Progress bar
            if (!t.hacked && t.hackProgress > 0) {
                const ratio = t.hackProgress / t.requiredTime;
                ctx.fillStyle = '#21262d';
                ctx.fillRect(t.x - 8, t.y - 12, 40, 6);
                ctx.fillStyle = '#00f0ff';
                ctx.fillRect(t.x - 8, t.y - 12, 40 * ratio, 6);
            }
            ctx.restore();
        }

        // Render Guards & Vision Cones
        for (const g of this.guards) {
            this.renderGuard(ctx, g);
        }

        // Render Player
        this.renderPlayer(ctx);

        // Render Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, 3, 3);
        }

        // Render Floating Texts
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        // Render HUD
        this.renderHUD(ctx);

        // Render Game Over / Victory Overlay
        if (this.gameState === 'detected') {
            ctx.save();
            ctx.fillStyle = 'rgba(20, 5, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("MISSION FAILED: DETECTED", this.width / 2, this.height / 2 - 20);
            ctx.fillStyle = '#8b949e';
            ctx.font = '16px sans-serif';
            ctx.fillText("Press SPACE or Tap to Retry", this.width / 2, this.height / 2 + 30);
            ctx.restore();
        } else if (this.gameState === 'victory') {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 20, 15, 0.9)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 25;
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("FACILITY INFILTRATED!", this.width / 2, this.height / 2 - 30);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '22px sans-serif';
            ctx.fillText(`All Terminals Decrypted • Final Score: ${this.score}`, this.width / 2, this.height / 2 + 15);
            ctx.fillStyle = '#8b949e';
            ctx.font = '15px sans-serif';
            ctx.fillText("Press SPACE to Infiltrate Again", this.width / 2, this.height / 2 + 65);
            ctx.restore();
        }
    }

    renderGuard(ctx, g) {
        ctx.save();

        // If not stunned, draw vision cone
        if (g.state !== 'stunned') {
            const coneAngle = g.visionAngle;
            const startAngle = g.angle - coneAngle / 2;
            const endAngle = g.angle + coneAngle / 2;

            const coneColor = g.suspicion > 50 || g.state === 'alert'
                ? 'rgba(255, 0, 85, 0.22)'
                : (g.suspicion > 10 || g.state === 'investigate'
                    ? 'rgba(255, 170, 0, 0.18)'
                    : 'rgba(0, 240, 255, 0.12)');

            ctx.fillStyle = coneColor;
            ctx.beginPath();
            ctx.moveTo(g.x, g.y);
            ctx.arc(g.x, g.y, g.visionRange, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();

            // Cone edge glow
            ctx.strokeStyle = g.suspicion > 50 || g.state === 'alert' ? '#ff0055' : (g.suspicion > 10 ? '#ffaa00' : '#00f0ff');
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Body
        ctx.fillStyle = g.state === 'stunned' ? '#555566' : (g.state === 'alert' ? '#ff0055' : '#8b949e');
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Facing direction pointer
        if (g.state !== 'stunned') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(g.x, g.y);
            ctx.lineTo(g.x + Math.cos(g.angle) * (g.radius + 6), g.y + Math.sin(g.angle) * (g.radius + 6));
            ctx.stroke();
        }

        // Suspicion gauge over guard's head
        if (g.suspicion > 0 && g.state !== 'stunned') {
            const bw = 28;
            const bh = 5;
            ctx.fillStyle = '#21262d';
            ctx.fillRect(g.x - bw / 2, g.y - g.radius - 12, bw, bh);
            ctx.fillStyle = g.suspicion > 70 ? '#ff0055' : '#ffaa00';
            ctx.fillRect(g.x - bw / 2, g.y - g.radius - 12, bw * (g.suspicion / 100), bh);
        } else if (g.state === 'stunned') {
            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("ZZZ", g.x, g.y - g.radius - 6);
        }

        ctx.restore();
    }

    renderPlayer(ctx) {
        const p = this.player;
        ctx.save();

        // Footprint / sound circle if sprinting
        if (p.isSprinting) {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 45, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Body
        ctx.fillStyle = p.isCrouching ? '#007799' : '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = p.isCrouching ? 4 : 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Direction pointer
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * (p.radius + 5), p.y + Math.sin(p.angle) * (p.radius + 5));
        ctx.stroke();

        ctx.restore();
    }

    renderHUD(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.fillRect(10, 10, this.width - 20, 42);
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, this.width - 20, 42);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`FLOOR ${this.level} / ${this.maxLevels}`, 25, 36);

        const hackedCount = this.terminals.filter(t => t.hacked).length;
        ctx.fillStyle = hackedCount === this.terminals.length ? '#39ff14' : '#f0f6fc';
        ctx.font = '14px sans-serif';
        ctx.fillText(`DATA TERMINALS: ${hackedCount} / ${this.terminals.length}`, 180, 36);

        ctx.fillStyle = '#ffaa00';
        ctx.fillText(`SCORE: ${this.score}`, 440, 36);

        // Alarm status
        ctx.textAlign = 'right';
        if (this.globalAlarm) {
            ctx.fillStyle = '#ff0055';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText("STATUS: ⚠ HIGH ALERT", this.width - 25, 36);
        } else {
            ctx.fillStyle = '#39ff14';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText("STATUS: STEALTH ACTIVE", this.width - 25, 36);
        }
        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StealthEngine };
}
