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
        this.quadraticCurveTo(x, y, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x, y + tl);
        this.closePath();
        return this;
    };
}

class MatchEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.rows = 8;
        this.cols = 8;
        this.tileSize = 50;
        this.gridOffsetX = 340;
        this.gridOffsetY = 110;

        // Gem types: 0: Fire, 1: Mana, 2: Bio, 3: Shield, 4: Arcane, 5: Skull
        this.gemColors = ['#ff0055', '#00f0ff', '#39ff14', '#ffe600', '#a855f7', '#e2e8f0'];
        this.gemSymbols = ['🔥', '💧', '💚', '🛡️', '⚡', '💀'];

        this.grid = [];
        this.selectedTile = null; // { r, c }
        this.animating = false;
        this.floatingTexts = [];
        this.particles = [];

        // Player Stats
        this.playerMaxHp = 100;
        this.playerHp = 100;
        this.playerMaxMana = 100;
        this.playerMana = 30;
        this.playerShield = 10;
        this.score = 0;
        this.combo = 1;

        // Spells
        this.spells = [
            { name: "Flame Lance", cost: 25, type: 'damage', val: 35, icon: "🔥", desc: "35 Fire Damage" },
            { name: "Aegis Ward", cost: 20, type: 'shield', val: 25, icon: "🛡️", desc: "+25 Armor Shield" },
            { name: "Transmute", cost: 30, type: 'transmute', val: 5, icon: "✨", desc: "Turn 5 to Fire" },
            { name: "Chrono Lock", cost: 40, type: 'freeze', val: 6, icon: "⏳", desc: "+6s Boss Freeze" }
        ];

        // Bosses
        this.bossStages = [
            { name: "Void Construct", maxHp: 220, hp: 220, attack: 14, timer: 6.0, maxTimer: 6.0, color: "#a855f7" },
            { name: "Cyber Drake", maxHp: 450, hp: 450, attack: 22, timer: 5.0, maxTimer: 5.0, color: "#ff0055" },
            { name: "Omega Core", maxHp: 800, hp: 800, attack: 32, timer: 4.5, maxTimer: 4.5, color: "#00f0ff" }
        ];
        this.stageIndex = 0;
        this.currentBoss = { ...this.bossStages[0] };

        this.gameOver = false;
        this.victory = false;

        this.initGrid();
    }

    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                let type;
                do {
                    type = Math.floor(Math.random() * 6);
                } while (
                    (r >= 2 && this.grid[r - 1][c].type === type && this.grid[r - 2][c].type === type) ||
                    (c >= 2 && this.grid[r][c - 1].type === type && this.grid[r][c - 2].type === type)
                );
                this.grid[r][c] = { type, r, c, special: 0, scale: 1 };
            }
        }
    }

    selectTile(r, c) {
        if (this.animating || this.gameOver || this.victory) return;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;

        if (!this.selectedTile) {
            this.selectedTile = { r, c };
            if (this.audio) this.audio.swap();
        } else {
            const dr = Math.abs(this.selectedTile.r - r);
            const dc = Math.abs(this.selectedTile.c - c);

            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                // Adjacent: attempt swap
                this.trySwap(this.selectedTile.r, this.selectedTile.c, r, c);
                this.selectedTile = null;
            } else {
                // Select new tile
                this.selectedTile = { r, c };
                if (this.audio) this.audio.swap();
            }
        }
    }

    trySwap(r1, c1, r2, c2) {
        // Swap in grid
        const temp = this.grid[r1][c1].type;
        this.grid[r1][c1].type = this.grid[r2][c2].type;
        this.grid[r2][c2].type = temp;

        const matches = this.findMatches();
        if (matches.length > 0) {
            // Valid move
            if (this.audio) this.audio.swap();
            this.combo = 1;
            this.resolveCascade();
        } else {
            // Swap back
            this.grid[r2][c2].type = this.grid[r1][c1].type;
            this.grid[r1][c1].type = temp;
        }
    }

    findMatches() {
        const matched = new Set();

        // Horizontal matches
        for (let r = 0; r < this.rows; r++) {
            let matchLen = 1;
            for (let c = 1; c <= this.cols; c++) {
                if (c < this.cols && this.grid[r][c].type === this.grid[r][c - 1].type) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let k = 1; k <= matchLen; k++) {
                            matched.add(`${r},${c - k}`);
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        // Vertical matches
        for (let c = 0; c < this.cols; c++) {
            let matchLen = 1;
            for (let r = 1; r <= this.rows; r++) {
                if (r < this.rows && this.grid[r][c].type === this.grid[r - 1][c].type) {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let k = 1; k <= matchLen; k++) {
                            matched.add(`${r - k},${c}`);
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        return Array.from(matched).map(str => {
            const [r, c] = str.split(',').map(Number);
            return { r, c, type: this.grid[r][c].type };
        });
    }

    resolveCascade() {
        const matches = this.findMatches();
        if (matches.length === 0) {
            this.combo = 1;
            this.animating = false;
            return;
        }

        this.animating = true;
        if (this.audio) this.audio.match(this.combo);

        // Process gem types & apply RPG effects
        let damage = 0;
        let manaGain = 0;
        let heal = 0;
        let shieldGain = 0;

        matches.forEach(m => {
            if (m.type === 0) damage += 8;
            else if (m.type === 1) manaGain += 6;
            else if (m.type === 2) heal += 5;
            else if (m.type === 3) shieldGain += 5;
            else if (m.type === 4) damage += 14;
            else if (m.type === 5) damage += 4; // Skull deals bonus rupture

            // Spawn particles
            this.spawnGemParticles(m.r, m.c, this.gemColors[m.type]);
            // Empty gem
            this.grid[m.r][m.c].type = -1;
        });

        damage *= this.combo;
        this.score += matches.length * 50 * this.combo;

        if (damage > 0) this.damageBoss(damage);
        if (manaGain > 0) {
            this.playerMana = Math.min(this.playerMaxMana, this.playerMana + manaGain);
            this.addFloatingText(`+${manaGain} MP`, 140, 480, '#00f0ff');
        }
        if (heal > 0) {
            this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
            if (this.audio) this.audio.heal();
            this.addFloatingText(`+${heal} HP`, 140, 440, '#39ff14');
        }
        if (shieldGain > 0) {
            this.playerShield = Math.min(50, this.playerShield + shieldGain);
            if (this.audio) this.audio.shield();
            this.addFloatingText(`+${shieldGain} SHIELD`, 140, 460, '#ffe600');
        }

        // Drop gems down & refill
        this.applyGravity();

        // Increment combo for chained cascades
        this.combo++;

        setTimeout(() => {
            this.resolveCascade();
        }, 160);
    }

    applyGravity() {
        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c].type !== -1) {
                    if (writeRow !== r) {
                        this.grid[writeRow][c].type = this.grid[r][c].type;
                        this.grid[r][c].type = -1;
                    }
                    writeRow--;
                }
            }
            // Fill new gems at top
            while (writeRow >= 0) {
                this.grid[writeRow][c].type = Math.floor(Math.random() * 6);
                writeRow--;
            }
        }
    }

    damageBoss(amount) {
        this.currentBoss.hp = Math.max(0, this.currentBoss.hp - amount);
        this.addFloatingText(`-${amount}`, 200, 160, '#ff0055');
        if (this.audio) this.audio.bossHurt();

        if (this.currentBoss.hp <= 0) {
            this.advanceBossStage();
        }
    }

    advanceBossStage() {
        this.stageIndex++;
        if (this.stageIndex < this.bossStages.length) {
            this.currentBoss = { ...this.bossStages[this.stageIndex] };
            this.addFloatingText("BOSS DEFEATED! NEW ENEMY INCOMING!", this.width / 2, 80, '#ffe600');
            if (this.audio) this.audio.victory();
        } else {
            this.victory = true;
            if (this.audio) this.audio.victory();
        }
    }

    takeDamage(amount) {
        let remaining = amount;
        if (this.playerShield > 0) {
            const absorb = Math.min(this.playerShield, remaining);
            this.playerShield -= absorb;
            remaining -= absorb;
        }
        if (remaining > 0) {
            this.playerHp = Math.max(0, this.playerHp - remaining);
            this.addFloatingText(`-${remaining} HP`, 120, 440, '#ff0055');
        }
        if (this.audio) this.audio.bossAttack();

        if (this.playerHp <= 0) {
            this.gameOver = true;
            if (this.audio) this.audio.defeat();
        }
    }

    castSpell(index) {
        if (this.gameOver || this.victory) return;
        const spell = this.spells[index];
        if (!spell || this.playerMana < spell.cost) return;

        this.playerMana -= spell.cost;
        if (this.audio) this.audio.fireSpell();

        if (spell.type === 'damage') {
            this.damageBoss(spell.val);
        } else if (spell.type === 'shield') {
            this.playerShield = Math.min(60, this.playerShield + spell.val);
            this.addFloatingText(`+${spell.val} SHIELD`, 140, 460, '#ffe600');
        } else if (spell.type === 'transmute') {
            // Turn random 5 tiles into Fire (0)
            let count = 0;
            for (let i = 0; i < 20 && count < spell.val; i++) {
                const r = Math.floor(Math.random() * this.rows);
                const c = Math.floor(Math.random() * this.cols);
                if (this.grid[r][c].type !== 0) {
                    this.grid[r][c].type = 0;
                    this.spawnGemParticles(r, c, '#ff0055');
                    count++;
                }
            }
            this.resolveCascade();
        } else if (spell.type === 'freeze') {
            this.currentBoss.timer += spell.val;
            this.addFloatingText(`+${spell.val}s FROZEN`, 200, 140, '#00f0ff');
        }
    }

    update(dt) {
        if (this.gameOver || this.victory) return;

        // Boss Attack Timer
        this.currentBoss.timer -= dt;
        if (this.currentBoss.timer <= 0) {
            this.currentBoss.timer = this.currentBoss.maxTimer;
            this.takeDamage(this.currentBoss.attack);
        }

        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 25 * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    spawnGemParticles(r, c, color) {
        const gx = this.gridOffsetX + c * this.tileSize + this.tileSize / 2;
        const gy = this.gridOffsetY + r * this.tileSize + this.tileSize / 2;
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x: gx,
                y: gy,
                vx: (Math.random() - 0.5) * 120,
                vy: (Math.random() - 0.5) * 120,
                color: color,
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

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Left Panel: Boss Card & Player Card & Spells
        this.renderLeftPanel(ctx);

        // Right Panel: 8x8 Grid
        this.renderGrid(ctx);

        // Visual effects (particles, floating text)
        this.renderEffects(ctx);

        // Overlays
        this.renderOverlays(ctx);
    }

    renderLeftPanel(ctx) {
        // 1. Boss Area
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(20, 20, 290, 190, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText(`STAGE ${this.stageIndex + 1} OF ${this.bossStages.length}`, 36, 42);

        ctx.fillStyle = this.currentBoss.color;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(this.currentBoss.name, 36, 68);

        // Boss HP Bar
        const bossHpPct = Math.max(0, this.currentBoss.hp / this.currentBoss.maxHp);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(36, 82, 258, 14);
        ctx.fillStyle = this.currentBoss.color;
        ctx.fillRect(36, 82, 258 * bossHpPct, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${this.currentBoss.hp} / ${this.currentBoss.maxHp} HP`, 130, 93);

        // Boss Attack Gauge
        const timerPct = Math.max(0, this.currentBoss.timer / this.currentBoss.maxTimer);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(36, 114, 258, 8);
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(36, 114, 258 * timerPct, 8);

        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText(`ATTACK IN ${this.currentBoss.timer.toFixed(1)}s (DMG: ${this.currentBoss.attack})`, 36, 140);

        // 2. Player Status Area
        ctx.fillStyle = '#0d1117';
        ctx.beginPath();
        ctx.roundRect(20, 225, 290, 140, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText("HERO ALCHEMIST", 36, 250);

        // Player HP
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(36, 262, 258, 12);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(36, 262, 258 * (this.playerHp / this.playerMaxHp), 12);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(`HP: ${this.playerHp} / ${this.playerMaxHp}`, 40, 272);

        // Player Mana
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(36, 282, 258, 12);
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(36, 282, 258 * (this.playerMana / this.playerMaxMana), 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`MANA: ${this.playerMana} / ${this.playerMaxMana}`, 40, 292);

        // Player Shield
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(36, 302, 258, 12);
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(36, 302, 258 * (this.playerShield / 50), 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`SHIELD: ${this.playerShield} / 50`, 40, 312);

        ctx.fillStyle = '#8b949e';
        ctx.font = '12px monospace';
        ctx.fillText(`SCORE: ${this.score}`, 36, 345);

        // 3. Spells Action Bar
        ctx.fillStyle = '#8b949e';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText("SPELL MATRIX (Click or [1-4]):", 20, 395);

        this.spells.forEach((sp, i) => {
            const bx = 20 + (i % 2) * 150;
            const by = 410 + Math.floor(i / 2) * 80;
            const canCast = this.playerMana >= sp.cost;

            ctx.fillStyle = canCast ? '#161b22' : '#0a0d12';
            ctx.strokeStyle = canCast ? '#00f0ff' : '#21262d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, by, 140, 70, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = canCast ? '#ffffff' : '#484f58';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`${i + 1}. ${sp.icon} ${sp.name}`, bx + 8, by + 24);

            ctx.fillStyle = canCast ? '#00f0ff' : '#30363d';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`${sp.cost} MP`, bx + 8, by + 44);

            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            ctx.fillText(sp.desc, bx + 8, by + 60);
        });
    }

    renderGrid(ctx) {
        // Grid background board
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.gridOffsetX - 10, this.gridOffsetY - 10, this.cols * this.tileSize + 20, this.rows * this.tileSize + 20, 10);
        ctx.fill();
        ctx.stroke();

        // Draw Tiles
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.grid[r][c];
                const x = this.gridOffsetX + c * this.tileSize;
                const y = this.gridOffsetY + r * this.tileSize;

                const isSelected = this.selectedTile && this.selectedTile.r === r && this.selectedTile.c === c;

                ctx.save();
                ctx.fillStyle = isSelected ? '#30363d' : '#161b22';
                ctx.strokeStyle = isSelected ? '#00f0ff' : '#21262d';
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4, 8);
                ctx.fill();
                ctx.stroke();

                if (tile.type >= 0) {
                    ctx.font = '22px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.gemSymbols[tile.type], x + this.tileSize / 2, y + this.tileSize / 2);
                }
                ctx.restore();
            }
        }
    }

    renderEffects(ctx) {
        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Floating texts
        ctx.shadowBlur = 0;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
    }

    renderOverlays(ctx) {
        if (this.gameOver || this.victory) {
            ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = this.victory ? '#39ff14' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 20;
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.victory ? "VICTORY! DUNGEON CLEARED" : "HERO DEFEATED", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText("Click or press SPACE to Play Again", this.width / 2, this.height / 2 + 55);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MatchEngine };
}
