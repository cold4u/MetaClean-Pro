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

const BUILDINGS = {
    solar: { name: "Solar Farm", cost: 150, generation: 35, consumption: 0, tax: 0, pop: 0, color: '#ffea00', icon: '☀️' },
    fusion: { name: "Fusion Core", cost: 500, generation: 140, consumption: 0, tax: 0, pop: 0, color: '#00f0ff', icon: '⚛️' },
    conduit: { name: "Power Conduit", cost: 40, generation: 0, consumption: 0, tax: 0, pop: 0, color: '#39ff14', icon: '⚡' },
    battery: { name: "Battery Bank", cost: 200, capacity: 250, generation: 0, consumption: 0, tax: 0, pop: 0, color: '#a855f7', icon: '🔋' },
    residential: { name: "Cyber Housing", cost: 120, generation: 0, consumption: 20, tax: 45, pop: 120, color: '#3b82f6', icon: '🏙️' },
    corporate: { name: "Tech Spire", cost: 350, generation: 0, consumption: 55, tax: 150, pop: 60, color: '#ec4899', icon: '🏢' }
};

class TycoonEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.cols = 12;
        this.rows = 9;
        this.tileSize = 52;
        this.offsetX = Math.floor((this.width - this.cols * this.tileSize) / 2);
        this.offsetY = 75;

        this.credits = 750;
        this.population = 0;
        this.satisfaction = 100; // 0 to 100%
        this.dayTime = 8.0; // 0.0 to 24.0 (starts at 8:00 AM)
        this.batteryCharge = 0;
        this.maxBatteryCapacity = 0;

        this.totalGeneration = 0;
        this.totalDemand = 0;

        this.selectedTool = 'solar'; // active building tool
        this.hoverTile = null;

        this.simTimer = 0;
        this.tickInterval = 1.5; // Every 1.5 seconds

        this.gameState = 'playing'; // 'playing', 'bankrupt', 'victory'
        this.victoryGoalPop = 1200;
        this.victoryGoalCredits = 3500;

        this.particles = [];
        this.floatingTexts = [];

        this.initGrid();
    }

    initGrid() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                // Natural terrain (e.g. river crossing column 6)
                const isRiver = (c === 6 && r >= 2 && r <= 6);
                this.grid[r][c] = {
                    col: c,
                    row: r,
                    terrain: isRiver ? 'river' : 'plain',
                    building: null,
                    powered: false
                };
            }
        }
    }

    buildAt(col, row, type) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
        const tile = this.grid[row][col];
        if (tile.building) return false; // Already occupied
        if (tile.terrain === 'river') return false; // Cannot build in water

        const bDef = BUILDINGS[type];
        if (!bDef || this.credits < bDef.cost) return false;

        this.credits -= bDef.cost;
        tile.building = {
            type,
            level: 1,
            powered: false
        };

        this.addFloatingText(`-${bDef.cost} CR`, this.offsetX + col * this.tileSize + 26, this.offsetY + row * this.tileSize, '#ff0055');
        this.spawnParticles(this.offsetX + col * this.tileSize + 26, this.offsetY + row * this.tileSize + 26, bDef.color, 10);
        if (this.audio) this.audio.build();

        this.calculatePowerGrid();
        return true;
    }

    demolishAt(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
        const tile = this.grid[row][col];
        if (!tile.building) return false;

        const bDef = BUILDINGS[tile.building.type];
        const refund = Math.floor(bDef.cost * 0.4);
        this.credits += refund;
        tile.building = null;
        tile.powered = false;

        this.addFloatingText(`+${refund} CR`, this.offsetX + col * this.tileSize + 26, this.offsetY + row * this.tileSize, '#39ff14');
        this.calculatePowerGrid();
        return true;
    }

    getSunlightFactor() {
        // Sun reaches peak at 12:00 (1.2x), 0 at night (before 6:00 or after 18:00)
        if (this.dayTime >= 6.0 && this.dayTime <= 18.0) {
            return Math.sin(((this.dayTime - 6.0) / 12.0) * Math.PI) * 1.25;
        }
        return 0;
    }

    calculatePowerGrid() {
        const sunlight = this.getSunlightFactor();
        let totalGen = 0;
        let totalDem = 0;
        let totalBat = 0;
        let totalPop = 0;

        // Reset all powered flags
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const b = this.grid[r][c].building;
                if (b) {
                    b.powered = false;
                    const def = BUILDINGS[b.type];
                    if (b.type === 'solar') totalGen += Math.round(def.generation * sunlight);
                    else if (b.type === 'fusion') totalGen += def.generation;
                    else if (b.type === 'battery') totalBat += def.capacity;
                    else if (b.type === 'residential' || b.type === 'corporate') {
                        totalDem += def.consumption;
                    }
                }
            }
        }

        this.maxBatteryCapacity = totalBat;
        this.totalGeneration = totalGen;
        this.totalDemand = totalDem;

        // BFS Connected Components from Power Plants and Conduits
        const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const startTile = this.grid[r][c];
                if (!visited[r][c] && startTile.building && (startTile.building.type === 'solar' || startTile.building.type === 'fusion')) {
                    // Explore this connected component
                    const componentTiles = [];
                    const queue = [{ c, r }];
                    visited[r][c] = true;

                    let compGen = 0;
                    let compDem = 0;

                    while (queue.length > 0) {
                        const curr = queue.shift();
                        const t = this.grid[curr.r][curr.c];
                        componentTiles.push(t);

                        const def = BUILDINGS[t.building.type];
                        if (t.building.type === 'solar') compGen += Math.round(def.generation * sunlight);
                        else if (t.building.type === 'fusion') compGen += def.generation;
                        else if (t.building.type === 'residential' || t.building.type === 'corporate') {
                            compDem += def.consumption;
                        }

                        // Neighbors
                        const neighbors = [
                            { c: curr.c + 1, r: curr.r },
                            { c: curr.c - 1, r: curr.r },
                            { c: curr.c, r: curr.r + 1 },
                            { c: curr.c, r: curr.r - 1 }
                        ];

                        for (const n of neighbors) {
                            if (n.c >= 0 && n.c < this.cols && n.r >= 0 && n.r < this.rows) {
                                if (!visited[n.r][n.c] && this.grid[n.r][n.c].building) {
                                    visited[n.r][n.c] = true;
                                    queue.push(n);
                                }
                            }
                        }
                    }

                    // Check if component power is sufficient
                    const surplus = compGen - compDem;
                    let canPower = surplus >= 0;

                    if (!canPower && this.batteryCharge > 0) {
                        const needed = compDem - compGen;
                        if (this.batteryCharge >= needed) {
                            canPower = true;
                        }
                    }

                    for (const t of componentTiles) {
                        t.building.powered = canPower;
                        if (canPower && (t.building.type === 'residential' || t.building.type === 'corporate')) {
                            totalPop += BUILDINGS[t.building.type].pop;
                        }
                    }
                }
            }
        }

        this.population = totalPop;
    }

    update(dt) {
        if (this.gameState !== 'playing') return;

        // Day/night progression (1 game day = 60 real seconds)
        this.dayTime = (this.dayTime + (24 / 60) * dt) % 24.0;

        this.simTimer += dt;
        if (this.simTimer >= this.tickInterval) {
            this.simTimer = 0;
            this.simulationTick();
        }

        this.updateEffects(dt);
    }

    simulationTick() {
        this.calculatePowerGrid();

        const netPower = this.totalGeneration - this.totalDemand;
        if (netPower > 0) {
            // Charge battery
            this.batteryCharge = Math.min(this.maxBatteryCapacity, this.batteryCharge + netPower * 0.5);
        } else if (netPower < 0) {
            // Drain battery
            this.batteryCharge = Math.max(0, this.batteryCharge + netPower * 0.5);
        }

        // Collect tax revenue from powered buildings
        let tickRevenue = 0;
        let poweredConsumers = 0;
        let totalConsumers = 0;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const b = this.grid[r][c].building;
                if (b && (b.type === 'residential' || b.type === 'corporate')) {
                    totalConsumers++;
                    if (b.powered) {
                        poweredConsumers++;
                        tickRevenue += BUILDINGS[b.type].tax;
                    }
                }
            }
        }

        // Apply tax and satisfaction
        this.credits += tickRevenue;
        if (tickRevenue > 0) {
            this.addFloatingText(`+${tickRevenue} CR`, this.width / 2, 45, '#39ff14');
            if (this.audio && Math.random() < 0.4) this.audio.revenue();
        }

        if (totalConsumers > 0) {
            const targetSatisfaction = Math.round((poweredConsumers / totalConsumers) * 100);
            this.satisfaction += Math.sign(targetSatisfaction - this.satisfaction) * 4;
            this.satisfaction = Math.max(0, Math.min(100, this.satisfaction));

            if (poweredConsumers < totalConsumers && Math.random() < 0.25) {
                if (this.audio) this.audio.blackout();
            }
        }

        // Check Victory & Loss conditions
        if (this.population >= this.victoryGoalPop && this.credits >= this.victoryGoalCredits) {
            this.gameState = 'victory';
            if (this.audio) this.audio.milestone();
        } else if (this.credits < 0 || (this.population > 200 && this.satisfaction <= 5)) {
            this.gameState = 'bankrupt';
            if (this.audio) this.audio.blackout();
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
            const speed = 25 + Math.random() * 60;
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
        this.floatingTexts.push({ text, x, y, vy: -25, life: 1.2, color });
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        // Background / Ambient Sky based on Time of Day
        const sun = this.getSunlightFactor();
        const skyR = Math.floor(5 + sun * 15);
        const skyG = Math.floor(7 + sun * 20);
        const skyB = Math.floor(15 + sun * 35);
        ctx.fillStyle = `rgb(${skyR}, ${skyG}, ${skyB})`;
        ctx.fillRect(0, 0, this.width, this.height);

        // Render Grid
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = this.offsetX + c * this.tileSize;
                const y = this.offsetY + r * this.tileSize;
                const tile = this.grid[r][c];

                if (tile.terrain === 'river') {
                    // River water
                    ctx.fillStyle = '#0f2942';
                    ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    ctx.strokeStyle = '#1f6feb';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, this.tileSize, this.tileSize);

                    // Water wave detail
                    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(x + 5, y + 26);
                    ctx.lineTo(x + this.tileSize - 5, y + 26);
                    ctx.stroke();
                } else {
                    // Plain ground
                    ctx.fillStyle = (r + c) % 2 === 0 ? '#0d1117' : '#111620';
                    ctx.fillRect(x, y, this.tileSize, this.tileSize);
                    ctx.strokeStyle = '#21262d';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, this.tileSize, this.tileSize);
                }

                // Render Building
                if (tile.building) {
                    const b = tile.building;
                    const def = BUILDINGS[b.type];

                    ctx.save();
                    if (b.powered) {
                        ctx.shadowColor = def.color;
                        ctx.shadowBlur = 8;
                    }
                    ctx.fillStyle = b.powered ? def.color : '#484f58';
                    ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);

                    // Icon / symbol
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '20px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(def.icon, x + this.tileSize / 2, y + this.tileSize / 2 + 7);

                    // Unpowered warning indicator
                    if (!b.powered && (b.type === 'residential' || b.type === 'corporate')) {
                        ctx.fillStyle = '#ff0055';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillText("⚡!", x + this.tileSize - 10, y + 14);
                    }
                    ctx.restore();
                }

                // Render Hover cursor
                if (this.hoverTile && this.hoverTile.col === c && this.hoverTile.row === r) {
                    ctx.strokeStyle = '#00f0ff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
                }
            }
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

        // Overlays
        if (this.gameState === 'bankrupt') {
            ctx.save();
            ctx.fillStyle = 'rgba(20, 5, 10, 0.85)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 20;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("GRID COLLAPSE: BANKRUPT", this.width / 2, this.height / 2 - 10);
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
            ctx.fillText("METROPOLIS FOUNDED!", this.width / 2, this.height / 2 - 20);
            ctx.fillStyle = '#00f0ff';
            ctx.font = '20px sans-serif';
            ctx.fillText(`Population: ${this.population} • Treasury: ${this.credits} CR`, this.width / 2, this.height / 2 + 20);
            ctx.fillStyle = '#8b949e';
            ctx.font = '15px sans-serif';
            ctx.fillText("Press SPACE to Play Again", this.width / 2, this.height / 2 + 55);
            ctx.restore();
        }
    }

    renderHUD(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.92)';
        ctx.fillRect(10, 8, this.width - 20, 56);
        ctx.strokeStyle = '#30363d';
        ctx.strokeRect(10, 8, this.width - 20, 56);

        // Row 1: Credits, Pop, Power, Battery
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#39ff14';
        ctx.fillText(`💳 ${this.credits} CR`, 25, 28);

        ctx.fillStyle = '#3b82f6';
        ctx.fillText(`👥 POP: ${this.population}`, 150, 28);

        const powerColor = this.totalGeneration >= this.totalDemand ? '#00f0ff' : '#ff0055';
        ctx.fillStyle = powerColor;
        ctx.fillText(`⚡ ${this.totalGeneration} MW / ${this.totalDemand} MW`, 280, 28);

        ctx.fillStyle = '#a855f7';
        ctx.fillText(`🔋 ${Math.round(this.batteryCharge)} / ${this.maxBatteryCapacity} MWh`, 470, 28);

        // Row 2: Clock, Satisfaction, Goal
        const hours = Math.floor(this.dayTime);
        const mins = Math.floor((this.dayTime % 1) * 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        ctx.fillStyle = '#ffea00';
        ctx.fillText(`🕒 ${timeStr} (Sun: ${Math.round(this.getSunlightFactor() * 100)}%)`, 25, 52);

        ctx.fillStyle = this.satisfaction > 60 ? '#39ff14' : (this.satisfaction > 30 ? '#ffaa00' : '#ff0055');
        ctx.fillText(`😊 SATISFACTION: ${this.satisfaction}%`, 250, 52);

        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'right';
        ctx.fillText(`GOAL: ${this.victoryGoalPop} Pop & ${this.victoryGoalCredits} CR`, this.width - 25, 52);
        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TycoonEngine, BUILDINGS };
}
