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

class BomberEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.cols = 15;
        this.rows = 13;
        this.tileSize = 40;
        this.offsetX = Math.floor((this.width - this.cols * this.tileSize) / 2); // 100
        this.offsetY = Math.floor((this.height - this.rows * this.tileSize) / 2) + 15; // 47

        this.grid = []; // 0: empty, 1: solid wall, 2: crate
        this.bombs = []; // { col, row, timer, range, owner }
        this.flames = []; // { col, row, timer }
        this.powerups = []; // { col, row, type: 'bombs'|'fire'|'speed' }
        this.particles = [];
        this.floatingTexts = [];

        this.gameState = 'playing'; // 'playing', 'game_over', 'victory'
        this.roundScore = 0;

        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            bomb: false
        };

        this.initGrid();
        this.initPlayers();
    }

    initGrid() {
        this.grid = [];
        this.bombs = [];
        this.flames = [];
        this.powerups = [];

        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                // Perimeter walls
                if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
                    this.grid[r][c] = 1;
                }
                // Pillars on odd col and row
                else if (c % 2 === 0 && r % 2 === 0) {
                    this.grid[r][c] = 1;
                }
                // Spawning corners protection
                else if (
                    (c <= 2 && r <= 2) || // Top-left
                    (c >= this.cols - 3 && r <= 2) || // Top-right
                    (c <= 2 && r >= this.rows - 3) || // Bottom-left
                    (c >= this.cols - 3 && r >= this.rows - 3) // Bottom-right
                ) {
                    this.grid[r][c] = 0;
                }
                // Destructible crates
                else {
                    this.grid[r][c] = Math.random() < 0.72 ? 2 : 0;
                }
            }
        }
    }

    initPlayers() {
        this.players = [
            this.createPlayer(0, 1, 1, '#00f0ff', "Player 1", false),
            this.createPlayer(1, this.cols - 2, 1, '#ff0055', "Cyborg-Alpha", true),
            this.createPlayer(2, 1, this.rows - 2, '#a855f7', "Cyborg-Beta", true),
            this.createPlayer(3, this.cols - 2, this.rows - 2, '#ffaa00', "Cyborg-Gamma", true)
        ];
    }

    createPlayer(id, col, row, color, name, isBot) {
        return {
            id,
            col,
            row,
            x: this.offsetX + col * this.tileSize + this.tileSize / 2,
            y: this.offsetY + row * this.tileSize + this.tileSize / 2,
            radius: 14,
            speed: 130,
            color,
            name,
            isBot,
            alive: true,
            maxBombs: 1,
            activeBombs: 0,
            bombRange: 2,
            botDir: null,
            botTimer: 0
        };
    }

    update(dt) {
        if (this.gameState !== 'playing') return;

        this.updatePlayerInput(dt);
        this.updateBots(dt);
        this.updateBombs(dt);
        this.updateFlames(dt);
        this.checkPowerupCollisions();
        this.updateEffects(dt);
        this.checkRoundStatus();
    }

    updatePlayerInput(dt) {
        const p = this.players[0];
        if (!p.alive) return;

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

        this.moveEntity(p, dx, dy, dt);

        if (this.keys.bomb) {
            this.dropBomb(p);
            this.keys.bomb = false;
        }
    }

    moveEntity(entity, dx, dy, dt) {
        if (dx === 0 && dy === 0) return;

        const targetX = entity.x + dx * entity.speed * dt;
        const targetY = entity.y + dy * entity.speed * dt;

        // Sub-step movement to prevent corner sticking
        const oldX = entity.x;
        const oldY = entity.y;

        entity.x = targetX;
        if (this.checkEntityCollision(entity)) {
            entity.x = oldX;
        }

        entity.y = targetY;
        if (this.checkEntityCollision(entity)) {
            entity.y = oldY;
        }

        entity.col = Math.floor((entity.x - this.offsetX) / this.tileSize);
        entity.row = Math.floor((entity.y - this.offsetY) / this.tileSize);
    }

    checkEntityCollision(entity) {
        const r = entity.radius;
        // Check tile bounds around entity
        const minCol = Math.floor((entity.x - r - this.offsetX) / this.tileSize);
        const maxCol = Math.floor((entity.x + r - this.offsetX) / this.tileSize);
        const minRow = Math.floor((entity.y - r - this.offsetY) / this.tileSize);
        const maxRow = Math.floor((entity.y + r - this.offsetY) / this.tileSize);

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;

                // Wall or Crate
                if (this.grid[row][col] === 1 || this.grid[row][col] === 2) {
                    const tileX = this.offsetX + col * this.tileSize;
                    const tileY = this.offsetY + row * this.tileSize;
                    const closestX = Math.max(tileX, Math.min(entity.x, tileX + this.tileSize));
                    const closestY = Math.max(tileY, Math.min(entity.y, tileY + this.tileSize));
                    if (Math.hypot(entity.x - closestX, entity.y - closestY) < r) {
                        return true;
                    }
                }

                // Bombs act as solid obstacles once entity moves off them
                for (const b of this.bombs) {
                    if (b.col === col && b.row === row) {
                        const bombX = this.offsetX + col * this.tileSize + this.tileSize / 2;
                        const bombY = this.offsetY + row * this.tileSize + this.tileSize / 2;
                        // If entity was already on the bomb when placed, allow walking off
                        const dist = Math.hypot(entity.x - bombX, entity.y - bombY);
                        if (dist < r + 14 && b.allowedEntityId !== entity.id) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    dropBomb(entity) {
        if (entity.activeBombs >= entity.maxBombs) return false;

        const col = Math.floor((entity.x - this.offsetX) / this.tileSize);
        const row = Math.floor((entity.y - this.offsetY) / this.tileSize);

        // Check if bomb already at position
        if (this.bombs.some(b => b.col === col && b.row === row)) return false;

        entity.activeBombs++;
        this.bombs.push({
            col,
            row,
            timer: 2.4,
            range: entity.bombRange,
            owner: entity,
            allowedEntityId: entity.id // Allows walking off own bomb
        });

        if (this.audio) this.audio.bombDrop();
        return true;
    }

    updateBombs(dt) {
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i];
            b.timer -= dt;

            // Clear allowedEntityId once entity has stepped off
            if (b.allowedEntityId !== null) {
                const owner = b.owner;
                const bombX = this.offsetX + b.col * this.tileSize + this.tileSize / 2;
                const bombY = this.offsetY + b.row * this.tileSize + this.tileSize / 2;
                if (Math.hypot(owner.x - bombX, owner.y - bombY) > owner.radius + 18) {
                    b.allowedEntityId = null;
                }
            }

            if (b.timer <= 0) {
                this.detonateBomb(i);
            }
        }
    }

    detonateBomb(index) {
        const bomb = this.bombs[index];
        this.bombs.splice(index, 1);
        if (bomb.owner) bomb.owner.activeBombs = Math.max(0, bomb.owner.activeBombs - 1);

        if (this.audio) this.audio.explode();

        // Spawn center flame
        this.addFlame(bomb.col, bomb.row);

        // Propagate in 4 directions
        const directions = [
            { dc: 0, dr: -1 }, // Up
            { dc: 0, dr: 1 },  // Down
            { dc: -1, dr: 0 }, // Left
            { dc: 1, dr: 0 }   // Right
        ];

        for (const dir of directions) {
            for (let step = 1; step <= bomb.range; step++) {
                const c = bomb.col + dir.dc * step;
                const r = bomb.row + dir.dr * step;

                if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) break;

                // Indestructible Wall: Block completely
                if (this.grid[r][c] === 1) break;

                // Destructible Crate: Destroy crate and stop flame propagation
                if (this.grid[r][c] === 2) {
                    this.grid[r][c] = 0;
                    this.addFlame(c, r);
                    this.spawnParticles(this.offsetX + c * this.tileSize + 20, this.offsetY + r * this.tileSize + 20, '#ffaa00', 8);

                    // Chance to spawn powerup
                    if (Math.random() < 0.38) {
                        const types = ['bombs', 'fire', 'speed'];
                        const type = types[Math.floor(Math.random() * types.length)];
                        this.powerups.push({ col: c, row: r, type });
                    }
                    break;
                }

                // Open floor: Spawn flame
                this.addFlame(c, r);

                // Chain reaction with other bombs
                const chainedIdx = this.bombs.findIndex(other => other.col === c && other.row === r);
                if (chainedIdx !== -1) {
                    this.detonateBomb(chainedIdx);
                    break;
                }
            }
        }
    }

    addFlame(col, row) {
        this.flames.push({ col, row, timer: 0.5 });
        this.spawnParticles(this.offsetX + col * this.tileSize + 20, this.offsetY + row * this.tileSize + 20, '#ff0055', 6);
    }

    updateFlames(dt) {
        for (let i = this.flames.length - 1; i >= 0; i--) {
            const f = this.flames[i];
            f.timer -= dt;

            // Check lethal collision with bombers
            for (const p of this.players) {
                if (!p.alive) continue;
                const tileX = this.offsetX + f.col * this.tileSize;
                const tileY = this.offsetY + f.row * this.tileSize;
                if (p.x >= tileX && p.x <= tileX + this.tileSize && p.y >= tileY && p.y <= tileY + this.tileSize) {
                    p.alive = false;
                    this.spawnParticles(p.x, p.y, p.color, 25);
                    this.addFloatingText("ELIMINATED!", p.x, p.y - 20, '#ff0055');
                    if (this.audio) this.audio.eliminated();
                }
            }

            // Powerup incinerated by flame
            for (let j = this.powerups.length - 1; j >= 0; j--) {
                const pu = this.powerups[j];
                if (pu.col === f.col && pu.row === f.row) {
                    this.powerups.splice(j, 1);
                }
            }

            if (f.timer <= 0) {
                this.flames.splice(i, 1);
            }
        }
    }

    checkPowerupCollisions() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pu = this.powerups[i];
            for (const p of this.players) {
                if (!p.alive) continue;
                if (p.col === pu.col && p.row === pu.row) {
                    if (pu.type === 'bombs') {
                        p.maxBombs = Math.min(5, p.maxBombs + 1);
                        this.addFloatingText("+1 BOMB", p.x, p.y - 15, '#00f0ff');
                    } else if (pu.type === 'fire') {
                        p.bombRange = Math.min(6, p.bombRange + 1);
                        this.addFloatingText("+1 FIRE", p.x, p.y - 15, '#ff5500');
                    } else if (pu.type === 'speed') {
                        p.speed = Math.min(220, p.speed + 25);
                        this.addFloatingText("+SPEED", p.x, p.y - 15, '#39ff14');
                    }

                    if (p.id === 0) this.roundScore += 150;
                    if (this.audio) this.audio.powerup();
                    this.powerups.splice(i, 1);
                    break;
                }
            }
        }
    }

    updateBots(dt) {
        for (let i = 1; i < this.players.length; i++) {
            const bot = this.players[i];
            if (!bot.alive) continue;

            bot.botTimer -= dt;

            // Check if bot is on a tile threatened by a bomb
            const isInDanger = this.isTileThreatened(bot.col, bot.row);

            if (isInDanger || bot.botTimer <= 0 || !bot.botDir) {
                bot.botTimer = 0.25 + Math.random() * 0.25;

                // Directions: Up, Down, Left, Right
                const dirs = [
                    { dx: 0, dy: -1 },
                    { dx: 0, dy: 1 },
                    { dx: -1, dy: 0 },
                    { dx: 1, dy: 0 }
                ];

                // If in danger, prioritize safe adjacent tiles
                if (isInDanger) {
                    const safeDirs = dirs.filter(d => {
                        const nc = bot.col + d.dx;
                        const nr = bot.row + d.dy;
                        return this.isTileWalkable(nc, nr) && !this.isTileThreatened(nc, nr);
                    });

                    if (safeDirs.length > 0) {
                        bot.botDir = safeDirs[Math.floor(Math.random() * safeDirs.length)];
                    } else {
                        // Any walkable tile
                        const walkable = dirs.filter(d => this.isTileWalkable(bot.col + d.dx, bot.row + d.dy));
                        bot.botDir = walkable[Math.floor(Math.random() * walkable.length)] || null;
                    }
                } else {
                    // Bot is safe: consider dropping a bomb near crates
                    const hasAdjacentCrate = dirs.some(d => {
                        const c = bot.col + d.dx;
                        const r = bot.row + d.dy;
                        return r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.grid[r][c] === 2;
                    });

                    if (hasAdjacentCrate && Math.random() < 0.2 && bot.activeBombs < bot.maxBombs) {
                        this.dropBomb(bot);
                    }

                    // Move towards walkable tile
                    const walkable = dirs.filter(d => {
                        const nc = bot.col + d.dx;
                        const nr = bot.row + d.dy;
                        return this.isTileWalkable(nc, nr) && !this.isTileThreatened(nc, nr);
                    });

                    bot.botDir = walkable[Math.floor(Math.random() * walkable.length)] || null;
                }
            }

            if (bot.botDir) {
                this.moveEntity(bot, bot.botDir.dx, bot.botDir.dy, dt);
            }
        }
    }

    isTileWalkable(c, r) {
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
        if (this.grid[r][c] !== 0) return false;
        if (this.bombs.some(b => b.col === c && b.row === r)) return false;
        return true;
    }

    isTileThreatened(col, row) {
        // Direct bomb or flame
        if (this.flames.some(f => f.col === col && f.row === row)) return true;

        for (const b of this.bombs) {
            if (b.col === col && b.row === row) return true;

            // In line with bomb
            if (b.col === col) {
                const minR = Math.min(b.row, row);
                const maxR = Math.max(b.row, row);
                if (maxR - minR <= b.range) {
                    let blocked = false;
                    for (let r = minR + 1; r < maxR; r++) {
                        if (this.grid[r][col] === 1 || this.grid[r][col] === 2) {
                            blocked = true;
                            break;
                        }
                    }
                    if (!blocked) return true;
                }
            } else if (b.row === row) {
                const minC = Math.min(b.col, col);
                const maxC = Math.max(b.col, col);
                if (maxC - minC <= b.range) {
                    let blocked = false;
                    for (let c = minC + 1; c < maxC; c++) {
                        if (this.grid[row][c] === 1 || this.grid[row][c] === 2) {
                            blocked = true;
                            break;
                        }
                    }
                    if (!blocked) return true;
                }
            }
        }
        return false;
    }

    checkRoundStatus() {
        const player = this.players[0];
        const aliveBots = this.players.slice(1).filter(b => b.alive);

        if (!player.alive) {
            this.gameState = 'game_over';
        } else if (aliveBots.length === 0) {
            this.gameState = 'victory';
            this.roundScore += 1000;
            if (this.audio) this.audio.victory();
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

    spawnParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 80;
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
        this.floatingTexts.push({ text, x, y, vy: -30, life: 1.0, color });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Render Grid
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = this.offsetX + c * this.tileSize;
                const y = this.offsetY + r * this.tileSize;

                // Floor
                ctx.fillStyle = (r + c) % 2 === 0 ? '#0d1117' : '#111620';
                ctx.fillRect(x, y, this.tileSize, this.tileSize);

                if (this.grid[r][c] === 1) {
                    // Indestructible pillar
                    ctx.fillStyle = '#161b22';
                    ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
                    ctx.strokeStyle = '#30363d';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);

                    // Rivet details
                    ctx.fillStyle = '#58a6ff';
                    ctx.fillRect(x + 6, y + 6, 3, 3);
                    ctx.fillRect(x + this.tileSize - 9, y + 6, 3, 3);
                    ctx.fillRect(x + 6, y + this.tileSize - 9, 3, 3);
                    ctx.fillRect(x + this.tileSize - 9, y + this.tileSize - 9, 3, 3);
                } else if (this.grid[r][c] === 2) {
                    // Destructible Crate
                    ctx.fillStyle = '#21262d';
                    ctx.fillRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);
                    ctx.strokeStyle = '#ffaa00';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);

                    // Tech crate cross
                    ctx.beginPath();
                    ctx.moveTo(x + 6, y + 6);
                    ctx.lineTo(x + this.tileSize - 6, y + this.tileSize - 6);
                    ctx.moveTo(x + this.tileSize - 6, y + 6);
                    ctx.lineTo(x + 6, y + this.tileSize - 6);
                    ctx.stroke();
                }
            }
        }

        // Render Powerups
        for (const pu of this.powerups) {
            const px = this.offsetX + pu.col * this.tileSize + this.tileSize / 2;
            const py = this.offsetY + pu.row * this.tileSize + this.tileSize / 2;

            ctx.save();
            ctx.shadowBlur = 10;
            if (pu.type === 'bombs') {
                ctx.fillStyle = '#00f0ff';
                ctx.shadowColor = '#00f0ff';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#05070a';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("+B", px, py + 4);
            } else if (pu.type === 'fire') {
                ctx.fillStyle = '#ff5500';
                ctx.shadowColor = '#ff5500';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("🔥", px, py + 4);
            } else {
                ctx.fillStyle = '#39ff14';
                ctx.shadowColor = '#39ff14';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#05070a';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("⚡", px, py + 4);
            }
            ctx.restore();
        }

        // Render Bombs
        for (const b of this.bombs) {
            const bx = this.offsetX + b.col * this.tileSize + this.tileSize / 2;
            const by = this.offsetY + b.row * this.tileSize + this.tileSize / 2;
            const pulse = 1 + Math.sin(b.timer * 10) * 0.12;

            ctx.save();
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#21262d';
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bx, by, 13 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Fuse spark
            ctx.fillStyle = '#ffea00';
            ctx.beginPath();
            ctx.arc(bx + 6, by - 12, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Render Flames
        for (const f of this.flames) {
            const fx = this.offsetX + f.col * this.tileSize;
            const fy = this.offsetY + f.row * this.tileSize;

            ctx.save();
            ctx.fillStyle = 'rgba(255, 60, 0, 0.75)';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20;
            ctx.fillRect(fx + 2, fy + 2, this.tileSize - 4, this.tileSize - 4);
            ctx.fillStyle = '#ffff55';
            ctx.fillRect(fx + 8, fy + 8, this.tileSize - 16, this.tileSize - 16);
            ctx.restore();
        }

        // Render Players / Bots
        for (const p of this.players) {
            if (!p.alive) continue;
            ctx.save();
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Visor / eyes
            ctx.fillStyle = '#05070a';
            ctx.fillRect(p.x - 6, p.y - 4, 12, 5);
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
            ctx.fillText("DETONATED - GAME OVER", this.width / 2, this.height / 2 - 10);
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
            ctx.fillText("ARENA CHAMPION!", this.width / 2, this.height / 2 - 20);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '20px sans-serif';
            ctx.fillText(`All Rivals Eliminated! Score: ${this.roundScore}`, this.width / 2, this.height / 2 + 20);
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

        const p = this.players[0];
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`BOMBS: ${p.maxBombs - p.activeBombs} / ${p.maxBombs}`, 25, 29);

        ctx.fillStyle = '#ff5500';
        ctx.fillText(`FIRE: ${p.bombRange}`, 160, 29);

        ctx.fillStyle = '#39ff14';
        ctx.fillText(`SPEED: ${p.speed}`, 260, 29);

        ctx.fillStyle = '#ffaa00';
        ctx.fillText(`SCORE: ${this.roundScore}`, 380, 29);

        const aliveBots = this.players.slice(1).filter(b => b.alive).length;
        ctx.fillStyle = '#f0f6fc';
        ctx.textAlign = 'right';
        ctx.fillText(`RIVALS ALIVE: ${aliveBots} / 3`, this.width - 25, 29);
        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BomberEngine };
}
