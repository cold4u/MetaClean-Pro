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

class FighterEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;
        this.floorY = 480;

        // Best of 3 Rounds
        this.currentRound = 1;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.roundState = 'intro'; // 'intro', 'fight', 'ko', 'match_over'
        this.roundTimer = 2.0;

        // Player 1 (Neon Striker)
        this.p1 = this.createFighter(180, 1, '#00f0ff', "Neon Striker");

        // Player 2 / CPU (Shadow Borg)
        this.p2 = this.createFighter(580, -1, '#ff0055', "Shadow Borg");

        // Controls
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            punch: false,
            kick: false,
            fireball: false
        };

        // Projectiles
        this.fireballs = []; // { x, y, vx, owner, damage, radius }
        this.particles = [];
        this.floatingTexts = [];
        this.hitstopTimer = 0;

        this.cpuAiTimer = 0.2;
    }

    createFighter(x, facing, color, name) {
        return {
            x: x,
            y: this.floorY,
            w: 48,
            h: 96,
            vx: 0,
            vy: 0,
            facing: facing,
            hp: 100,
            maxHp: 100,
            superMeter: 0,
            state: 'idle', // 'idle', 'walk_fwd', 'walk_back', 'jump', 'punch', 'kick', 'fireball', 'block', 'hurt', 'ko'
            stateTimer: 0,
            isGrounded: true,
            color: color,
            name: name,
            comboCount: 0
        };
    }

    startRound() {
        this.p1.x = 220;
        this.p1.y = this.floorY;
        this.p1.vx = 0;
        this.p1.vy = 0;
        this.p1.hp = 100;
        this.p1.state = 'idle';

        this.p2.x = 540;
        this.p2.y = this.floorY;
        this.p2.vx = 0;
        this.p2.vy = 0;
        this.p2.hp = 100;
        this.p2.state = 'idle';

        this.fireballs = [];
        this.roundState = 'intro';
        this.roundTimer = 1.6;
        if (this.audio) this.audio.roundStart();
    }

    triggerAction(fighter, action) {
        if (fighter.state === 'hurt' || fighter.state === 'ko' || this.roundState !== 'fight') return;
        if (['punch', 'kick', 'fireball'].includes(fighter.state)) return; // Busy

        if (action === 'punch') {
            fighter.state = 'punch';
            fighter.stateTimer = 0.16;
            if (this.audio) this.audio.punch();
            this.checkMeleeHit(fighter, 65, 8, 40);
        } else if (action === 'kick') {
            fighter.state = 'kick';
            fighter.stateTimer = 0.24;
            if (this.audio) this.audio.kick();
            this.checkMeleeHit(fighter, 85, 16, 90);
        } else if (action === 'fireball') {
            fighter.state = 'fireball';
            fighter.stateTimer = 0.28;
            if (this.audio) this.audio.fireball();

            this.fireballs.push({
                x: fighter.x + (fighter.facing > 0 ? fighter.w + 10 : -10),
                y: fighter.y - fighter.h * 0.55,
                vx: fighter.facing * 450,
                owner: fighter,
                damage: 20,
                radius: 12
            });
        }
    }

    checkMeleeHit(attacker, range, damage, pushback) {
        const defender = attacker === this.p1 ? this.p2 : this.p1;
        const dist = Math.abs((attacker.x + attacker.w / 2) - (defender.x + defender.w / 2));
        const inDirection = (attacker.facing > 0 && defender.x > attacker.x) || (attacker.facing < 0 && defender.x < attacker.x);

        if (dist <= range && inDirection && Math.abs(attacker.y - defender.y) < 60) {
            this.applyDamage(attacker, defender, damage, pushback);
        }
    }

    applyDamage(attacker, defender, baseDamage, pushback) {
        // Check if defender is blocking (holding away from attacker)
        const isHoldingBack = (defender === this.p1 && ((defender.facing > 0 && this.keys.left) || (defender.facing < 0 && this.keys.right))) ||
                              (defender === this.p2 && Math.random() < 0.4);

        if (isHoldingBack && defender.state !== 'hurt' && defender.state !== 'ko') {
            // Guard Block! Reduces damage by 80%
            const blockDmg = Math.max(1, Math.round(baseDamage * 0.2));
            defender.hp = Math.max(0, defender.hp - blockDmg);
            defender.state = 'block';
            defender.stateTimer = 0.12;
            defender.x += defender.facing * -pushback * 0.4;
            if (this.audio) this.audio.block();
            this.addFloatingText("BLOCK!", defender.x, defender.y - defender.h, '#00f0ff');
            if (defender.hp <= 0) {
                defender.state = 'ko';
                this.handleRoundKO(attacker);
            }
            return;
        }

        // Direct Hit!
        defender.hp = Math.max(0, defender.hp - baseDamage);
        defender.state = 'hurt';
        defender.stateTimer = 0.22;
        defender.x += attacker.facing * pushback;
        defender.vx = attacker.facing * 80;

        attacker.comboCount++;
        attacker.superMeter = Math.min(100, attacker.superMeter + 15);

        this.hitstopTimer = 0.06; // Freeze frame
        if (this.audio) this.audio.hit();
        this.addFloatingText(`-${baseDamage}`, defender.x, defender.y - defender.h, '#ff0055');
        this.spawnParticles(defender.x + defender.w / 2, defender.y - defender.h / 2, '#ff0055', 10);

        if (defender.hp <= 0) {
            defender.state = 'ko';
            this.handleRoundKO(attacker);
        }
    }

    handleRoundKO(winner) {
        this.roundState = 'ko';
        this.roundTimer = 2.5;
        if (this.audio) this.audio.ko();

        if (winner === this.p1) this.p1Wins++;
        else this.p2Wins++;

        if (this.p1Wins >= 2 || this.p2Wins >= 2) {
            this.roundState = 'match_over';
            if (this.audio && this.p1Wins >= 2) this.audio.victory();
        }
    }

    update(dt) {
        // Hitstop freeze frame
        if (this.hitstopTimer > 0) {
            this.hitstopTimer -= dt;
            return;
        }

        // Round timers
        if (this.roundState === 'intro') {
            this.roundTimer -= dt;
            if (this.roundTimer <= 0) this.roundState = 'fight';
        } else if (this.roundState === 'ko') {
            this.roundTimer -= dt;
            if (this.roundTimer <= 0) {
                this.currentRound++;
                this.startRound();
            }
        }

        if (this.roundState === 'fight') {
            this.updatePlayer(dt);
            this.updateCPU(dt);
            this.updateProjectiles(dt);
        }

        this.updateFighterPhysics(this.p1, dt);
        this.updateFighterPhysics(this.p2, dt);

        // Facing direction tracking
        if (this.p1.state !== 'hurt' && this.p1.state !== 'ko') {
            this.p1.facing = this.p2.x > this.p1.x ? 1 : -1;
        }
        if (this.p2.state !== 'hurt' && this.p2.state !== 'ko') {
            this.p2.facing = this.p1.x > this.p2.x ? 1 : -1;
        }

        // Effects
        this.updateEffects(dt);
    }

    updatePlayer(dt) {
        const p = this.p1;
        if (['punch', 'kick', 'fireball', 'hurt', 'ko'].includes(p.state)) return;

        // Ground Movement
        if (p.isGrounded) {
            if (this.keys.left) {
                p.vx = -180;
                p.state = p.facing > 0 ? 'walk_back' : 'walk_fwd';
            } else if (this.keys.right) {
                p.vx = 180;
                p.state = p.facing > 0 ? 'walk_fwd' : 'walk_back';
            } else {
                p.vx = 0;
                p.state = 'idle';
            }

            // Jump
            if (this.keys.up) {
                p.vy = -450;
                p.isGrounded = false;
                p.state = 'jump';
            }
        }
    }

    updateCPU(dt) {
        const cpu = this.p2;
        const player = this.p1;
        if (['punch', 'kick', 'fireball', 'hurt', 'ko'].includes(cpu.state)) return;

        this.cpuAiTimer -= dt;
        if (this.cpuAiTimer <= 0) {
            this.cpuAiTimer = 0.25 + Math.random() * 0.2;
            const dist = Math.abs(cpu.x - player.x);

            if (dist > 300) {
                // Far: Fireball or approach
                if (Math.random() < 0.4) {
                    this.triggerAction(cpu, 'fireball');
                } else {
                    cpu.vx = cpu.facing * 160;
                }
            } else if (dist > 80) {
                // Mid: Walk in or jump attack
                cpu.vx = cpu.facing * 160;
                if (Math.random() < 0.15 && cpu.isGrounded) {
                    cpu.vy = -420;
                    cpu.isGrounded = false;
                }
            } else {
                // Close: Strike!
                cpu.vx = 0;
                const rand = Math.random();
                if (rand < 0.5) this.triggerAction(cpu, 'punch');
                else if (rand < 0.85) this.triggerAction(cpu, 'kick');
                else this.triggerAction(cpu, 'fireball');
            }
        }
    }

    updateFighterPhysics(fighter, dt) {
        // Timers
        if (fighter.stateTimer > 0) {
            fighter.stateTimer -= dt;
            if (fighter.stateTimer <= 0) {
                if (fighter.state !== 'ko') fighter.state = 'idle';
            }
        }

        // Gravity
        if (!fighter.isGrounded) {
            fighter.vy += 980 * dt;
        }

        fighter.x += fighter.vx * dt;
        fighter.y += fighter.vy * dt;

        // Ground landing
        if (fighter.y >= this.floorY) {
            fighter.y = this.floorY;
            fighter.vy = 0;
            fighter.isGrounded = true;
            if (fighter.state === 'jump') fighter.state = 'idle';
        }

        // Arena boundaries
        fighter.x = Math.max(40, Math.min(this.width - 40 - fighter.w, fighter.x));
    }

    updateProjectiles(dt) {
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fb = this.fireballs[i];
            fb.x += fb.vx * dt;

            // Off screen
            if (fb.x < 20 || fb.x > this.width - 20) {
                this.fireballs.splice(i, 1);
                continue;
            }

            // Target collision
            const target = fb.owner === this.p1 ? this.p2 : this.p1;
            if (target.state !== 'ko' && Math.abs(fb.x - (target.x + target.w / 2)) < target.w / 2 + fb.radius &&
                Math.abs(fb.y - (target.y - target.h / 2)) < target.h / 2) {
                this.applyDamage(fb.owner, target, fb.damage, 60);
                this.fireballs.splice(i, 1);
            }
        }
    }

    updateEffects(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 30 * dt;
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

    spawnParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 180,
                vy: (Math.random() - 0.5) * 180,
                color,
                life: 0.35,
                maxLife: 0.35
            });
        }
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({ text, x, y, color, life: 0.9, maxLife: 0.9 });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Background: Cyberpunk Dojo / Neon Alley
        this.renderArena(ctx);

        // Health Bars & Round Counters
        this.renderHUD(ctx);

        // Fighters
        this.renderFighter(ctx, this.p1);
        this.renderFighter(ctx, this.p2);

        // Fireballs
        for (const fb of this.fireballs) {
            ctx.save();
            ctx.fillStyle = fb.owner === this.p1 ? '#00f0ff' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, fb.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Particles & Floating Text
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }

        // Overlays (Round 1, Fight, K.O., Victory)
        this.renderOverlays(ctx);
    }

    renderArena(ctx) {
        // Dark Neon Dojo Background
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#090514');
        grad.addColorStop(0.7, '#180e2b');
        grad.addColorStop(1, '#05070a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Arena Floor
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, this.floorY, this.width, this.height - this.floorY);

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, this.floorY);
        ctx.lineTo(this.width, this.floorY);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    renderHUD(ctx) {
        // Player 1 HP Bar (Left)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(40, 30, 300, 20);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(40, 30, 300 * (this.p1.hp / this.p1.maxHp), 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.p1.name, 40, 24);

        // Player 2 HP Bar (Right)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.width - 340, 30, 300, 20);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(this.width - 40 - 300 * (this.p2.hp / this.p2.maxHp), 30, 300 * (this.p2.hp / this.p2.maxHp), 20);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(this.p2.name, this.width - 40, 24);

        // Round Score Icons (Center)
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`ROUND ${this.currentRound}`, this.width / 2, 45);

        ctx.font = '14px sans-serif';
        ctx.fillText(`${'● '.repeat(this.p1Wins)}VS  ${'● '.repeat(this.p2Wins)}`, this.width / 2, 65);
    }

    renderFighter(ctx, f) {
        ctx.save();
        ctx.translate(f.x, f.y - f.h);

        // Fighter Silhouette / Cyber Armor
        ctx.fillStyle = f.state === 'hurt' ? '#ffffff' : f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(0, 0, f.w, f.h, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Visor Optic
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(f.facing > 0 ? f.w - 14 : 4, 14, 10, 6);

        // Attack limb extensions
        if (f.state === 'punch') {
            ctx.fillStyle = f.color;
            ctx.fillRect(f.facing > 0 ? f.w : -24, 28, 24, 10);
        } else if (f.state === 'kick') {
            ctx.fillStyle = f.color;
            ctx.fillRect(f.facing > 0 ? f.w : -36, 58, 36, 12);
        } else if (f.state === 'block') {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(f.facing > 0 ? f.w + 4 : -4, f.h / 2, 8, 35, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderOverlays(ctx) {
        if (this.roundState === 'intro') {
            ctx.save();
            ctx.fillStyle = '#ffe600';
            ctx.shadowColor = '#ffe600';
            ctx.shadowBlur = 25;
            ctx.font = 'bold 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`ROUND ${this.currentRound}`, this.width / 2, this.height / 2 - 20);
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText("FIGHT!", this.width / 2, this.height / 2 + 40);
            ctx.restore();
        } else if (this.roundState === 'ko') {
            ctx.save();
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 30;
            ctx.font = 'bold 72px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("K.O.!", this.width / 2, this.height / 2);
            ctx.restore();
        } else if (this.roundState === 'match_over') {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.9)';
            ctx.fillRect(0, 0, this.width, this.height);

            const playerWon = this.p1Wins >= 2;
            ctx.fillStyle = playerWon ? '#39ff14' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 25;
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(playerWon ? "YOU WIN!" : "CPU WINS!", this.width / 2, this.height / 2 - 20);

            ctx.fillStyle = '#8b949e';
            ctx.font = '16px sans-serif';
            ctx.fillText("Press SPACE to Fight Again", this.width / 2, this.height / 2 + 40);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FighterEngine };
}
