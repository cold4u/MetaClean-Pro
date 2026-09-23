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

// 19 x 21 Classic Layout (1=Wall, 0=Pellet, 2=Energizer, 3=Empty/No Pellet, 4=Gate, 5=Tunnel)
const MAZE_MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,3,1,3,1,1,1,0,1,1,1,1],
    [3,3,3,1,0,1,3,3,3,3,3,3,3,1,0,1,3,3,3],
    [1,1,1,1,0,1,3,1,1,4,1,1,3,1,0,1,1,1,1],
    [5,3,3,3,0,3,3,1,3,3,3,1,3,3,0,3,3,3,5],
    [1,1,1,1,0,1,3,1,1,1,1,1,3,1,0,1,1,1,1],
    [3,3,3,1,0,1,3,3,3,3,3,3,3,1,0,1,3,3,3],
    [1,1,1,1,0,1,3,1,1,1,1,1,3,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,2,0,1,0,0,0,0,0,3,0,0,0,0,0,1,0,2,1],
    [1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

class PacmanEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.cols = 19;
        this.rows = 21;
        this.tileSize = 26;
        this.offsetX = Math.floor((this.width - this.cols * this.tileSize) / 2);
        this.offsetY = Math.floor((this.height - this.rows * this.tileSize) / 2) + 12;

        this.score = 0;
        this.lives = 3;
        this.gameState = 'playing'; // 'playing', 'life_lost', 'game_over', 'victory'
        this.frightenedTimer = 0;
        this.frightenedDuration = 7.0;
        this.ghostsEatenInPhase = 0;

        this.particles = [];
        this.floatingTexts = [];

        this.initMaze();
        this.initPlayer();
        this.initGhosts();
    }

    initMaze() {
        this.grid = [];
        this.pelletsRemaining = 0;
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const val = MAZE_MAP[r][c];
                this.grid[r][c] = val;
                if (val === 0 || val === 2) {
                    this.pelletsRemaining++;
                }
            }
        }
    }

    initPlayer() {
        this.player = {
            col: 9,
            row: 16,
            x: this.offsetX + 9 * this.tileSize + this.tileSize / 2,
            y: this.offsetY + 16 * this.tileSize + this.tileSize / 2,
            radius: 11,
            speed: 120,
            dir: { dx: 0, dy: 0 },
            nextDir: { dx: 0, dy: 0 },
            mouthAngle: 0.2,
            mouthSpeed: 6
        };
    }

    initGhosts() {
        this.ghosts = [
            this.createGhost('blinky', 9, 7, '#ff0055', 'aggressive'),
            this.createGhost('pinky', 9, 9, '#ff77aa', 'ambush'),
            this.createGhost('inky', 8, 9, '#00f0ff', 'flanker'),
            this.createGhost('clyde', 10, 9, '#ffaa00', 'wanderer')
        ];
    }

    createGhost(id, col, row, color, personality) {
        return {
            id,
            col,
            row,
            x: this.offsetX + col * this.tileSize + this.tileSize / 2,
            y: this.offsetY + row * this.tileSize + this.tileSize / 2,
            radius: 11,
            speed: 105,
            color,
            personality,
            dir: { dx: 0, dy: -1 },
            state: 'chase', // 'chase', 'frightened', 'eaten'
            homeCol: col,
            homeRow: row
        };
    }

    setNextDirection(dx, dy) {
        this.player.nextDir = { dx, dy };
        // If player is stopped or reversing direction, apply immediately
        if (this.player.dir.dx === 0 && this.player.dir.dy === 0) {
            this.player.dir = { dx, dy };
        } else if (this.player.dir.dx === -dx && this.player.dir.dy === -dy) {
            this.player.dir = { dx, dy };
        }
    }

    update(dt) {
        if (this.gameState !== 'playing') return;

        this.updatePlayer(dt);
        this.updateGhosts(dt);
        this.checkGhostCollisions();
        this.updateEffects(dt);
    }

    updatePlayer(dt) {
        const p = this.player;

        // Try applying queued direction when near tile center
        const center = this.getTileCenter(p.col, p.row);
        const distToCenter = Math.hypot(p.x - center.x, p.y - center.y);

        if (distToCenter < 4 && (p.nextDir.dx !== 0 || p.nextDir.dy !== 0)) {
            const nextCol = p.col + p.nextDir.dx;
            const nextRow = p.row + p.nextDir.dy;
            if (this.isWalkable(nextCol, nextRow, false)) {
                p.x = center.x;
                p.y = center.y;
                p.dir = { ...p.nextDir };
            }
        }

        // Move in current direction
        if (p.dir.dx !== 0 || p.dir.dy !== 0) {
            const targetCol = p.col + p.dir.dx;
            const targetRow = p.row + p.dir.dy;

            // Tunnel Wrapping
            if (p.row === 10) {
                if (p.x < this.offsetX) {
                    p.x = this.offsetX + (this.cols - 1) * this.tileSize;
                } else if (p.x > this.offsetX + this.cols * this.tileSize) {
                    p.x = this.offsetX;
                }
            }

            if (this.isWalkable(targetCol, targetRow, false) || (p.row === 10 && (targetCol < 0 || targetCol >= this.cols))) {
                p.x += p.dir.dx * p.speed * dt;
                p.y += p.dir.dy * p.speed * dt;
            } else {
                // Snap to current tile center
                if (distToCenter > 2) {
                    p.x += Math.sign(center.x - p.x) * Math.min(Math.abs(center.x - p.x), p.speed * dt);
                    p.y += Math.sign(center.y - p.y) * Math.min(Math.abs(center.y - p.y), p.speed * dt);
                } else {
                    p.x = center.x;
                    p.y = center.y;
                    p.dir = { dx: 0, dy: 0 };
                }
            }

            p.col = Math.floor((p.x - this.offsetX) / this.tileSize);
            p.row = Math.floor((p.y - this.offsetY) / this.tileSize);
        }

        // Chomp animation
        p.mouthAngle = 0.05 + Math.abs(Math.sin(performance.now() * 0.015 * p.mouthSpeed)) * 0.35;

        // Eat Pellets
        if (p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols) {
            const tile = this.grid[p.row][p.col];
            if (tile === 0) {
                this.grid[p.row][p.col] = 3;
                this.score += 10;
                this.pelletsRemaining--;
                if (this.audio) this.audio.waka();
                this.checkWinCondition();
            } else if (tile === 2) {
                this.grid[p.row][p.col] = 3;
                this.score += 50;
                this.pelletsRemaining--;
                this.triggerEnergizer();
                if (this.audio) this.audio.energizer();
                this.checkWinCondition();
            }
        }
    }

    triggerEnergizer() {
        this.frightenedTimer = this.frightenedDuration;
        this.ghostsEatenInPhase = 0;
        for (const g of this.ghosts) {
            if (g.state !== 'eaten') {
                g.state = 'frightened';
                // Reverse direction
                g.dir.dx = -g.dir.dx;
                g.dir.dy = -g.dir.dy;
            }
        }
    }

    updateGhosts(dt) {
        if (this.frightenedTimer > 0) {
            this.frightenedTimer -= dt;
            if (this.frightenedTimer <= 0) {
                for (const g of this.ghosts) {
                    if (g.state === 'frightened') g.state = 'chase';
                }
            }
        }

        for (const g of this.ghosts) {
            let speed = g.speed;
            if (g.state === 'frightened') speed = g.speed * 0.6;
            else if (g.state === 'eaten') speed = g.speed * 1.8;

            const center = this.getTileCenter(g.col, g.row);
            const dist = Math.hypot(g.x - center.x, g.y - center.y);

            // Tunnel Wrapping
            if (g.row === 10) {
                if (g.x < this.offsetX) g.x = this.offsetX + (this.cols - 1) * this.tileSize;
                else if (g.x > this.offsetX + this.cols * this.tileSize) g.x = this.offsetX;
            }

            if (dist < 4) {
                g.x = center.x;
                g.y = center.y;
                this.chooseGhostDirection(g);
            }

            g.x += g.dir.dx * speed * dt;
            g.y += g.dir.dy * speed * dt;
            g.col = Math.floor((g.x - this.offsetX) / this.tileSize);
            g.row = Math.floor((g.y - this.offsetY) / this.tileSize);

            // Eaten ghost reached ghost house
            if (g.state === 'eaten' && g.col === 9 && (g.row === 7 || g.row === 8 || g.row === 9)) {
                g.state = 'chase';
            }
        }
    }

    chooseGhostDirection(g) {
        const dirs = [
            { dx: 0, dy: -1 }, // Up
            { dx: -1, dy: 0 }, // Left
            { dx: 0, dy: 1 },  // Down
            { dx: 1, dy: 0 }   // Right
        ];

        // Valid directions (cannot reverse into opposite direction)
        const validDirs = dirs.filter(d => {
            if (d.dx === -g.dir.dx && d.dy === -g.dir.dy) return false;
            const nc = g.col + d.dx;
            const nr = g.row + d.dy;
            return this.isWalkable(nc, nr, g.state === 'eaten');
        });

        if (validDirs.length === 0) {
            // Dead end, allow turn around
            g.dir = { dx: -g.dir.dx, dy: -g.dir.dy };
            return;
        }

        if (g.state === 'frightened') {
            // Random direction
            g.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            return;
        }

        // Determine target tile based on personality and state
        let target = { col: this.player.col, row: this.player.row };

        if (g.state === 'eaten') {
            target = { col: 9, row: 7 };
        } else if (g.personality === 'ambush') {
            // Pinky: 4 tiles ahead of player
            target = {
                col: this.player.col + this.player.dir.dx * 4,
                row: this.player.row + this.player.dir.dy * 4
            };
        } else if (g.personality === 'flanker') {
            // Inky: Vector doubling
            const blinky = this.ghosts[0];
            const pivotCol = this.player.col + this.player.dir.dx * 2;
            const pivotRow = this.player.row + this.player.dir.dy * 2;
            target = {
                col: pivotCol + (pivotCol - blinky.col),
                row: pivotRow + (pivotRow - blinky.row)
            };
        } else if (g.personality === 'wanderer') {
            // Clyde: If distance > 8 tiles, target Pac-Man, else bottom-left corner
            const dist = Math.hypot(g.col - this.player.col, g.row - this.player.row);
            if (dist < 8) {
                target = { col: 1, row: 19 };
            }
        }

        // Pick direction minimizing Euclidean distance to target
        let bestDir = validDirs[0];
        let bestDist = Infinity;
        for (const d of validDirs) {
            const nc = g.col + d.dx;
            const nr = g.row + d.dy;
            const distToTarget = Math.hypot(nc - target.col, nr - target.row);
            if (distToTarget < bestDist) {
                bestDist = distToTarget;
                bestDir = d;
            }
        }

        g.dir = bestDir;
    }

    checkGhostCollisions() {
        const p = this.player;

        for (const g of this.ghosts) {
            const dist = Math.hypot(p.x - g.x, p.y - g.y);
            if (dist < p.radius + g.radius - 4) {
                if (g.state === 'frightened') {
                    // Eat ghost!
                    g.state = 'eaten';
                    this.ghostsEatenInPhase++;
                    const points = 200 * Math.pow(2, this.ghostsEatenInPhase - 1);
                    this.score += points;
                    this.addFloatingText(`+${points}`, g.x, g.y - 15, '#00f0ff');
                    this.spawnParticles(g.x, g.y, '#00f0ff', 12);
                    if (this.audio) this.audio.eatGhost();
                    if (typeof CGZBridge !== 'undefined') {
                        CGZBridge.vibrate(25);
                        CGZBridge.unlockAchievement('pellet_devourer');
                        CGZBridge.reportScore('pacman', this.score);
                    }
                } else if (g.state === 'chase') {
                    // Player died
                    this.lives--;
                    this.spawnParticles(p.x, p.y, '#ffea00', 20);
                    if (this.audio) this.audio.death();

                    if (this.lives <= 0) {
                        this.gameState = 'game_over';
                        if (typeof CGZBridge !== 'undefined') {
                            CGZBridge.reportScore('pacman', this.score);
                        }
                    } else {
                        this.resetPositions();
                    }
                    return;
                }
            }
        }
    }

    resetPositions() {
        this.initPlayer();
        this.initGhosts();
        this.frightenedTimer = 0;
    }

    checkWinCondition() {
        if (this.pelletsRemaining <= 0) {
            this.gameState = 'victory';
            this.score += 2000;
            if (this.audio) this.audio.victory();
        }
    }

    isWalkable(col, row, isEatenGhost = false) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            // Tunnel on row 10
            return row === 10;
        }
        const val = this.grid[row][col];
        if (val === 1) return false; // Wall
        if (val === 4 && !isEatenGhost) return false; // Ghost gate (only eaten ghosts can enter)
        return true;
    }

    getTileCenter(col, row) {
        return {
            x: this.offsetX + col * this.tileSize + this.tileSize / 2,
            y: this.offsetY + row * this.tileSize + this.tileSize / 2
        };
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

    spawnParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 25 + Math.random() * 70;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.3,
                color
            });
        }
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({ text, x, y, vy: -25, life: 1.0, color });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Render Maze
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = this.offsetX + c * this.tileSize;
                const y = this.offsetY + r * this.tileSize;
                const val = this.grid[r][c];

                if (val === 1) {
                    // Neon Wall
                    ctx.fillStyle = '#0d1525';
                    ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    ctx.strokeStyle = '#1f6feb';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x, y, this.tileSize, this.tileSize);
                } else if (val === 0) {
                    // Pellet
                    ctx.fillStyle = '#f0f6fc';
                    ctx.beginPath();
                    ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                } else if (val === 2) {
                    // Energizer
                    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.25;
                    ctx.fillStyle = '#00f0ff';
                    ctx.shadowColor = '#00f0ff';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, 6 * pulse, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else if (val === 4) {
                    // Ghost Gate
                    ctx.strokeStyle = '#ff77aa';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y + this.tileSize / 2);
                    ctx.lineTo(x + this.tileSize, y + this.tileSize / 2);
                    ctx.stroke();
                }
            }
        }

        // Render Player
        const p = this.player;
        ctx.save();
        ctx.shadowColor = '#ffea00';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffea00';

        let baseAngle = 0;
        if (p.dir.dx === -1) baseAngle = Math.PI;
        else if (p.dir.dy === -1) baseAngle = -Math.PI / 2;
        else if (p.dir.dy === 1) baseAngle = Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.radius, baseAngle + p.mouthAngle, baseAngle + Math.PI * 2 - p.mouthAngle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Render Ghosts
        for (const g of this.ghosts) {
            ctx.save();
            if (g.state === 'frightened') {
                const flash = this.frightenedTimer < 2.0 && Math.sin(this.frightenedTimer * 12) > 0;
                ctx.fillStyle = flash ? '#ffffff' : '#1f6feb';
                ctx.shadowColor = '#1f6feb';
            } else if (g.state === 'eaten') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            } else {
                ctx.fillStyle = g.color;
                ctx.shadowColor = g.color;
            }
            ctx.shadowBlur = 10;

            // Ghost dome
            ctx.beginPath();
            ctx.arc(g.x, g.y - 2, g.radius, Math.PI, 0, false);
            // Skirt
            ctx.lineTo(g.x + g.radius, g.y + g.radius);
            ctx.lineTo(g.x + g.radius * 0.33, g.y + g.radius - 3);
            ctx.lineTo(g.x - g.radius * 0.33, g.y + g.radius);
            ctx.lineTo(g.x - g.radius, g.y + g.radius - 3);
            ctx.closePath();
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(g.x - 4 + g.dir.dx * 2, g.y - 4 + g.dir.dy * 2, 3, 0, Math.PI * 2);
            ctx.arc(g.x + 4 + g.dir.dx * 2, g.y - 4 + g.dir.dy * 2, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = g.state === 'frightened' ? '#ff0055' : '#05070a';
            ctx.beginPath();
            ctx.arc(g.x - 4 + g.dir.dx * 3, g.y - 4 + g.dir.dy * 3, 1.5, 0, Math.PI * 2);
            ctx.arc(g.x + 4 + g.dir.dx * 3, g.y - 4 + g.dir.dy * 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Render Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, 3, 3);
        }

        // Render Floating Texts
        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }

        // Render HUD
        this.renderHUD(ctx);

        // Render Overlays
        if (this.gameState === 'game_over') {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 5, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 10);
            ctx.fillStyle = '#8b949e';
            ctx.font = '16px sans-serif';
            ctx.fillText("Press SPACE or Tap to Retry", this.width / 2, this.height / 2 + 35);
            ctx.restore();
        } else if (this.gameState === 'victory') {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 20, 15, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 25;
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("MAZE CLEARED!", this.width / 2, this.height / 2 - 20);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '20px sans-serif';
            ctx.fillText(`All Quantum Pellets Collected! Score: ${this.score}`, this.width / 2, this.height / 2 + 20);
            ctx.fillStyle = '#8b949e';
            ctx.font = '15px sans-serif';
            ctx.fillText("Press SPACE to Play Again", this.width / 2, this.height / 2 + 55);
            ctx.restore();
        }
    }

    renderHUD(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
        ctx.fillRect(10, 8, this.width - 20, 32);
        ctx.strokeStyle = '#30363d';
        ctx.strokeRect(10, 8, this.width - 20, 32);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.score}`, 25, 29);

        ctx.fillStyle = '#ffea00';
        ctx.fillText(`LIVES: ${"● ".repeat(this.lives)}`, 200, 29);

        ctx.fillStyle = '#39ff14';
        ctx.fillText(`PELLETS: ${this.pelletsRemaining}`, 360, 29);

        if (this.frightenedTimer > 0) {
            ctx.fillStyle = '#ff0055';
            ctx.textAlign = 'right';
            ctx.fillText(`ENERGIZED: ${this.frightenedTimer.toFixed(1)}s`, this.width - 25, 29);
        }
        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PacmanEngine };
}
