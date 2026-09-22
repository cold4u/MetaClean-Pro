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

class MiningEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        this.cols = 16;
        this.rows = 32;
        this.tileSize = 40;
        this.worldWidth = this.cols * this.tileSize; // 640
        this.offsetX = (this.width - this.worldWidth) / 2; // 80

        this.cameraY = 0;

        // Player Drill Pod
        this.player = {
            x: 7 * this.tileSize + 6,
            y: 0,
            w: 28,
            h: 28,
            vx: 0,
            vy: 0,
            fuel: 100,
            maxFuel: 100,
            hp: 100,
            maxHp: 100,
            cargo: [],
            maxCargo: 6,
            drillTier: 1,
            credits: 0,
            isDrilling: false,
            drillTimer: 0,
            targetBlock: null
        };

        this.gravity = 520;

        // Controls
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false
        };

        // Upgrades Store prices & tiers
        this.upgrades = {
            drill: { level: 1, max: 4, cost: 120, name: "Drill Bit" },
            fuel: { level: 1, max: 4, cost: 90, name: "Fuel Tank" },
            cargo: { level: 1, max: 4, cost: 100, name: "Cargo Bay" },
            hull: { level: 1, max: 4, cost: 80, name: "Hull Plating" }
        };

        // Block types definitions
        this.blockTypes = {
            0: { name: "Air", solid: false },
            1: { name: "Dirt", solid: true, hp: 10, color: "#1e293b", val: 0 },
            2: { name: "Copper", solid: true, hp: 16, color: "#b45309", val: 25, icon: "🥉" },
            3: { name: "Silicon", solid: true, hp: 24, color: "#00f0ff", val: 60, icon: "💎" },
            4: { name: "Basalt", solid: true, hp: 38, color: "#0f172a", val: 0 },
            5: { name: "Cobalt", solid: true, hp: 45, color: "#3b82f6", val: 140, icon: "💠" },
            6: { name: "Magma", solid: true, hp: 20, color: "#ff0055", val: 0, hazard: 25 },
            7: { name: "Quantumite", solid: true, hp: 60, color: "#a855f7", val: 320, icon: "🔮" },
            8: { name: "Boulder", solid: true, hp: 999, color: "#475569", val: 0 },
            9: { name: "Ancient Core", solid: true, hp: 80, color: "#ffe600", val: 2000, icon: "⭐" }
        };

        this.grid = [];
        this.floatingTexts = [];
        this.particles = [];

        this.gameOver = false;
        this.victory = false;

        this.generateWorld();
    }

    generateWorld() {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                if (r === 0) {
                    this.grid[r][c] = 0; // Surface air
                } else if (r === 1) {
                    this.grid[r][c] = 1; // Top dirt
                } else if (r === this.rows - 1 && c === 8) {
                    this.grid[r][c] = 9; // Core Crystal at bottom center!
                } else {
                    const depth = r / this.rows;
                    const rand = Math.random();

                    if (rand < 0.08) {
                        this.grid[r][c] = 8; // Unstable boulder
                    } else if (depth > 0.65 && rand < 0.14) {
                        this.grid[r][c] = 6; // Magma hazard
                    } else if (depth > 0.7 && rand < 0.22) {
                        this.grid[r][c] = 7; // Quantumite
                    } else if (depth > 0.4 && rand < 0.3) {
                        this.grid[r][c] = 5; // Cobalt
                    } else if (depth > 0.2 && rand < 0.4) {
                        this.grid[r][c] = 3; // Silicon
                    } else if (rand < 0.52) {
                        this.grid[r][c] = 2; // Copper
                    } else if (depth > 0.4 && rand < 0.75) {
                        this.grid[r][c] = 4; // Basalt
                    } else {
                        this.grid[r][c] = 1; // Dirt
                    }
                }
            }
        }
    }

    update(dt) {
        if (this.gameOver || this.victory) return;

        const p = this.player;

        // Fuel depletion check
        if (p.fuel <= 0 && p.y > 40) {
            this.triggerEmergencyTow("OUT OF FUEL! TOWED TO SURFACE (-$50)");
            return;
        }

        // Horizontal Movement
        let moveX = 0;
        if (this.keys.left) moveX -= 1;
        if (this.keys.right) moveX += 1;

        if (moveX !== 0 && !p.isDrilling) {
            const nextX = p.x + moveX * 140 * dt;
            const checkCol = moveX > 0 ? Math.floor((nextX + p.w) / this.tileSize) : Math.floor(nextX / this.tileSize);
            const checkRow = Math.floor((p.y + p.h / 2) / this.tileSize);

            if (checkCol >= 0 && checkCol < this.cols && checkRow >= 0 && checkRow < this.rows) {
                const blockType = this.grid[checkRow][checkCol];
                if (this.blockTypes[blockType].solid) {
                    // Start drilling horizontally
                    this.startDrill(checkRow, checkCol);
                } else {
                    p.x = nextX;
                    p.fuel = Math.max(0, p.fuel - 1.2 * dt);
                }
            }
        }

        // Vertical Movement (Thrusters vs Gravity)
        if (this.keys.up && p.fuel > 0 && !p.isDrilling) {
            p.vy = -180;
            p.fuel = Math.max(0, p.fuel - 4.5 * dt);
            if (this.audio && Math.random() < 0.2) this.audio.thruster();
            this.spawnExhaustParticles();
        } else if (!p.isDrilling) {
            p.vy += this.gravity * dt;
        }

        // Downward Drilling
        if (this.keys.down && !p.isDrilling) {
            const checkRow = Math.floor((p.y + p.h + 4) / this.tileSize);
            const checkCol = Math.floor((p.x + p.w / 2) / this.tileSize);
            if (checkRow >= 0 && checkRow < this.rows && checkCol >= 0 && checkCol < this.cols) {
                const blockType = this.grid[checkRow][checkCol];
                if (this.blockTypes[blockType].solid) {
                    this.startDrill(checkRow, checkCol);
                }
            }
        }

        // Apply Y movement & collision with ground
        if (!p.isDrilling) {
            p.y += p.vy * dt;
            const botRow = Math.floor((p.y + p.h) / this.tileSize);
            const col1 = Math.floor((p.x + 2) / this.tileSize);
            const col2 = Math.floor((p.x + p.w - 2) / this.tileSize);

            if (botRow >= 0 && botRow < this.rows && col1 >= 0 && col2 < this.cols) {
                if (this.blockTypes[this.grid[botRow][col1]].solid || this.blockTypes[this.grid[botRow][col2]].solid) {
                    p.y = botRow * this.tileSize - p.h;
                    p.vy = 0;
                }
            }
        }

        // Clamp boundaries
        p.x = Math.max(0, Math.min(this.worldWidth - p.w, p.x));
        p.y = Math.max(0, Math.min(this.rows * this.tileSize - p.h, p.y));

        // Surface Station Handling
        if (p.y <= 10) {
            // Refuel automatically
            if (p.fuel < p.maxFuel) {
                p.fuel = Math.min(p.maxFuel, p.fuel + 40 * dt);
            }
            // Auto sell cargo
            if (p.cargo.length > 0) {
                this.sellCargo();
            }
        }

        // Update drilling progress
        if (p.isDrilling && p.targetBlock) {
            p.drillTimer -= dt * p.drillTier;
            p.fuel = Math.max(0, p.fuel - 6.0 * dt);
            if (this.audio && Math.random() < 0.25) this.audio.drill();

            if (p.drillTimer <= 0) {
                this.finishDrill();
            }
        }

        // Update Boulders Falling Physics
        this.updateBoulders(dt);

        // Update Camera
        this.cameraY = Math.max(0, Math.min((this.rows * this.tileSize) - this.height + 60, p.y - this.height * 0.45));

        // Update effects
        this.updateEffects(dt);
    }

    startDrill(r, c) {
        const type = this.grid[r][c];
        if (!this.blockTypes[type].solid || type === 8) return; // Cannot drill boulder

        this.player.isDrilling = true;
        this.player.targetBlock = { r, c, type };
        this.player.drillTimer = this.blockTypes[type].hp / 40;
    }

    finishDrill() {
        const p = this.player;
        if (!p.targetBlock) return;
        const { r, c, type } = p.targetBlock;

        const bDef = this.blockTypes[type];

        // Hazard damage
        if (bDef.hazard) {
            p.hp = Math.max(0, p.hp - bDef.hazard);
            this.addFloatingText(`-${bDef.hazard} HP (MAGMA)`, r, c, '#ff0055');
            if (this.audio) this.audio.hullDamage();
            if (p.hp <= 0) {
                this.triggerEmergencyTow("CRITICAL HULL BREACH! TOWED (-$50)");
                return;
            }
        }

        // Collect Ore if valuable
        if (bDef.val > 0) {
            if (type === 9) {
                // Ancient Core extracted: VICTORY!
                this.victory = true;
                if (this.audio) this.audio.victory();
            } else if (p.cargo.length < p.maxCargo) {
                p.cargo.push({ type, name: bDef.name, val: bDef.val, icon: bDef.icon });
                this.addFloatingText(`+${bDef.name}`, r, c, '#39ff14');
                if (this.audio) this.audio.orePickup();
            } else {
                this.addFloatingText("CARGO FULL!", r, c, '#f97316');
            }
        }

        // Clear block to air
        this.grid[r][c] = 0;
        this.spawnBlockParticles(r, c, bDef.color);

        p.isDrilling = false;
        p.targetBlock = null;
    }

    sellCargo() {
        const p = this.player;
        let totalVal = 0;
        p.cargo.forEach(c => totalVal += c.val);
        p.credits += totalVal;
        p.cargo = [];
        this.addFloatingText(`+$${totalVal} SOLD!`, 0, 7, '#ffe600');
        if (this.audio) this.audio.sellOres();
    }

    buyUpgrade(key) {
        const up = this.upgrades[key];
        const p = this.player;
        if (!up || up.level >= up.max || p.credits < up.cost) return;

        p.credits -= up.cost;
        up.level++;
        up.cost = Math.round(up.cost * 2.2);

        if (key === 'drill') p.drillTier = up.level;
        else if (key === 'fuel') { p.maxFuel += 60; p.fuel = p.maxFuel; }
        else if (key === 'cargo') p.maxCargo += 4;
        else if (key === 'hull') { p.maxHp += 40; p.hp = p.maxHp; }

        if (this.audio) this.audio.upgrade();
        this.addFloatingText(`UPGRADED ${up.name}!`, 0, 7, '#00f0ff');
    }

    triggerEmergencyTow(msg) {
        const p = this.player;
        p.credits = Math.max(0, p.credits - 50);
        p.x = 7 * this.tileSize + 6;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.fuel = p.maxFuel;
        p.hp = p.maxHp;
        p.isDrilling = false;
        p.targetBlock = null;
        if (this.audio) this.audio.emergencyTow();
        this.addFloatingText(msg, 0, 7, '#ff0055');
    }

    updateBoulders(dt) {
        // Fall down if air beneath
        for (let r = this.rows - 2; r >= 0; r--) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === 8 && this.grid[r + 1][c] === 0) {
                    this.grid[r][c] = 0;
                    this.grid[r + 1][c] = 8;

                    // Crush player check
                    const px = Math.floor(this.player.x / this.tileSize);
                    const py = Math.floor(this.player.y / this.tileSize);
                    if (px === c && py === r + 1) {
                        this.player.hp -= 40;
                        if (this.audio) this.audio.hullDamage();
                        if (this.player.hp <= 0) {
                            this.triggerEmergencyTow("CRUSHED BY ROCKFALL! (-$50)");
                        }
                    }
                }
            }
        }
    }

    spawnExhaustParticles() {
        const p = this.player;
        this.particles.push({
            x: this.offsetX + p.x + p.w / 2 + (Math.random() * 8 - 4),
            y: p.y + p.h,
            vx: (Math.random() - 0.5) * 40,
            vy: 60 + Math.random() * 40,
            color: '#00f0ff',
            life: 0.2,
            maxLife: 0.2
        });
    }

    spawnBlockParticles(r, c, color) {
        const bx = this.offsetX + c * this.tileSize + this.tileSize / 2;
        const by = r * this.tileSize + this.tileSize / 2;
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: bx,
                y: by,
                vx: (Math.random() - 0.5) * 120,
                vy: (Math.random() - 0.5) * 120,
                color,
                life: 0.35,
                maxLife: 0.35
            });
        }
    }

    addFloatingText(text, r, c, color = '#ffffff') {
        const x = this.offsetX + c * this.tileSize + this.tileSize / 2;
        const y = r * this.tileSize + this.tileSize / 2;
        this.floatingTexts.push({ text, x, y, color, life: 1.0, maxLife: 1.0 });
    }

    updateEffects(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 25 * dt;
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

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Backdrop
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(this.offsetX, -this.cameraY);

        // Render Surface Sky & Depot
        this.renderSurface(ctx);

        // Render Subterranean Grid Blocks
        this.renderGrid(ctx);

        // Render Player Nano-Drill Pod
        this.renderPlayer(ctx);

        // Particles
        for (const pt of this.particles) {
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x - this.offsetX, pt.y, 3 * (pt.life / pt.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Floating texts
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        for (const ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x - this.offsetX, ft.y);
        }

        ctx.restore();

        // Fixed HUD & Shop on surface
        this.renderHUD(ctx);

        // Overlays
        this.renderOverlays(ctx);
    }

    renderSurface(ctx) {
        // Surface sky
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, -60, this.worldWidth, 60);

        // Surface depots (Fuel station, Refinery, Workshop)
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(40, -45, 120, 45, 6);
        ctx.roundRect(240, -45, 140, 45, 6);
        ctx.roundRect(440, -45, 150, 45, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText("⛽ FUEL DEPOT", 55, -20);
        ctx.fillText("💰 ORE REFINERY", 255, -20);
        ctx.fillText("🛠️ TECH WORKSHOP", 455, -20);
    }

    renderGrid(ctx) {
        const startRow = Math.max(0, Math.floor(this.cameraY / this.tileSize));
        const endRow = Math.min(this.rows - 1, Math.ceil((this.cameraY + this.height) / this.tileSize));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = 0; c < this.cols; c++) {
                const type = this.grid[r][c];
                if (type === 0) continue;

                const x = c * this.tileSize;
                const y = r * this.tileSize;
                const def = this.blockTypes[type];

                ctx.fillStyle = def.color;
                ctx.strokeStyle = '#00000033';
                ctx.lineWidth = 1;
                ctx.fillRect(x, y, this.tileSize, this.tileSize);
                ctx.strokeRect(x, y, this.tileSize, this.tileSize);

                if (def.icon) {
                    ctx.font = '16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(def.icon, x + this.tileSize / 2, y + this.tileSize / 2);
                }
            }
        }
    }

    renderPlayer(ctx) {
        const p = this.player;
        ctx.save();
        ctx.translate(p.x, p.y);

        // Drill Pod Body
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(0, 0, p.w, p.h, 6);
        ctx.fill();
        ctx.stroke();

        // Cockpit visor
        ctx.fillStyle = '#0f172a';
        ctx.shadowBlur = 0;
        ctx.fillRect(4, 4, p.w - 8, 8);

        // Bottom Drill Bit
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.moveTo(p.w / 2 - 6, p.h);
        ctx.lineTo(p.w / 2 + 6, p.h);
        ctx.lineTo(p.w / 2, p.h + 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    renderHUD(ctx) {
        ctx.save();
        // Top HUD Bar
        ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(20, 16, this.width - 40, 52, 8);
        ctx.fill();
        ctx.stroke();

        // Credits
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`$${this.player.credits}`, 40, 48);

        // Fuel Gauge
        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('FUEL', 160, 34);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(160, 40, 120, 10);
        ctx.fillStyle = this.player.fuel < 20 ? '#ff0055' : '#00f0ff';
        ctx.fillRect(160, 40, 120 * (this.player.fuel / this.player.maxFuel), 10);

        // Hull Gauge
        ctx.fillStyle = '#8b949e';
        ctx.fillText('HULL', 300, 34);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(300, 40, 120, 10);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(300, 40, 120 * (this.player.hp / this.player.maxHp), 10);

        // Cargo Capacity
        ctx.fillStyle = '#8b949e';
        ctx.fillText(`CARGO (${this.player.cargo.length}/${this.player.maxCargo})`, 440, 34);
        const cargoIcons = this.player.cargo.map(c => c.icon).join(' ');
        ctx.font = '13px sans-serif';
        ctx.fillText(cargoIcons || 'Empty', 440, 52);

        // Depth Indicator
        const depthMeters = Math.max(0, Math.round((this.player.y / this.tileSize) * 10));
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`DEPTH: ${depthMeters}m`, 640, 48);

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
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("ANCIENT CORE EXTRACTED!", this.width / 2, this.height / 2 - 30);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            ctx.font = '18px sans-serif';
            ctx.fillText(`Final Wealth: $${this.player.credits}`, this.width / 2, this.height / 2 + 15);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Press SPACE to Drill Again', this.width / 2, this.height / 2 + 60);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MiningEngine };
}
