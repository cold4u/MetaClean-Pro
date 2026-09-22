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

class FlightEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;
        this.fov = 420;

        // Player Jet
        this.player = {
            x: 0,
            y: -40,
            vx: 0,
            vy: 0,
            roll: 0,
            isRolling: false,
            rollTimer: 0,
            rollCooldown: 0,
            hp: 100,
            maxHp: 100,
            shield: 50,
            maxShield: 50,
            missiles: 4,
            maxMissiles: 4,
            missileRegen: 0,
            speed: 360,
            invulnerable: 0
        };

        // Crosshair reticle
        this.crosshair = { x: 0, y: 0 };

        // Controls
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            lock: false,
            roll: false
        };

        // Projectiles: Player Lasers, Missiles, Enemy Lasers
        this.lasers = [];
        this.missiles = [];
        this.enemyLasers = [];

        // Lock-on targeting
        this.isLocking = false;
        this.lockedTargets = new Set();

        // Enemies & Boss
        this.enemies = [];
        this.spawnTimer = 1.0;
        this.score = 0;
        this.distance = 0;

        // Boss
        this.boss = null;
        this.bossActive = false;

        // Space Stars background
        this.stars = [];
        this.initStars();

        this.particles = [];
        this.gameOver = false;
        this.victory = false;
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 120; i++) {
            this.stars.push({
                x: (Math.random() - 0.5) * 1600,
                y: (Math.random() - 0.5) * 1200,
                z: Math.random() * 2000 + 100
            });
        }
    }

    project(x, y, z) {
        const scale = this.fov / Math.max(1, this.fov + z);
        return {
            x: (this.width / 2) + x * scale,
            y: (this.height / 2) - y * scale,
            scale: scale
        };
    }

    triggerFire() {
        if (this.gameOver || this.victory) return;
        if (this.audio) this.audio.laser();

        // Fire twin lasers from wingtips into depth z
        const px = this.player.x;
        const py = this.player.y;
        this.lasers.push({ x: px - 25, y: py, z: 20, vz: 1800, life: 1.2 });
        this.lasers.push({ x: px + 25, y: py, z: 20, vz: 1800, life: 1.2 });
    }

    triggerBarrelRoll() {
        const p = this.player;
        if (p.isRolling || p.rollCooldown > 0) return;
        p.isRolling = true;
        p.rollTimer = 0.4;
        p.rollCooldown = 0.8;
        p.invulnerable = 0.45;
        if (this.audio) this.audio.barrelRoll();
    }

    startLockOn() {
        this.isLocking = true;
    }

    releaseLockOn() {
        if (!this.isLocking) return;
        this.isLocking = false;

        // Fire homing missiles at locked targets
        if (this.lockedTargets.size > 0 && this.player.missiles > 0) {
            this.lockedTargets.forEach(target => {
                if (this.player.missiles > 0) {
                    this.player.missiles--;
                    this.missiles.push({
                        x: this.player.x,
                        y: this.player.y,
                        z: 20,
                        target: target,
                        vx: 0,
                        vy: 0,
                        vz: 800,
                        life: 2.5
                    });
                }
            });
            if (this.audio) this.audio.missileLaunch();
        }
        this.lockedTargets.clear();
    }

    update(dt) {
        if (this.gameOver || this.victory) return;

        const p = this.player;
        this.distance += 400 * dt;

        // Timers
        if (p.rollCooldown > 0) p.rollCooldown -= dt;
        if (p.invulnerable > 0) p.invulnerable -= dt;

        if (p.isRolling) {
            p.rollTimer -= dt;
            p.roll += Math.PI * 5 * dt;
            if (p.rollTimer <= 0) {
                p.isRolling = false;
                p.roll = 0;
            }
        } else {
            // Natural banking
            if (this.keys.left) p.roll = Math.max(-0.4, p.roll - 3.0 * dt);
            else if (this.keys.right) p.roll = Math.min(0.4, p.roll + 3.0 * dt);
            else p.roll *= 0.85;
        }

        // Missile ammo regeneration
        if (p.missiles < p.maxMissiles) {
            p.missileRegen += dt;
            if (p.missileRegen >= 3.0) {
                p.missiles++;
                p.missileRegen = 0;
            }
        }

        // Shield regeneration
        if (p.shield < p.maxShield) {
            p.shield = Math.min(p.maxShield, p.shield + 4 * dt);
        }

        // Movement
        if (this.keys.left) p.x -= p.speed * dt;
        if (this.keys.right) p.x += p.speed * dt;
        if (this.keys.up) p.y += p.speed * dt;
        if (this.keys.down) p.y -= p.speed * dt;

        p.x = Math.max(-280, Math.min(280, p.x));
        p.y = Math.max(-180, Math.min(180, p.y));

        // Crosshair reticle leads player movement
        this.crosshair.x = p.x * 0.75;
        this.crosshair.y = p.y * 0.75 + 15;

        // Update Warp Stars
        for (const s of this.stars) {
            s.z -= 900 * dt;
            if (s.z <= 10) {
                s.z = 2000;
                s.x = (Math.random() - 0.5) * 1600;
                s.y = (Math.random() - 0.5) * 1200;
            }
        }

        // Update Player Lasers
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.z += l.vz * dt;
            l.life -= dt;
            if (l.life <= 0 || l.z > 2200) {
                this.lasers.splice(i, 1);
                continue;
            }

            // Hit enemy check
            for (const en of this.enemies) {
                if (Math.abs(en.z - l.z) < 90 && Math.hypot(en.x - l.x, en.y - l.y) < en.radius + 15) {
                    en.hp -= 20;
                    this.lasers.splice(i, 1);
                    this.spawnParticles(en.x, en.y, en.z, '#00f0ff', 6);
                    if (this.audio) this.audio.explosion();
                    break;
                }
            }

            // Hit Boss check
            if (this.boss && this.boss.active && Math.abs(this.boss.z - l.z) < 120) {
                for (const sub of this.boss.subsystems) {
                    if (sub.hp > 0 && Math.hypot((this.boss.x + sub.ox) - l.x, (this.boss.y + sub.oy) - l.y) < sub.r + 15) {
                        sub.hp -= 20;
                        this.lasers.splice(i, 1);
                        this.spawnParticles(this.boss.x + sub.ox, this.boss.y + sub.oy, this.boss.z, '#ffe600', 8);
                        if (this.audio) this.audio.explosion();
                        break;
                    }
                }
            }
        }

        // Update Homing Missiles
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.z += m.vz * dt;
            m.life -= dt;

            // Home in on target
            if (m.target && m.target.hp > 0) {
                m.x += (m.target.x - m.x) * 4 * dt;
                m.y += (m.target.y - m.y) * 4 * dt;
            }

            if (m.life <= 0 || m.z > 2200) {
                this.missiles.splice(i, 1);
                continue;
            }

            // Impact check
            if (m.target && Math.abs(m.target.z - m.z) < 80 && Math.hypot(m.target.x - m.x, m.target.y - m.y) < 40) {
                m.target.hp -= 80;
                this.spawnParticles(m.x, m.y, m.z, '#ff007f', 16);
                if (this.audio) this.audio.explosion();
                this.missiles.splice(i, 1);
            }
        }

        // Update Enemies
        this.updateEnemies(dt);

        // Update Enemy Lasers
        this.updateEnemyLasers(dt);

        // Update Boss
        this.updateBoss(dt);

        // Lock-on scan
        if (this.isLocking) {
            this.scanLockTargets();
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

    scanLockTargets() {
        for (const en of this.enemies) {
            if (en.hp > 0 && !this.lockedTargets.has(en)) {
                const proj = this.project(en.x, en.y, en.z);
                const crossProj = this.project(this.crosshair.x, this.crosshair.y, 200);
                const dist = Math.hypot(proj.x - crossProj.x, proj.y - crossProj.y);
                if (dist < 85 && this.lockedTargets.size < this.player.missiles) {
                    this.lockedTargets.add(en);
                    if (this.audio) this.audio.lockOn();
                }
            }
        }
    }

    updateEnemies(dt) {
        // Spawn waves
        if (!this.bossActive && this.distance < 6000) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnTimer = 2.2;
                this.spawnWave();
            }
        } else if (!this.bossActive && this.distance >= 6000) {
            // Trigger Boss Arrival
            this.bossActive = true;
            this.initBoss();
            if (this.audio) this.audio.bossAlarm();
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            en.z -= en.vz * dt;

            // Pattern movement
            en.x += Math.sin(en.z * 0.005) * 60 * dt;

            // Shoot at player
            en.shootTimer -= dt;
            if (en.shootTimer <= 0 && en.z > 300 && en.z < 1800) {
                en.shootTimer = 2.0;
                this.enemyLasers.push({
                    x: en.x,
                    y: en.y,
                    z: en.z,
                    vx: (this.player.x - en.x) * 0.6,
                    vy: (this.player.y - en.y) * 0.6,
                    vz: -650,
                    life: 2.5
                });
            }

            // Death
            if (en.hp <= 0) {
                this.enemies.splice(i, 1);
                this.score += 250;
                this.spawnParticles(en.x, en.y, en.z, '#ff0055', 14);
                continue;
            }

            // Fly past player
            if (en.z <= 0) {
                this.enemies.splice(i, 1);
            }
        }
    }

    spawnWave() {
        const formation = Math.random() < 0.5 ? 'trio' : 'cross';
        if (formation === 'trio') {
            [-120, 0, 120].forEach((offset, idx) => {
                this.enemies.push({
                    x: offset,
                    y: 60,
                    z: 2200 + idx * 100,
                    vz: 480,
                    hp: 30,
                    maxHp: 30,
                    radius: 24,
                    shootTimer: 1.2 + idx * 0.4
                });
            });
        } else {
            [-100, 100].forEach((ox) => {
                [-60, 60].forEach((oy) => {
                    this.enemies.push({
                        x: ox,
                        y: oy,
                        z: 2200,
                        vz: 520,
                        hp: 25,
                        maxHp: 25,
                        radius: 20,
                        shootTimer: 1.5
                    });
                });
            });
        }
    }

    updateEnemyLasers(dt) {
        for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
            const el = this.enemyLasers[i];
            el.x += el.vx * dt;
            el.y += el.vy * dt;
            el.z += el.vz * dt;
            el.life -= dt;

            // Player collision check at z ~ 0
            if (Math.abs(el.z) < 60) {
                const dist = Math.hypot(el.x - this.player.x, el.y - this.player.y);
                if (dist < 32) {
                    if (this.player.isRolling) {
                        // Barrel Roll Deflect!
                        el.vz = -el.vz * 1.5;
                        if (this.audio) this.audio.barrelRoll();
                        this.spawnParticles(el.x, el.y, el.z, '#00f0ff', 10);
                        continue;
                    } else if (this.player.invulnerable <= 0) {
                        this.takePlayerDamage(20);
                        this.enemyLasers.splice(i, 1);
                        continue;
                    }
                }
            }

            if (el.life <= 0 || el.z < -100) {
                this.enemyLasers.splice(i, 1);
            }
        }
    }

    initBoss() {
        this.boss = {
            name: "Valravn Dreadnought",
            x: 0,
            y: 50,
            z: 1400,
            active: true,
            shootTimer: 2.0,
            subsystems: [
                { name: "Left Shield Core", ox: -140, oy: 20, r: 35, hp: 120, maxHp: 120 },
                { name: "Right Laser Array", ox: 140, oy: 20, r: 35, hp: 120, maxHp: 120 },
                { name: "Quantum Reactor", ox: 0, oy: -20, r: 45, hp: 220, maxHp: 220 }
            ]
        };
    }

    updateBoss(dt) {
        const b = this.boss;
        if (!b || !b.active) return;

        // Hover movement
        b.x = Math.sin(Date.now() * 0.001) * 80;
        b.y = 50 + Math.cos(Date.now() * 0.0015) * 30;

        b.shootTimer -= dt;
        if (b.shootTimer <= 0) {
            b.shootTimer = 2.4;
            // Fire plasma spread from active subsystems
            b.subsystems.forEach(sub => {
                if (sub.hp > 0) {
                    this.enemyLasers.push({
                        x: b.x + sub.ox,
                        y: b.y + sub.oy,
                        z: b.z,
                        vx: (this.player.x - (b.x + sub.ox)) * 0.5,
                        vy: (this.player.y - (b.y + sub.oy)) * 0.5,
                        vz: -600,
                        life: 3.0
                    });
                }
            });
        }

        // Victory check: all 3 subsystems destroyed
        if (b.subsystems.every(s => s.hp <= 0)) {
            this.victory = true;
            b.active = false;
            if (this.audio) this.audio.victory();
        }
    }

    takePlayerDamage(dmg) {
        let rem = dmg;
        if (this.player.shield > 0) {
            const absorb = Math.min(this.player.shield, rem);
            this.player.shield -= absorb;
            rem -= absorb;
        }
        if (rem > 0) {
            this.player.hp = Math.max(0, this.player.hp - rem);
            this.player.invulnerable = 0.6;
            if (this.audio) this.audio.playerHurt();
        }

        if (this.player.hp <= 0) {
            this.gameOver = true;
            if (this.audio) this.audio.defeat();
        }
    }

    spawnParticles(x, y, z, color, count = 8) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                z,
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

        // Background space void & neon horizon
        this.renderBackground(ctx);

        // Warp Stars
        this.renderStars(ctx);

        // Enemies
        this.renderEnemies(ctx);

        // Boss Dreadnought
        if (this.boss && this.boss.active) {
            this.renderBoss(ctx);
        }

        // Projectiles (Lasers & Missiles)
        this.renderProjectiles(ctx);

        // Particles
        for (const pt of this.particles) {
            const proj = this.project(pt.x, pt.y, pt.z);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 4 * proj.scale * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Crosshair Reticle & Lock Brackets
        this.renderHUD(ctx);

        // Player Jet
        this.renderPlayer(ctx);

        // Overlays
        this.renderOverlays(ctx);
    }

    renderBackground(ctx) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#020408');
        bgGrad.addColorStop(0.65, '#0d1322');
        bgGrad.addColorStop(1, '#240a34');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Cyber Grid Floor
        ctx.strokeStyle = '#ff007f33';
        ctx.lineWidth = 1.5;
        const horizonY = this.height * 0.65;
        for (let x = -600; x <= 600; x += 100) {
            const p1 = this.project(x, -250, 10);
            const p2 = this.project(x, -250, 2000);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }

    renderStars(ctx) {
        for (const s of this.stars) {
            const proj = this.project(s.x, s.y, s.z);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(proj.x, proj.y, Math.max(1, 2.5 * proj.scale), Math.max(1, 2.5 * proj.scale));
        }
    }

    renderEnemies(ctx) {
        for (const en of this.enemies) {
            const proj = this.project(en.x, en.y, en.z);
            const size = en.radius * proj.scale * 2;

            ctx.save();
            ctx.translate(proj.x, proj.y);

            // Enemy Ship Polygon
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.6);
            ctx.lineTo(size * 0.7, size * 0.5);
            ctx.lineTo(0, size * 0.2);
            ctx.lineTo(-size * 0.7, size * 0.5);
            ctx.closePath();
            ctx.fill();

            // Lock-on bracket if targeted
            if (this.lockedTargets.has(en)) {
                ctx.strokeStyle = '#ffe600';
                ctx.lineWidth = 2;
                ctx.strokeRect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
            }

            ctx.restore();
        }
    }

    renderBoss(ctx) {
        const b = this.boss;
        const proj = this.project(b.x, b.y, b.z);
        const w = 340 * proj.scale;
        const h = 120 * proj.scale;

        ctx.save();
        ctx.translate(proj.x, proj.y);

        // Mothership Hull
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 12);
        ctx.fill();
        ctx.stroke();

        // Subsystems
        b.subsystems.forEach(sub => {
            const sx = sub.ox * proj.scale;
            const sy = -sub.oy * proj.scale;
            const sr = sub.r * proj.scale;

            if (sub.hp > 0) {
                ctx.fillStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(9, Math.round(12 * proj.scale))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(`${sub.hp}`, sx, sy + 4);
            } else {
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.arc(sx, sy, sr * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
    }

    renderProjectiles(ctx) {
        // Player Lasers
        for (const l of this.lasers) {
            const proj = this.project(l.x, l.y, l.z);
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, Math.max(2, 6 * proj.scale), 0, Math.PI * 2);
            ctx.fill();
        }

        // Enemy Lasers
        for (const el of this.enemyLasers) {
            const proj = this.project(el.x, el.y, el.z);
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, Math.max(3, 8 * proj.scale), 0, Math.PI * 2);
            ctx.fill();
        }

        // Homing Missiles
        for (const m of this.missiles) {
            const proj = this.project(m.x, m.y, m.z);
            ctx.fillStyle = '#ffe600';
            ctx.shadowColor = '#ffe600';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, Math.max(3, 7 * proj.scale), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderPlayer(ctx) {
        const p = this.player;
        const proj = this.project(p.x, p.y, 20);

        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(p.roll);

        if (p.invulnerable > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Aero Jet Frame (Sleek futuristic interceptor)
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(38, 22);
        ctx.lineTo(14, 14);
        ctx.lineTo(0, 20);
        ctx.lineTo(-14, 14);
        ctx.lineTo(-38, 22);
        ctx.closePath();
        ctx.fill();

        // Cockpit canopy
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, -6, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dual Neon Thruster Flames
        ctx.fillStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 14;
        const thrusterLen = 14 + Math.random() * 8;
        ctx.fillRect(-12, 18, 5, thrusterLen);
        ctx.fillRect(7, 18, 5, thrusterLen);

        // Shield bubble if high
        if (p.shield > 20) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, 48, 38, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderHUD(ctx) {
        ctx.save();

        // 1. Crosshair Reticle (Depth 200)
        const crossProj = this.project(this.crosshair.x, this.crosshair.y, 200);
        ctx.strokeStyle = this.isLocking ? '#ffe600' : '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(crossProj.x, crossProj.y, 18, 0, Math.PI * 2);
        ctx.stroke();

        // Reticle ticks
        ctx.beginPath();
        ctx.moveTo(crossProj.x - 24, crossProj.y); ctx.lineTo(crossProj.x - 12, crossProj.y);
        ctx.moveTo(crossProj.x + 12, crossProj.y); ctx.lineTo(crossProj.x + 24, crossProj.y);
        ctx.moveTo(crossProj.x, crossProj.y - 24); ctx.lineTo(crossProj.x, crossProj.y - 12);
        ctx.moveTo(crossProj.x, crossProj.y + 12); ctx.lineTo(crossProj.x, crossProj.y + 24);
        ctx.stroke();

        // 2. Health & Shield Panel (Top Left)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(20, 20, 220, 68, 8);
        ctx.fill();
        ctx.stroke();

        // HP
        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('HULL INTEGRITY', 32, 36);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(32, 42, 196, 10);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(32, 42, 196 * (this.player.hp / this.player.maxHp), 10);

        // Shield
        ctx.fillStyle = '#8b949e';
        ctx.fillText('ENERGY SHIELD', 32, 62);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(32, 68, 196, 8);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(32, 68, 196 * (this.player.shield / this.player.maxShield), 8);

        // 3. Torpedo Ammo (Bottom Left)
        ctx.fillStyle = '#ffe600';
        ctx.font = '14px sans-serif';
        ctx.fillText(`🚀 PHOTON TORPEDOES: ${'▲ '.repeat(this.player.missiles)}`, 20, this.height - 25);

        // 4. Score & Distance (Top Right)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.beginPath();
        ctx.roundRect(this.width - 150, 20, 130, 60, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`SCORE: ${this.score}`, this.width - 138, 44);
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText(`DIST: ${Math.round(this.distance)}m`, this.width - 138, 66);

        ctx.restore();
    }

    renderOverlays(ctx) {
        if (this.gameOver || this.victory) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.88)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = this.victory ? '#39ff14' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 25;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.victory ? "MOTHERSHIP DESTROYED!" : "MISSION FAILED: SHOT DOWN", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Final Combat Score: ${this.score}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Press SPACE to Scramble Again', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlightEngine };
}
