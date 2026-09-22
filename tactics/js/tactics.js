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

class TacticsEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.gridSize = 8;
        this.cellSize = 56;
        this.gridOffsetX = 40;
        this.gridOffsetY = 80;

        // Terrain: 0 = Plain, 1 = Cover, 2 = Mine, 3 = Power Pylon
        this.terrain = [];
        this.pylonHp = 60;
        this.maxPylonHp = 60;

        // Units
        this.playerUnits = [];
        this.enemyUnits = [];
        this.selectedUnit = null;
        this.turn = 'player'; // 'player' | 'enemy'
        this.turnNumber = 1;

        // Movement & Attack highlight sets
        this.validMoves = [];
        this.validAttacks = [];

        // Particles & Floating texts
        this.floatingTexts = [];
        this.particles = [];

        this.gameOver = false;
        this.victory = false;

        this.initMission();
    }

    initMission() {
        // Init terrain
        this.terrain = [];
        for (let r = 0; r < this.gridSize; r++) {
            this.terrain[r] = [];
            for (let c = 0; c < this.gridSize; c++) {
                this.terrain[r][c] = 0;
            }
        }

        // Cover barriers
        this.terrain[2][2] = 1;
        this.terrain[2][5] = 1;
        this.terrain[5][2] = 1;
        this.terrain[5][5] = 1;

        // EMP Mines
        this.terrain[3][3] = 2;
        this.terrain[4][4] = 2;

        // Power Pylon at (3, 0)
        this.terrain[3][0] = 3;
        this.pylonHp = 60;

        // Player Mechs
        this.playerUnits = [
            { id: 'titan', name: 'Assault Titan', r: 1, c: 1, hp: 45, maxHp: 45, move: 3, atk: 22, minRange: 1, maxRange: 1, hasMoved: false, hasAttacked: false, icon: '🛡️', color: '#00f0ff' },
            { id: 'vanguard', name: 'Artillery', r: 3, c: 1, hp: 30, maxHp: 30, move: 2, atk: 18, minRange: 2, maxRange: 4, hasMoved: false, hasAttacked: false, icon: '🚀', color: '#38bdf8' },
            { id: 'strider', name: 'Scout Strider', r: 5, c: 1, hp: 25, maxHp: 25, move: 4, atk: 16, minRange: 1, maxRange: 2, hasMoved: false, hasAttacked: false, icon: '⚡', color: '#a855f7' }
        ];

        // Enemy Swarm
        this.enemyUnits = [
            { id: 'e1', name: 'Stalker Alpha', r: 1, c: 6, hp: 24, maxHp: 24, move: 3, atk: 12, minRange: 1, maxRange: 1, icon: '👾', color: '#ff0055' },
            { id: 'e2', name: 'Cyber Gunner', r: 3, c: 6, hp: 20, maxHp: 20, move: 2, atk: 14, minRange: 2, maxRange: 3, icon: '🤖', color: '#ff007f' },
            { id: 'e3', name: 'Stalker Beta', r: 5, c: 6, hp: 24, maxHp: 24, move: 3, atk: 12, minRange: 1, maxRange: 1, icon: '👾', color: '#ff0055' },
            { id: 'e4', name: 'Dread Colossus', r: 4, c: 7, hp: 40, maxHp: 40, move: 1, atk: 20, minRange: 1, maxRange: 1, icon: '👹', color: '#f43f5e' }
        ];

        this.selectedUnit = null;
        this.validMoves = [];
        this.validAttacks = [];
        this.turn = 'player';
        this.turnNumber = 1;
        this.gameOver = false;
        this.victory = false;
    }

    selectCell(r, c) {
        if (this.turn !== 'player' || this.gameOver || this.victory) return;
        if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) return;

        // Check if clicking on an enemy inside valid attacks
        const targetEnemy = this.enemyUnits.find(e => e.r === r && e.c === c);
        if (this.selectedUnit && targetEnemy && this.validAttacks.some(a => a.r === r && a.c === c)) {
            this.executePlayerAttack(this.selectedUnit, targetEnemy);
            return;
        }

        // Check if clicking on a valid move cell
        if (this.selectedUnit && !this.selectedUnit.hasMoved && this.validMoves.some(m => m.r === r && m.c === c)) {
            this.executePlayerMove(this.selectedUnit, r, c);
            return;
        }

        // Check if clicking on one of own player units
        const clickedUnit = this.playerUnits.find(u => u.r === r && u.c === c);
        if (clickedUnit) {
            this.selectedUnit = clickedUnit;
            if (this.audio) this.audio.select();
            this.calculateHighlights(clickedUnit);
        } else {
            this.selectedUnit = null;
            this.validMoves = [];
            this.validAttacks = [];
        }
    }

    calculateHighlights(unit) {
        this.validMoves = [];
        this.validAttacks = [];

        // Calculate moves if hasn't moved
        if (!unit.hasMoved) {
            for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    const dist = Math.abs(r - unit.r) + Math.abs(c - unit.c);
                    if (dist > 0 && dist <= unit.move) {
                        // Must not be occupied by unit or cover barrier
                        const occupied = this.isCellOccupied(r, c);
                        if (!occupied && this.terrain[r][c] !== 1 && this.terrain[r][c] !== 3) {
                            this.validMoves.push({ r, c });
                        }
                    }
                }
            }
        }

        // Calculate attacks if hasn't attacked
        if (!unit.hasAttacked) {
            for (const en of this.enemyUnits) {
                const dist = Math.abs(en.r - unit.r) + Math.abs(en.c - unit.c);
                if (dist >= unit.minRange && dist <= unit.maxRange) {
                    this.validAttacks.push({ r: en.r, c: en.c });
                }
            }
        }
    }

    isCellOccupied(r, c) {
        return this.playerUnits.some(u => u.r === r && u.c === c) ||
               this.enemyUnits.some(e => e.r === r && e.c === c);
    }

    executePlayerMove(unit, targetR, targetC) {
        unit.r = targetR;
        unit.c = targetC;
        unit.hasMoved = true;
        if (this.audio) this.audio.move();

        // Check if stepped on EMP mine
        if (this.terrain[targetR][targetC] === 2) {
            unit.hp = Math.max(0, unit.hp - 15);
            this.terrain[targetR][targetC] = 0;
            this.addFloatingText("-15 MINE", targetR, targetC, '#ffe600');
            this.spawnCellParticles(targetR, targetC, '#ffe600', 12);
        }

        this.validMoves = [];
        this.calculateHighlights(unit);

        // Check if unit died from mine
        if (unit.hp <= 0) {
            this.playerUnits = this.playerUnits.filter(u => u !== unit);
            this.selectedUnit = null;
            this.checkGameOver();
        }
    }

    executePlayerAttack(unit, enemy) {
        unit.hasAttacked = true;
        if (unit.minRange === 1 && unit.maxRange === 1) {
            if (this.audio) this.audio.meleeAttack();
        } else {
            if (this.audio) this.audio.cannonFire();
        }

        // Check cover reduction (40% less damage if enemy is adjacent to cover block)
        const hasCover = this.isAdjacentToCover(enemy.r, enemy.c);
        let dmg = hasCover ? Math.round(unit.atk * 0.6) : unit.atk;

        enemy.hp = Math.max(0, enemy.hp - dmg);
        this.addFloatingText(`-${dmg}`, enemy.r, enemy.c, '#ff0055');
        this.spawnCellParticles(enemy.r, enemy.c, '#ff0055', 10);

        if (enemy.hp <= 0) {
            this.enemyUnits = this.enemyUnits.filter(e => e !== enemy);
            if (this.audio) this.audio.destroyed();
            this.spawnCellParticles(enemy.r, enemy.c, '#ff007f', 18);
        }

        this.validAttacks = [];
        this.selectedUnit = null;
        this.checkVictory();
    }

    isAdjacentToCover(r, c) {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        return dirs.some(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            return nr >= 0 && nr < this.gridSize && nc >= 0 && nc < this.gridSize && this.terrain[nr][nc] === 1;
        });
    }

    endPlayerTurn() {
        if (this.turn !== 'player' || this.gameOver || this.victory) return;
        this.turn = 'enemy';
        this.selectedUnit = null;
        this.validMoves = [];
        this.validAttacks = [];

        if (this.audio) this.audio.enemyTurn();

        // Run enemy AI actions sequentially with slight delay
        setTimeout(() => this.runEnemyTurn(), 500);
    }

    runEnemyTurn() {
        this.enemyUnits.forEach(en => {
            if (this.playerUnits.length === 0 || this.pylonHp <= 0) return;

            // Find closest target (either player mech or Power Pylon at 3, 0)
            let bestTarget = { r: 3, c: 0, isPylon: true };
            let minDist = Math.abs(en.r - 3) + Math.abs(en.c - 0);

            this.playerUnits.forEach(p => {
                const dist = Math.abs(en.r - p.r) + Math.abs(en.c - p.c);
                if (dist < minDist) {
                    minDist = dist;
                    bestTarget = p;
                }
            });

            // If already in attack range, strike!
            const curDist = Math.abs(en.r - bestTarget.r) + Math.abs(en.c - bestTarget.c);
            if (curDist >= en.minRange && curDist <= en.maxRange) {
                this.executeEnemyAttack(en, bestTarget);
            } else {
                // Move towards target
                const dr = Math.sign(bestTarget.r - en.r);
                const dc = Math.sign(bestTarget.c - en.c);

                let nextR = en.r;
                let nextC = en.c;

                if (Math.abs(bestTarget.c - en.c) > Math.abs(bestTarget.r - en.r)) {
                    if (!this.isCellOccupied(en.r, en.c + dc) && this.terrain[en.r][en.c + dc] !== 1 && this.terrain[en.r][en.c + dc] !== 3) {
                        nextC = en.c + dc;
                    } else if (!this.isCellOccupied(en.r + dr, en.c) && this.terrain[en.r + dr][en.c] !== 1 && this.terrain[en.r + dr][en.c] !== 3) {
                        nextR = en.r + dr;
                    }
                } else {
                    if (!this.isCellOccupied(en.r + dr, en.c) && this.terrain[en.r + dr][en.c] !== 1 && this.terrain[en.r + dr][en.c] !== 3) {
                        nextR = en.r + dr;
                    } else if (!this.isCellOccupied(en.r, en.c + dc) && this.terrain[en.r][en.c + dc] !== 1 && this.terrain[en.r][en.c + dc] !== 3) {
                        nextC = en.c + dc;
                    }
                }

                en.r = nextR;
                en.c = nextC;

                // Attack after move if in range
                const newDist = Math.abs(en.r - bestTarget.r) + Math.abs(en.c - bestTarget.c);
                if (newDist >= en.minRange && newDist <= en.maxRange) {
                    this.executeEnemyAttack(en, bestTarget);
                }
            }
        });

        // End enemy turn
        this.checkGameOver();
        if (!this.gameOver) {
            this.turn = 'player';
            this.turnNumber++;
            this.playerUnits.forEach(u => {
                u.hasMoved = false;
                u.hasAttacked = false;
            });
        }
    }

    executeEnemyAttack(enemy, target) {
        if (target.isPylon) {
            this.pylonHp = Math.max(0, this.pylonHp - enemy.atk);
            this.addFloatingText(`-${enemy.atk}`, 3, 0, '#ff0055');
            this.spawnCellParticles(3, 0, '#ffe600', 8);
            if (this.audio) this.audio.hit();
        } else {
            const hasCover = this.isAdjacentToCover(target.r, target.c);
            let dmg = hasCover ? Math.round(enemy.atk * 0.6) : enemy.atk;
            target.hp = Math.max(0, target.hp - dmg);
            this.addFloatingText(`-${dmg}`, target.r, target.c, '#ff0055');
            this.spawnCellParticles(target.r, target.c, '#ff0055', 8);
            if (this.audio) this.audio.hit();

            if (target.hp <= 0) {
                this.playerUnits = this.playerUnits.filter(u => u !== target);
                if (this.audio) this.audio.destroyed();
            }
        }
    }

    checkVictory() {
        if (this.enemyUnits.length === 0) {
            this.victory = true;
            if (this.audio) this.audio.victory();
        }
    }

    checkGameOver() {
        if (this.playerUnits.length === 0 || this.pylonHp <= 0) {
            this.gameOver = true;
            if (this.audio) this.audio.defeat();
        }
    }

    addFloatingText(text, r, c, color = '#ffffff') {
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        this.floatingTexts.push({ text, x, y, color, life: 1.0, maxLife: 1.0 });
    }

    spawnCellParticles(r, c, color, count = 8) {
        const cx = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const cy = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: cx,
                y: cy,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                color,
                life: 0.35,
                maxLife: 0.35
            });
        }
    }

    update(dt) {
        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 25 * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
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

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Render 8x8 Grid & Terrain
        this.renderGrid(ctx);

        // Render Units
        this.renderUnits(ctx);

        // Render Right Side Panel & HUD
        this.renderSidePanel(ctx);

        // Render Effects
        this.renderEffects(ctx);

        // Overlays
        this.renderOverlays(ctx);
    }

    renderGrid(ctx) {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const x = this.gridOffsetX + c * this.cellSize;
                const y = this.gridOffsetY + r * this.cellSize;

                // Base Tile
                ctx.fillStyle = (r + c) % 2 === 0 ? '#0c111a' : '#101622';
                ctx.fillRect(x, y, this.cellSize, this.cellSize);

                // Grid Border
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, this.cellSize, this.cellSize);

                // Valid Move Highlight
                if (this.validMoves.some(m => m.r === r && m.c === c)) {
                    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
                    ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
                }

                // Valid Attack Highlight
                if (this.validAttacks.some(a => a.r === r && a.c === c)) {
                    ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
                    ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
                }

                // Terrain Rendering
                const t = this.terrain[r][c];
                if (t === 1) {
                    // Cover Barrier
                    ctx.fillStyle = '#334155';
                    ctx.strokeStyle = '#00f0ff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(x + 8, y + 8, this.cellSize - 16, this.cellSize - 16, 6);
                    ctx.fill();
                    ctx.stroke();
                } else if (t === 2) {
                    // EMP Mine
                    ctx.fillStyle = '#ffe600';
                    ctx.shadowColor = '#ffe600';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(x + this.cellSize / 2, y + this.cellSize / 2, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else if (t === 3) {
                    // Power Pylon
                    ctx.fillStyle = '#3b82f6';
                    ctx.shadowColor = '#3b82f6';
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.roundRect(x + 6, y + 6, this.cellSize - 12, this.cellSize - 12, 6);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '22px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚡', x + this.cellSize / 2, y + this.cellSize / 2);
                }
            }
        }
    }

    renderUnits(ctx) {
        // Player Units
        this.playerUnits.forEach(u => {
            const x = this.gridOffsetX + u.c * this.cellSize;
            const y = this.gridOffsetY + u.r * this.cellSize;
            const isSel = this.selectedUnit === u;

            ctx.save();
            ctx.fillStyle = isSel ? '#00f0ff' : '#1e293b';
            ctx.strokeStyle = isSel ? '#ffffff' : '#00f0ff';
            ctx.lineWidth = isSel ? 3 : 1.5;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8, 8);
            ctx.fill();
            ctx.stroke();

            // Icon
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(u.icon, x + this.cellSize / 2, y + this.cellSize / 2 - 2);

            // HP bar
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 6, y + this.cellSize - 8, this.cellSize - 12, 4);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(x + 6, y + this.cellSize - 8, (this.cellSize - 12) * (u.hp / u.maxHp), 4);
            ctx.restore();
        });

        // Enemy Units
        this.enemyUnits.forEach(e => {
            const x = this.gridOffsetX + e.c * this.cellSize;
            const y = this.gridOffsetY + e.r * this.cellSize;

            ctx.save();
            ctx.fillStyle = '#4c0519';
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8, 8);
            ctx.fill();
            ctx.stroke();

            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(e.icon, x + this.cellSize / 2, y + this.cellSize / 2 - 2);

            // HP bar
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 6, y + this.cellSize - 8, this.cellSize - 12, 4);
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(x + 6, y + this.cellSize - 8, (this.cellSize - 12) * (e.hp / e.maxHp), 4);
            ctx.restore();
        });
    }

    renderSidePanel(ctx) {
        ctx.save();
        const px = 510;
        const py = 80;
        const pw = 250;

        // Turn & Pylon Status Box
        ctx.fillStyle = '#0d1117';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, 130, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.turn === 'player' ? '#00f0ff' : '#ff0055';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(this.turn === 'player' ? "COMMANDER'S TURN" : "ENEMY HOSTILES TURN", px + 16, py + 30);

        ctx.fillStyle = '#8b949e';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Round: ${this.turnNumber}  |  Hostiles Left: ${this.enemyUnits.length}`, px + 16, py + 55);

        // Power Pylon Integrity
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`⚡ POWER PYLON: ${this.pylonHp} / ${this.maxPylonHp} HP`, px + 16, py + 85);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px + 16, py + 95, pw - 32, 10);
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(px + 16, py + 95, (pw - 32) * (this.pylonHp / this.maxPylonHp), 10);

        // Selected Unit Info Card
        ctx.fillStyle = '#0d1117';
        ctx.beginPath();
        ctx.roundRect(px, py + 145, pw, 175, 8);
        ctx.fill();
        ctx.stroke();

        if (this.selectedUnit) {
            const u = this.selectedUnit;
            ctx.fillStyle = u.color;
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`${u.icon} ${u.name}`, px + 16, py + 175);

            ctx.fillStyle = '#ffffff';
            ctx.font = '13px monospace';
            ctx.fillText(`HP: ${u.hp} / ${u.maxHp}`, px + 16, py + 205);
            ctx.fillText(`ATK: ${u.atk} DMG`, px + 16, py + 225);
            ctx.fillText(`MOVE: ${u.move} tiles`, px + 16, py + 245);
            ctx.fillText(`RANGE: ${u.minRange}-${u.maxRange} tiles`, px + 16, py + 265);

            ctx.fillStyle = u.hasMoved ? '#8b949e' : '#39ff14';
            ctx.fillText(u.hasMoved ? '• Moved' : '• Ready to Move', px + 16, py + 295);
            ctx.fillStyle = u.hasAttacked ? '#8b949e' : '#ff0055';
            ctx.fillText(u.hasAttacked ? '• Attacked' : '• Ready to Strike', px + 130, py + 295);
        } else {
            ctx.fillStyle = '#8b949e';
            ctx.font = '13px sans-serif';
            ctx.fillText("Select a Mech on grid to command", px + 16, py + 220);
        }

        // End Turn Button
        const canEndTurn = this.turn === 'player';
        ctx.fillStyle = canEndTurn ? '#161b22' : '#080b0f';
        ctx.strokeStyle = canEndTurn ? '#00f0ff' : '#21262d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(px, py + 340, pw, 52, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = canEndTurn ? '#00f0ff' : '#484f58';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("END TURN [SPACE]", px + pw / 2, py + 372);

        ctx.restore();
    }

    renderEffects(ctx) {
        // Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Floating texts
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
    }

    renderOverlays(ctx) {
        if (this.gameOver || this.victory) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.9)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = this.victory ? '#39ff14' : '#ff0055';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 25;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.victory ? "SECTOR CLEARED! VICTORY" : "BASE DESTROYED: DEFEAT", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Rounds Taken: ${this.turnNumber}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Click or press SPACE to Deploy Again', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TacticsEngine };
}
