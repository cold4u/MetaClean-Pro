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

class ShinobiEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;
        this.worldWidth = 2400;

        // Camera
        this.cameraX = 0;

        // Player physics & combat
        this.player = {
            x: 80,
            y: 450,
            w: 24,
            h: 38,
            vx: 0,
            vy: 0,
            facing: 1, // 1 right, -1 left
            isGrounded: false,
            canDoubleJump: true,
            isWallSliding: false,
            wallDir: 0,
            isDashing: false,
            dashTimer: 0,
            dashCooldown: 0,
            isSlashing: false,
            slashTimer: 0,
            hp: 100,
            maxHp: 100,
            shurikens: 5,
            maxShurikens: 5,
            shurikenRegen: 0,
            invulnerable: 0
        };

        this.gravity = 980;
        this.speed = 280;
        this.jumpPower = -440;

        // Controls
        this.keys = {
            left: false,
            right: false,
            jump: false,
            dash: false,
            slash: false,
            shuriken: false
        };

        // Combat projectiles & effects
        this.projectiles = []; // { x, y, vx, vy, radius, isPlayer, damage }
        this.afterimages = [];
        this.particles = [];
        this.hitstopTimer = 0;

        // Style Combo Meter
        this.styleScore = 0;
        this.styleDecay = 0;
        this.ranks = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
        this.currentRank = 'D';

        // Platforms & Level geometry
        this.platforms = [];
        this.buildLevel();

        // Enemies & Boss
        this.enemies = [];
        this.boss = null;
        this.initEnemies();

        this.gameOver = false;
        this.victory = false;
    }

    buildLevel() {
        this.platforms = [
            // Floors
            { x: 0, y: 540, w: 2400, h: 60 },
            // Rooftops & Steps
            { x: 220, y: 440, w: 160, h: 20 },
            { x: 440, y: 350, w: 180, h: 20 },
            { x: 680, y: 420, w: 140, h: 20 },
            { x: 900, y: 310, w: 200, h: 20 },
            { x: 1180, y: 410, w: 180, h: 20 },
            { x: 1420, y: 320, w: 220, h: 20 },
            { x: 1720, y: 400, w: 200, h: 20 },
            { x: 1980, y: 460, w: 400, h: 20 }, // Boss arena platform

            // Walls for wall jumps
            { x: 620, y: 220, w: 20, h: 200 },
            { x: 1100, y: 200, w: 20, h: 220 },
            { x: 1640, y: 210, w: 20, h: 200 }
        ];
    }

    initEnemies() {
        this.enemies = [
            { x: 500, y: 310, w: 26, h: 36, type: 'enforcer', hp: 30, maxHp: 30, patrolMin: 440, patrolMax: 600, speed: 60, facing: 1, shootTimer: 2.0 },
            { x: 740, y: 280, w: 24, h: 24, type: 'drone', hp: 15, maxHp: 15, hoverY: 280, shootTimer: 2.5 },
            { x: 980, y: 270, w: 26, h: 36, type: 'enforcer', hp: 30, maxHp: 30, patrolMin: 900, patrolMax: 1080, speed: 60, facing: 1, shootTimer: 1.8 },
            { x: 1240, y: 250, w: 24, h: 24, type: 'drone', hp: 15, maxHp: 15, hoverY: 250, shootTimer: 2.2 },
            { x: 1500, y: 280, w: 26, h: 36, type: 'enforcer', hp: 30, maxHp: 30, patrolMin: 1420, patrolMax: 1620, speed: 70, facing: 1, shootTimer: 1.5 },
            { x: 1800, y: 360, w: 26, h: 36, type: 'enforcer', hp: 30, maxHp: 30, patrolMin: 1720, patrolMax: 1900, speed: 70, facing: 1, shootTimer: 1.5 }
        ];

        this.boss = {
            name: "Cyber Daimyo",
            x: 2150,
            y: 400,
            w: 36,
            h: 52,
            hp: 350,
            maxHp: 350,
            attackTimer: 3.0,
            state: 'idle', // 'idle', 'teleport', 'slash_wave', 'burst'
            facing: -1,
            active: false
        };
    }

    triggerJump() {
        const p = this.player;
        if (p.isGrounded) {
            p.vy = this.jumpPower;
            p.isGrounded = false;
            p.canDoubleJump = true;
            if (this.audio) this.audio.jump();
        } else if (p.isWallSliding) {
            p.vy = this.jumpPower * 0.9;
            p.vx = -p.wallDir * this.speed * 1.2;
            p.facing = -p.wallDir;
            p.isWallSliding = false;
            p.canDoubleJump = true;
            if (this.audio) this.audio.jump();
        } else if (p.canDoubleJump) {
            p.vy = this.jumpPower * 0.85;
            p.canDoubleJump = false;
            if (this.audio) this.audio.jump();
            this.spawnParticles(p.x + p.w / 2, p.y + p.h, '#00f0ff', 6);
        }
    }

    triggerDash() {
        const p = this.player;
        if (p.dashCooldown > 0 || p.isDashing) return;
        p.isDashing = true;
        p.dashTimer = 0.18;
        p.dashCooldown = 0.65;
        p.invulnerable = 0.22;
        p.vx = p.facing * 750;
        p.vy = 0;
        if (this.audio) this.audio.dash();
    }

    triggerSlash() {
        const p = this.player;
        if (p.isSlashing) return;
        p.isSlashing = true;
        p.slashTimer = 0.22;
        if (this.audio) this.audio.slash();

        // Hitbox check against enemies
        const slashRange = 65;
        const slashCenterX = p.x + (p.facing > 0 ? p.w + 20 : -20);
        const slashCenterY = p.y + p.h / 2;

        this.enemies.forEach(en => {
            const dist = Math.hypot((en.x + en.w / 2) - slashCenterX, (en.y + en.h / 2) - slashCenterY);
            if (dist < slashRange) {
                en.hp -= 25;
                if (this.audio) this.audio.enemyHit();
                this.addStyleScore(20);
                this.spawnParticles(en.x + en.w / 2, en.y + en.h / 2, '#ff0055', 8);
            }
        });

        // Hitbox check against boss
        if (this.boss && this.boss.active && this.boss.hp > 0) {
            const dist = Math.hypot((this.boss.x + this.boss.w / 2) - slashCenterX, (this.boss.y + this.boss.h / 2) - slashCenterY);
            if (dist < slashRange + 10) {
                this.boss.hp -= 20;
                if (this.audio) this.audio.enemyHit();
                this.addStyleScore(25);
                this.spawnParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#ffe600', 10);
                if (this.boss.hp <= 0) {
                    this.victory = true;
                    if (this.audio) this.audio.victory();
                }
            }
        }

        // Projectile deflection / parry
        this.projectiles.forEach(proj => {
            if (!proj.isPlayer) {
                const dist = Math.hypot(proj.x - slashCenterX, proj.y - slashCenterY);
                if (dist < slashRange) {
                    // Parried! Redirect bullet with lethal speed!
                    proj.isPlayer = true;
                    proj.vx = p.facing * 600;
                    proj.vy = 0;
                    proj.damage = 45;
                    this.hitstopTimer = 0.08; // Freeze frame
                    this.addStyleScore(40);
                    if (this.audio) this.audio.parry();
                    this.spawnParticles(proj.x, proj.y, '#00f0ff', 12);
                }
            }
        });
    }

    triggerShuriken() {
        const p = this.player;
        if (p.shurikens <= 0) return;
        p.shurikens--;
        if (this.audio) this.audio.shuriken();

        this.projectiles.push({
            x: p.x + (p.facing > 0 ? p.w + 4 : -4),
            y: p.y + p.h * 0.4,
            vx: p.facing * 650,
            vy: 0,
            radius: 5,
            isPlayer: true,
            damage: 15
        });
    }

    addStyleScore(points) {
        this.styleScore += points;
        this.styleDecay = 3.5;
        this.updateRank();
    }

    updateRank() {
        const oldRank = this.currentRank;
        if (this.styleScore > 350) this.currentRank = 'SSS';
        else if (this.styleScore > 260) this.currentRank = 'SS';
        else if (this.styleScore > 180) this.currentRank = 'S';
        else if (this.styleScore > 120) this.currentRank = 'A';
        else if (this.styleScore > 70) this.currentRank = 'B';
        else if (this.styleScore > 25) this.currentRank = 'C';
        else this.currentRank = 'D';

        if (this.currentRank !== oldRank && this.ranks.indexOf(this.currentRank) > this.ranks.indexOf(oldRank)) {
            if (this.audio) this.audio.rankUp();
        }
    }

    update(dt) {
        if (this.gameOver || this.victory) return;

        // Hitstop freeze frame
        if (this.hitstopTimer > 0) {
            this.hitstopTimer -= dt;
            return;
        }

        const p = this.player;

        // Cooldowns & timers
        if (p.dashCooldown > 0) p.dashCooldown -= dt;
        if (p.invulnerable > 0) p.invulnerable -= dt;

        if (p.dashTimer > 0) {
            p.dashTimer -= dt;
            if (p.dashTimer <= 0) {
                p.isDashing = false;
                p.vx = p.facing * this.speed;
            }
            // Spawn dash afterimage
            this.afterimages.push({
                x: p.x,
                y: p.y,
                facing: p.facing,
                alpha: 0.7
            });
        }

        if (p.slashTimer > 0) {
            p.slashTimer -= dt;
            if (p.slashTimer <= 0) p.isSlashing = false;
        }

        // Shuriken regeneration
        if (p.shurikens < p.maxShurikens) {
            p.shurikenRegen += dt;
            if (p.shurikenRegen >= 2.0) {
                p.shurikens++;
                p.shurikenRegen = 0;
            }
        }

        // Style score decay
        if (this.styleDecay > 0) {
            this.styleDecay -= dt;
        } else if (this.styleScore > 0) {
            this.styleScore = Math.max(0, this.styleScore - 25 * dt);
            this.updateRank();
        }

        // Horizontal Movement
        if (!p.isDashing) {
            if (this.keys.left) {
                p.vx = -this.speed;
                p.facing = -1;
            } else if (this.keys.right) {
                p.vx = this.speed;
                p.facing = 1;
            } else {
                p.vx = 0;
            }

            // Gravity
            p.vy += this.gravity * dt;
        }

        // Wall sliding
        p.isWallSliding = false;
        p.wallDir = 0;

        // Move X & Platform Collisions
        p.x += p.vx * dt;
        p.x = Math.max(0, Math.min(this.worldWidth - p.w, p.x));

        for (const plat of this.platforms) {
            if (this.checkOverlap(p, plat)) {
                if (p.vx > 0) {
                    p.x = plat.x - p.w;
                    if (!p.isGrounded && p.vy > 0) {
                        p.isWallSliding = true;
                        p.wallDir = 1;
                        p.vy = Math.min(p.vy, 80);
                    }
                } else if (p.vx < 0) {
                    p.x = plat.x + plat.w;
                    if (!p.isGrounded && p.vy > 0) {
                        p.isWallSliding = true;
                        p.wallDir = -1;
                        p.vy = Math.min(p.vy, 80);
                    }
                }
            }
        }

        // Move Y & Platform Collisions
        p.isGrounded = false;
        p.y += p.vy * dt;

        for (const plat of this.platforms) {
            if (this.checkOverlap(p, plat)) {
                if (p.vy > 0) {
                    p.y = plat.y - p.h;
                    p.vy = 0;
                    p.isGrounded = true;
                    p.canDoubleJump = true;
                } else if (p.vy < 0) {
                    p.y = plat.y + plat.h;
                    p.vy = 0;
                }
            }
        }

        // Update Camera
        this.cameraX = Math.max(0, Math.min(this.worldWidth - this.width, p.x - this.width * 0.4));

        // Update Projectiles
        this.updateProjectiles(dt);

        // Update Enemies
        this.updateEnemies(dt);

        // Update Boss
        this.updateBoss(dt);

        // Update Afterimages & Particles
        this.updateEffects(dt);
    }

    checkOverlap(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;

            // Off screen / bounds
            if (proj.x < 0 || proj.x > this.worldWidth || proj.y < 0 || proj.y > 600) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Hit enemy
            if (proj.isPlayer) {
                let hit = false;
                for (const en of this.enemies) {
                    if (proj.x > en.x && proj.x < en.x + en.w && proj.y > en.y && proj.y < en.y + en.h) {
                        en.hp -= proj.damage;
                        hit = true;
                        this.addStyleScore(15);
                        if (this.audio) this.audio.enemyHit();
                        this.spawnParticles(proj.x, proj.y, '#00f0ff', 6);
                        break;
                    }
                }
                if (!hit && this.boss && this.boss.active && this.boss.hp > 0) {
                    if (proj.x > this.boss.x && proj.x < this.boss.x + this.boss.w && proj.y > this.boss.y && proj.y < this.boss.y + this.boss.h) {
                        this.boss.hp -= proj.damage;
                        hit = true;
                        this.addStyleScore(20);
                        if (this.audio) this.audio.enemyHit();
                        this.spawnParticles(proj.x, proj.y, '#ffe600', 8);
                        if (this.boss.hp <= 0) {
                            this.victory = true;
                            if (this.audio) this.audio.victory();
                        }
                    }
                }
                if (hit) {
                    this.projectiles.splice(i, 1);
                    continue;
                }
            } else {
                // Enemy projectile hitting player
                const p = this.player;
                if (p.invulnerable <= 0 && proj.x > p.x && proj.x < p.x + p.w && proj.y > p.y && proj.y < p.y + p.h) {
                    p.hp -= proj.damage;
                    p.invulnerable = 0.8;
                    if (this.audio) this.audio.playerHurt();
                    this.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#ff0055', 8);
                    this.projectiles.splice(i, 1);

                    if (p.hp <= 0) {
                        this.gameOver = true;
                        if (this.audio) this.audio.defeat();
                    }
                    continue;
                }
            }
        }
    }

    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const en = this.enemies[i];
            if (en.hp <= 0) {
                this.enemies.splice(i, 1);
                this.addStyleScore(50);
                this.spawnParticles(en.x + en.w / 2, en.y + en.h / 2, '#ff007f', 16);
                continue;
            }

            if (en.type === 'enforcer') {
                en.x += en.speed * en.facing * dt;
                if (en.x < en.patrolMin) { en.x = en.patrolMin; en.facing = 1; }
                if (en.x > en.patrolMax) { en.x = en.patrolMax; en.facing = -1; }

                en.shootTimer -= dt;
                if (en.shootTimer <= 0) {
                    en.shootTimer = 2.4;
                    // Shoot towards player if nearby
                    if (Math.abs(en.x - this.player.x) < 450) {
                        const dir = this.player.x > en.x ? 1 : -1;
                        this.projectiles.push({
                            x: en.x + (dir > 0 ? en.w + 4 : -4),
                            y: en.y + en.h * 0.4,
                            vx: dir * 320,
                            vy: 0,
                            radius: 5,
                            isPlayer: false,
                            damage: 18
                        });
                    }
                }
            } else if (en.type === 'drone') {
                en.y = en.hoverY + Math.sin(Date.now() * 0.004) * 15;
                en.shootTimer -= dt;
                if (en.shootTimer <= 0) {
                    en.shootTimer = 2.0;
                    if (Math.abs(en.x - this.player.x) < 500) {
                        const angle = Math.atan2(this.player.y - en.y, this.player.x - en.x);
                        this.projectiles.push({
                            x: en.x + en.w / 2,
                            y: en.y + en.h / 2,
                            vx: Math.cos(angle) * 280,
                            vy: Math.sin(angle) * 280,
                            radius: 5,
                            isPlayer: false,
                            damage: 15
                        });
                    }
                }
            }
        }
    }

    updateBoss(dt) {
        const b = this.boss;
        if (!b) return;

        // Activate boss when player enters boss arena
        if (!b.active && this.player.x > 1900) {
            b.active = true;
            if (this.audio) this.audio.bossRoar();
        }

        if (!b.active || b.hp <= 0) return;

        b.facing = this.player.x > b.x ? 1 : -1;
        b.attackTimer -= dt;

        if (b.attackTimer <= 0) {
            b.attackTimer = 2.8;
            // Boss attack patterns: 3-way spread fire or teleport dash
            const pattern = Math.random();
            if (pattern < 0.6) {
                // 3-way projectile burst
                const baseAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
                [-0.25, 0, 0.25].forEach(offset => {
                    this.projectiles.push({
                        x: b.x + b.w / 2,
                        y: b.y + b.h / 2,
                        vx: Math.cos(baseAngle + offset) * 340,
                        vy: Math.sin(baseAngle + offset) * 340,
                        radius: 6,
                        isPlayer: false,
                        damage: 22
                    });
                });
            } else {
                // Teleport behind or above player
                b.x = Math.max(1980, Math.min(2350, this.player.x + (Math.random() < 0.5 ? 120 : -120)));
                this.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#a855f7', 15);
            }
        }
    }

    updateEffects(dt) {
        // Afterimages
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            const img = this.afterimages[i];
            img.alpha -= 3.5 * dt;
            if (img.alpha <= 0) this.afterimages.splice(i, 1);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count = 6) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 240,
                vy: (Math.random() - 0.5) * 240,
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

        // Background: Cyber City Skyline with parallax
        this.renderSkyline(ctx);

        ctx.save();
        ctx.translate(-this.cameraX, 0);

        // Platforms & Architecture
        this.renderPlatforms(ctx);

        // Afterimages
        for (const img of this.afterimages) {
            ctx.save();
            ctx.globalAlpha = img.alpha;
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(img.x, img.y, this.player.w, this.player.h);
            ctx.restore();
        }

        // Enemies
        this.renderEnemies(ctx);

        // Boss
        if (this.boss && this.boss.active) {
            this.renderBoss(ctx);
        }

        // Player Shinobi
        this.renderPlayer(ctx);

        // Projectiles
        this.renderProjectiles(ctx);

        // Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // HUD (HP bar, Kunai ammo, Combo Rank SSS)
        this.renderHUD(ctx);

        // Overlays
        this.renderOverlays(ctx);
    }

    renderSkyline(ctx) {
        // Dark synth gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#05070a');
        bgGrad.addColorStop(0.7, '#0d111c');
        bgGrad.addColorStop(1, '#1b0d2a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Distant cyber towers (Parallax)
        ctx.save();
        const paraOffset = this.cameraX * 0.15;
        for (let i = 0; i < 16; i++) {
            const bx = i * 140 - (paraOffset % 140);
            const bh = 180 + (i % 5) * 60;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(bx, this.height - bh, 110, bh);

            // Tower window lights
            ctx.fillStyle = '#ff007f33';
            for (let r = 0; r < 4; r++) {
                ctx.fillRect(bx + 15 + r * 22, this.height - bh + 20, 10, 16);
            }
        }
        ctx.restore();
    }

    renderPlatforms(ctx) {
        for (const plat of this.platforms) {
            ctx.fillStyle = '#0d1117';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 4);
            ctx.fill();
            ctx.stroke();

            // Neon roof trim
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(plat.x, plat.y, plat.w, 3);
        }
    }

    renderPlayer(ctx) {
        const p = this.player;
        ctx.save();
        ctx.translate(p.x, p.y);

        // Invulnerability flicker
        if (p.invulnerable > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Shinobi Body
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, p.w, p.h);

        // Cyber Visor / Mask
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fillRect(p.facing > 0 ? p.w - 12 : 2, 6, 10, 5);

        // Neon Scarf trailing in wind
        ctx.fillStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const scarfDir = -p.facing;
        ctx.moveTo(p.w / 2, 10);
        ctx.lineTo(p.w / 2 + scarfDir * 20, 12 + Math.sin(Date.now() * 0.01) * 6);
        ctx.lineTo(p.w / 2 + scarfDir * 32, 22);
        ctx.lineTo(p.w / 2 + scarfDir * 16, 18);
        ctx.closePath();
        ctx.fill();

        // Katana Slash Arc visual
        if (p.isSlashing) {
            ctx.strokeStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 16;
            ctx.lineWidth = 4;
            ctx.beginPath();
            const sx = p.w / 2;
            const sy = p.h / 2;
            const startAngle = p.facing > 0 ? -Math.PI * 0.4 : Math.PI * 0.6;
            const endAngle = p.facing > 0 ? Math.PI * 0.4 : Math.PI * 1.4;
            ctx.arc(sx, sy, 52, startAngle, endAngle);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderEnemies(ctx) {
        this.enemies.forEach(en => {
            ctx.save();
            ctx.translate(en.x, en.y);

            if (en.type === 'enforcer') {
                ctx.fillStyle = '#7f1d1d';
                ctx.fillRect(0, 0, en.w, en.h);
                // Glowing red optic
                ctx.fillStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 8;
                ctx.fillRect(en.facing > 0 ? en.w - 8 : 2, 6, 6, 6);
            } else if (en.type === 'drone') {
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.arc(en.w / 2, en.h / 2, en.w / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(en.w / 2, en.h / 2, en.w / 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Health bar
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, -8, en.w, 4);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(0, -8, en.w * (en.hp / en.maxHp), 4);
            ctx.restore();
        });
    }

    renderBoss(ctx) {
        const b = this.boss;
        ctx.save();
        ctx.translate(b.x, b.y);

        ctx.fillStyle = '#3b0764';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(0, 0, b.w, b.h, 6);
        ctx.fill();
        ctx.stroke();

        // Daimyo Cyber Horns / Crest
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(b.w / 2, -14);
        ctx.lineTo(b.w / 2 - 14, 2);
        ctx.lineTo(b.w / 2 + 14, 2);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(b.facing > 0 ? b.w - 12 : 4, 10, 8, 4);

        ctx.restore();
    }

    renderProjectiles(ctx) {
        for (const proj of this.projectiles) {
            ctx.fillStyle = proj.isPlayer ? '#00f0ff' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderHUD(ctx) {
        ctx.save();

        // 1. Health Bar (Top Left)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(20, 20, 220, 56, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('SHINOBI VITALITY', 32, 36);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(32, 44, 196, 12);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(32, 44, 196 * (this.player.hp / this.player.maxHp), 12);

        // 2. Shurikens & Dash Ready
        ctx.fillStyle = '#00f0ff';
        ctx.font = '14px sans-serif';
        ctx.fillText(`⚡ KUNAI: ${'◆ '.repeat(this.player.shurikens)}`, 32, 92);

        // 3. Style Rank (Top Right)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#a855f7';
        ctx.beginPath();
        ctx.roundRect(this.width - 120, 20, 100, 75, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('STYLE RANK', this.width - 108, 38);

        const rankColors = { D: '#94a3b8', C: '#38bdf8', B: '#34d399', A: '#facc15', S: '#fb923c', SS: '#f43f5e', SSS: '#d946ef' };
        ctx.fillStyle = rankColors[this.currentRank] || '#ffffff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(this.currentRank, this.width - 92, 78);

        // 4. Boss HP bar if active
        if (this.boss && this.boss.active && this.boss.hp > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
            ctx.beginPath();
            ctx.roundRect(this.width / 2 - 180, 20, 360, 46, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffe600';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.boss.name.toUpperCase(), this.width / 2, 36);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(this.width / 2 - 160, 44, 320, 10);
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(this.width / 2 - 160, 44, 320 * (this.boss.hp / this.boss.maxHp), 10);
        }

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
            ctx.fillText(this.victory ? "MISSION ACCOMPLISHED" : "SHINOBI FALLEN", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Style Grade: ${this.currentRank}  |  Score: ${Math.round(this.styleScore)}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Press SPACE to Restart Mission', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShinobiEngine };
}
