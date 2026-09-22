// Polyfill roundRect for maximum compatibility across browsers
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
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

class KartEngine {
    constructor(canvas, audio) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.audio = audio || null;

        this.width = canvas ? canvas.width : 800;
        this.height = canvas ? canvas.height : 600;

        // Track constants
        this.roadWidth = 2000;
        this.segmentLength = 200;
        this.rumbleLength = 3;
        this.cameraHeight = 1000;
        this.cameraDepth = 0.84;
        this.drawDistance = 240;

        // Player physics
        this.playerX = 0; // -1 (left edge) to 1 (right edge)
        this.playerZ = 0;
        this.speed = 0;
        this.maxSpeed = 12000;
        this.accel = 4000;
        this.breaking = -10000;
        this.decel = -2400;
        this.offRoadDecel = -6000;
        this.offRoadLimit = 3500;

        // Drifting system
        this.isDrifting = false;
        this.driftDirection = 0; // -1 left, 1 right
        this.driftCharge = 0;
        this.boostTimer = 0;
        this.boostStrength = 0;

        // Items
        this.currentItem = null; // 'nitro', 'emp', 'drone', 'shield'
        this.hasShield = false;
        this.spinOutTimer = 0;

        // Race progress
        this.currentLap = 1;
        this.totalLaps = 3;
        this.lapStartTime = 0;
        this.currentLapTime = 0;
        this.bestLapTime = null;
        this.raceFinished = false;
        this.raceStarted = false;
        this.countdown = 3;
        this.countdownTimer = 0;
        this.position = 1;

        // Controls
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            drift: false,
            item: false
        };

        // Particles & visual effects
        this.sparks = [];
        this.itemBoxes = [];
        this.trackObjects = [];

        this.segments = [];
        this.trackLength = 0;
        this.opponents = [];

        this.buildTrack();
        this.initOpponents();
    }

    buildTrack() {
        this.segments = [];
        const addSegment = (curve, y) => {
            const n = this.segments.length;
            this.segments.push({
                index: n,
                p1: { world: { x: 0, y: this.lastY || 0, z: n * this.segmentLength }, camera: {}, screen: {} },
                p2: { world: { x: 0, y: y, z: (n + 1) * this.segmentLength }, camera: {}, screen: {} },
                curve: curve,
                color: Math.floor(n / this.rumbleLength) % 2 ? {
                    road: '#0d1117',
                    grass: '#05070a',
                    rumble: '#00f0ff',
                    lane: '#00f0ff88'
                } : {
                    road: '#161b22',
                    grass: '#090d14',
                    rumble: '#ff007f',
                    lane: '#00000000'
                }
            });
            this.lastY = y;
        };

        const addRoad = (enter, hold, leave, curve, y) => {
            const startY = this.lastY || 0;
            const endY = startY + (y || 0) * this.segmentLength;
            const total = enter + hold + leave;
            for (let n = 0; n < enter; n++) {
                addSegment(this.easeIn(0, curve, n / enter), this.easeInOut(startY, endY, n / total));
            }
            for (let n = 0; n < hold; n++) {
                addSegment(curve, this.easeInOut(startY, endY, (enter + n) / total));
            }
            for (let n = 0; n < leave; n++) {
                addSegment(this.easeInOut(curve, 0, n / leave), this.easeInOut(startY, endY, (enter + hold + n) / total));
            }
        };

        this.lastY = 0;
        // Construct circuit: straight, gentle right, hill, hard left chicane, long straight, big neon curve
        addRoad(40, 60, 40, 0, 0);          // Start straight
        addRoad(30, 70, 30, 2.5, 10);       // Uphill right
        addRoad(30, 40, 30, 0, -10);        // Crest down
        addRoad(25, 50, 25, -3.2, 0);       // Sharp left
        addRoad(20, 30, 20, 2.8, 5);        // Chicane right
        addRoad(40, 80, 40, 0, -5);         // Fast back straight
        addRoad(35, 90, 35, -2.0, 0);       // Sweeping neon curve
        addRoad(20, 40, 20, 0, 0);          // Final straight to finish line

        this.trackLength = this.segments.length * this.segmentLength;

        // Place item boxes along the track
        this.itemBoxes = [
            { z: 12000, x: -0.4, active: true },
            { z: 12000, x: 0, active: true },
            { z: 12000, x: 0.4, active: true },
            { z: 35000, x: -0.3, active: true },
            { z: 35000, x: 0.3, active: true },
            { z: 62000, x: -0.4, active: true },
            { z: 62000, x: 0, active: true },
            { z: 62000, x: 0.4, active: true }
        ];

        // Trackside neon scenery markers
        this.trackObjects = [];
        for (let i = 0; i < this.segments.length; i += 8) {
            const side = (i % 16 === 0) ? -1.6 : 1.6;
            this.trackObjects.push({
                z: i * this.segmentLength,
                x: side,
                type: (i % 32 === 0) ? 'billboard' : 'pillar'
            });
        }
    }

    easeIn(a, b, percent) {
        return a + (b - a) * Math.pow(percent, 2);
    }

    easeInOut(a, b, percent) {
        return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
    }

    initOpponents() {
        this.opponents = [
            { name: "Viper-9", color: "#ff0055", z: 1800, x: -0.4, speed: 10400, targetX: -0.4, lap: 1 },
            { name: "Apex-X", color: "#00f0ff", z: 1400, x: 0.4, speed: 10800, targetX: 0.4, lap: 1 },
            { name: "Glitch-Z", color: "#a855f7", z: 1000, x: -0.2, speed: 10200, targetX: -0.2, lap: 1 },
            { name: "Nova-01", color: "#39ff14", z: 600, x: 0.2, speed: 10600, targetX: 0.2, lap: 1 },
            { name: "Phantom", color: "#ffe600", z: 200, x: -0.6, speed: 10000, targetX: -0.6, lap: 1 }
        ];
    }

    findSegment(z) {
        return this.segments[Math.floor(z / this.segmentLength) % this.segments.length];
    }

    startRace() {
        if (this.audio) {
            this.audio.init();
            this.audio.startEngine();
            this.audio.countdown(false);
        }
        this.countdown = 3;
        this.countdownTimer = 1.0;
        this.raceStarted = false;
        this.raceFinished = false;
        this.currentLap = 1;
        this.lapStartTime = Date.now();
    }

    update(dt) {
        if (!dt) return;

        // Countdown sequence
        if (this.countdown > 0) {
            this.countdownTimer -= dt;
            if (this.countdownTimer <= 0) {
                this.countdown--;
                if (this.countdown > 0) {
                    if (this.audio) this.audio.countdown(false);
                    this.countdownTimer = 1.0;
                } else {
                    if (this.audio) this.audio.countdown(true);
                    this.raceStarted = true;
                    this.lapStartTime = Date.now();
                }
            }
        }

        if (!this.raceStarted && !this.raceFinished) return;

        // Boost and spin timers
        if (this.boostTimer > 0) {
            this.boostTimer -= dt;
            if (this.boostTimer <= 0) this.boostStrength = 0;
        }

        if (this.spinOutTimer > 0) {
            this.spinOutTimer -= dt;
            this.speed = Math.max(0, this.speed - 8000 * dt);
        }

        // Drifting mechanics
        const isTurning = this.keys.left || this.keys.right;
        if (this.keys.drift && isTurning && this.speed > 3000 && this.spinOutTimer <= 0) {
            if (!this.isDrifting) {
                this.isDrifting = true;
                this.driftDirection = this.keys.left ? -1 : 1;
                this.driftCharge = 0;
            }
            this.driftCharge += dt * 60; // frame units
            if (this.audio && Math.random() < 0.25) this.audio.driftScreech();

            // Emit sparks
            this.addDriftSparks();
        } else {
            if (this.isDrifting) {
                // Drift release - calculate mini-turbo boost!
                this.releaseDriftBoost();
                this.isDrifting = false;
                this.driftCharge = 0;
            }
        }

        // Player Acceleration / Braking
        const effectiveMax = this.maxSpeed + this.boostStrength;
        if (this.spinOutTimer <= 0) {
            if (this.keys.up) {
                this.speed += this.accel * dt;
            } else if (this.keys.down) {
                this.speed += this.breaking * dt;
            } else {
                this.speed += this.decel * dt;
            }
        }

        // Offroad drag
        const isOffroad = (this.playerX < -1.0 || this.playerX > 1.0);
        if (isOffroad) {
            if (this.speed > this.offRoadLimit) {
                this.speed += this.offRoadDecel * dt;
            }
        }

        this.speed = Math.max(0, Math.min(this.speed, isOffroad && this.speed > this.offRoadLimit ? this.speed : effectiveMax));

        // Steering
        const speedRatio = this.speed / this.maxSpeed;
        const steerSpeed = 2.4 * dt * speedRatio;
        if (this.spinOutTimer <= 0) {
            if (this.keys.left) {
                this.playerX -= steerSpeed * (this.isDrifting && this.driftDirection === 1 ? 0.4 : 1.0);
            }
            if (this.keys.right) {
                this.playerX += steerSpeed * (this.isDrifting && this.driftDirection === -1 ? 0.4 : 1.0);
            }
        }

        // Centrifugal force from curves
        const currentSegment = this.findSegment(this.playerZ);
        if (currentSegment) {
            this.playerX -= (currentSegment.curve * speedRatio * speedRatio * 1.5 * dt);
        }

        // Advance player position
        const oldZ = this.playerZ;
        this.playerZ += this.speed * dt;

        // Lap progression
        if (this.playerZ >= this.trackLength) {
            this.playerZ -= this.trackLength;
            const lapTime = (Date.now() - this.lapStartTime) / 1000;
            if (!this.bestLapTime || lapTime < this.bestLapTime) {
                this.bestLapTime = lapTime;
            }
            this.currentLap++;
            this.lapStartTime = Date.now();

            if (this.currentLap > this.totalLaps) {
                this.currentLap = this.totalLaps;
                this.raceFinished = true;
                if (this.audio) this.audio.victory();
            }
        }
        this.currentLapTime = (Date.now() - this.lapStartTime) / 1000;

        // Update sound engine
        if (this.audio) {
            this.audio.updateEngine(this.speed / this.maxSpeed);
        }

        // Item Box collection
        this.checkItemBoxes();

        // Update Opponents
        this.updateOpponents(dt);

        // Update Position ranking
        this.calculatePosition();

        // Update sparks
        this.updateSparks(dt);
    }

    addDriftSparks() {
        const tier = this.getDriftTier();
        if (tier === 0) return;
        const color = tier === 1 ? '#00f0ff' : tier === 2 ? '#ffaa00' : '#d946ef';
        for (let i = 0; i < 2; i++) {
            this.sparks.push({
                x: (this.driftDirection > 0 ? -15 : 15) + (Math.random() * 10 - 5),
                y: 10 + (Math.random() * 6),
                vx: (Math.random() * 60 - 30) * this.driftDirection,
                vy: -Math.random() * 50 - 20,
                color: color,
                life: 0.25,
                maxLife: 0.25
            });
        }
    }

    getDriftTier() {
        if (this.driftCharge >= 160) return 3; // Ultra Purple
        if (this.driftCharge >= 100) return 2; // Super Orange
        if (this.driftCharge >= 50) return 1;  // Mini Blue
        return 0;
    }

    releaseDriftBoost() {
        const tier = this.getDriftTier();
        if (tier === 1) {
            this.boostStrength = 2200;
            this.boostTimer = 1.0;
            if (this.audio) this.audio.boost(1);
        } else if (tier === 2) {
            this.boostStrength = 4200;
            this.boostTimer = 1.8;
            if (this.audio) this.audio.boost(2);
        } else if (tier === 3) {
            this.boostStrength = 7500;
            this.boostTimer = 2.8;
            if (this.audio) this.audio.boost(3);
        }
    }

    checkItemBoxes() {
        const playerZNorm = this.playerZ;
        for (const box of this.itemBoxes) {
            if (box.active && Math.abs(box.z - playerZNorm) < 400 && Math.abs(box.x - this.playerX) < 0.4) {
                box.active = false;
                if (this.audio) this.audio.itemPickup();
                const items = ['nitro', 'emp', 'drone', 'shield'];
                this.currentItem = items[Math.floor(Math.random() * items.length)];
                setTimeout(() => { box.active = true; }, 8000);
            }
        }
    }

    useItem() {
        if (!this.currentItem) return;
        const item = this.currentItem;
        this.currentItem = null;
        if (this.audio) this.audio.useItem(item);

        if (item === 'nitro') {
            this.boostStrength = 6000;
            this.boostTimer = 3.0;
        } else if (item === 'shield') {
            this.hasShield = true;
            setTimeout(() => { this.hasShield = false; }, 8000);
        } else if (item === 'emp') {
            // Spin out any opponent within 4000 units
            this.opponents.forEach(op => {
                if (Math.abs(op.z - this.playerZ) < 5000) {
                    op.speed = 1000;
                }
            });
        } else if (item === 'drone') {
            // Target the opponent ahead of player
            let ahead = null;
            let minDist = Infinity;
            this.opponents.forEach(op => {
                const dist = (op.z - this.playerZ + this.trackLength) % this.trackLength;
                if (dist > 200 && dist < minDist) {
                    minDist = dist;
                    ahead = op;
                }
            });
            if (ahead) {
                ahead.speed = 500;
            }
        }
    }

    updateOpponents(dt) {
        this.opponents.forEach(op => {
            // Move along track
            op.z += op.speed * dt;
            if (op.z >= this.trackLength) {
                op.z -= this.trackLength;
                op.lap++;
            }

            // Natural AI steering and speed variation
            const seg = this.findSegment(op.z);
            if (seg) {
                op.targetX = -seg.curve * 0.3 + (Math.sin(op.z * 0.005) * 0.4);
            }
            op.x += (op.targetX - op.x) * 1.5 * dt;

            // Player collision check
            const distZ = Math.abs(op.z - this.playerZ);
            const distX = Math.abs(op.x - this.playerX);
            if (distZ < 250 && distX < 0.28) {
                if (this.hasShield) {
                    op.speed = 2000;
                } else {
                    this.speed = Math.max(2000, this.speed - 3000);
                    if (this.audio) this.audio.crash();
                    this.playerX += (this.playerX > op.x ? 0.15 : -0.15);
                }
            }
        });
    }

    calculatePosition() {
        const playerScore = this.currentLap * this.trackLength + this.playerZ;
        let pos = 1;
        this.opponents.forEach(op => {
            const opScore = op.lap * this.trackLength + op.z;
            if (opScore > playerScore) {
                pos++;
            }
        });
        this.position = pos;
    }

    updateSparks(dt) {
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const p = this.sparks[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.sparks.splice(i, 1);
            }
        }
    }

    project(p, cameraX, cameraY, cameraZ) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        const scale = this.cameraDepth / Math.max(1, p.camera.z);
        p.screen.scale = scale;
        p.screen.x = Math.round((this.width / 2) + (scale * p.camera.x * this.width / 2));
        p.screen.y = Math.round((this.height / 2) - (scale * p.camera.y * this.height / 2));
        p.screen.w = Math.round(scale * this.roadWidth * this.width / 2);
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Synthwave Sky & Horizon Grid
        this.renderSky(ctx);

        // 2. Render 3D Road Segments
        const baseSegment = this.findSegment(this.playerZ);
        if (!baseSegment) return;
        const basePercent = (this.playerZ % this.segmentLength) / this.segmentLength;
        let cameraX = this.playerX * this.roadWidth;
        let cameraY = this.cameraHeight + (baseSegment.p1.world.y + (baseSegment.p2.world.y - baseSegment.p1.world.y) * basePercent);

        let maxy = this.height;
        let x = 0;
        let dx = -(baseSegment.curve * basePercent);

        for (let n = 0; n < this.drawDistance; n++) {
            const segment = this.segments[(baseSegment.index + n) % this.segments.length];
            const looped = segment.index < baseSegment.index;
            const camZ = this.playerZ - (looped ? this.trackLength : 0);

            this.project(segment.p1, cameraX - x, cameraY, camZ);
            this.project(segment.p2, cameraX - x - dx, cameraY, camZ);

            x += dx;
            dx += segment.curve;

            if (segment.p1.camera.z <= this.cameraDepth || segment.p2.screen.y >= maxy) {
                continue;
            }

            // Draw road strip
            this.renderSegment(ctx, segment);
            maxy = segment.p2.screen.y;
        }

        // 3. Render Item Boxes & Trackside scenery in reverse order (back to front)
        this.renderTrackObjects(ctx, baseSegment.index, cameraX, cameraY);

        // 4. Render Opponents
        this.renderOpponents(ctx, cameraX, cameraY);

        // 5. Render Player Cyber Kart
        this.renderPlayerKart(ctx);

        // 6. Render HUD (Position, Speedometer, Lap, Drift Gauge, Minimap, Items)
        this.renderHUD(ctx);

        // 7. Render Countdown / Finish Overlay
        this.renderOverlays(ctx);
    }

    renderSky(ctx) {
        // Gradient sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height * 0.55);
        skyGrad.addColorStop(0, '#090514');
        skyGrad.addColorStop(0.6, '#180e2b');
        skyGrad.addColorStop(1, '#ff007f33');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, this.height * 0.55);

        // Cyber Sun
        ctx.save();
        const sunY = this.height * 0.38;
        const sunRad = 55;
        const sunGrad = ctx.createLinearGradient(0, sunY - sunRad, 0, sunY + sunRad);
        sunGrad.addColorStop(0, '#ffe600');
        sunGrad.addColorStop(0.7, '#ff007f');
        sunGrad.addColorStop(1, '#7928ca');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(this.width * 0.5, sunY, sunRad, 0, Math.PI * 2);
        ctx.fill();

        // Horizontal sun scanlines
        ctx.fillStyle = '#180e2b';
        for (let i = 0; i < 7; i++) {
            ctx.fillRect(this.width * 0.5 - sunRad, sunY + i * 8, sunRad * 2, 2 + i * 0.8);
        }
        ctx.restore();
    }

    renderSegment(ctx, seg) {
        const p1 = seg.p1.screen;
        const p2 = seg.p2.screen;

        // Grass / Offroad
        ctx.fillStyle = seg.color.grass;
        ctx.fillRect(0, p2.y, this.width, p1.y - p2.y);

        // Rumble Strip
        const r1 = p1.w * 1.15;
        const r2 = p2.w * 1.15;
        ctx.fillStyle = seg.color.rumble;
        ctx.beginPath();
        ctx.moveTo(p1.x - r1, p1.y);
        ctx.lineTo(p1.x - p1.w, p1.y);
        ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.lineTo(p2.x - r2, p2.y);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p1.x + r1, p1.y);
        ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y);
        ctx.lineTo(p2.x + r2, p2.y);
        ctx.fill();

        // Asphalt Road
        ctx.fillStyle = seg.color.road;
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w, p1.y);
        ctx.lineTo(p1.x + p1.w, p1.y);
        ctx.lineTo(p2.x + p2.w, p2.y);
        ctx.lineTo(p2.x - p2.w, p2.y);
        ctx.fill();

        // Glowing Center Dash
        if (seg.color.lane) {
            const lane1 = p1.w * 0.04;
            const lane2 = p2.w * 0.04;
            ctx.fillStyle = seg.color.lane;
            ctx.beginPath();
            ctx.moveTo(p1.x - lane1, p1.y);
            ctx.lineTo(p1.x + lane1, p1.y);
            ctx.lineTo(p2.x + lane2, p2.y);
            ctx.lineTo(p2.x - lane2, p2.y);
            ctx.fill();
        }
    }

    renderTrackObjects(ctx, baseIndex, cameraX, cameraY) {
        // Draw item boxes
        for (const box of this.itemBoxes) {
            if (!box.active) continue;
            let relZ = box.z - this.playerZ;
            if (relZ < 0) relZ += this.trackLength;
            if (relZ > 0 && relZ < this.drawDistance * this.segmentLength) {
                const seg = this.findSegment(box.z);
                const scale = this.cameraDepth / relZ;
                const sx = Math.round((this.width / 2) + (scale * (box.x * this.roadWidth - cameraX) * this.width / 2));
                const sy = Math.round((this.height / 2) - (scale * (seg.p1.world.y - cameraY) * this.height / 2));
                const size = Math.max(6, 40 * scale * (this.width / 400));

                ctx.save();
                ctx.translate(sx, sy - size);
                ctx.fillStyle = '#00f0ffaa';
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 12;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.rect(-size / 2, -size / 2, size, size);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(size * 0.7)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', 0, 0);
                ctx.restore();
            }
        }

        // Draw trackside light pillars / signs
        for (const obj of this.trackObjects) {
            let relZ = obj.z - this.playerZ;
            if (relZ < 0) relZ += this.trackLength;
            if (relZ > 200 && relZ < this.drawDistance * this.segmentLength) {
                const scale = this.cameraDepth / relZ;
                const sx = Math.round((this.width / 2) + (scale * (obj.x * this.roadWidth - cameraX) * this.width / 2));
                const sy = Math.round((this.height / 2) - (scale * -cameraY) * this.height / 2);
                const h = Math.max(10, 160 * scale * (this.height / 400));
                const w = Math.max(4, 18 * scale * (this.width / 400));

                ctx.save();
                ctx.fillStyle = obj.x < 0 ? '#ff007f' : '#00f0ff';
                ctx.shadowColor = obj.x < 0 ? '#ff007f' : '#00f0ff';
                ctx.shadowBlur = 8;
                ctx.fillRect(sx - w / 2, sy - h, w, h);
                ctx.restore();
            }
        }
    }

    renderOpponents(ctx, cameraX, cameraY) {
        this.opponents.forEach(op => {
            let relZ = op.z - this.playerZ;
            if (relZ < -this.trackLength / 2) relZ += this.trackLength;
            if (relZ > this.trackLength / 2) relZ -= this.trackLength;

            if (relZ > 100 && relZ < this.drawDistance * this.segmentLength) {
                const scale = this.cameraDepth / relZ;
                const sx = Math.round((this.width / 2) + (scale * (op.x * this.roadWidth - cameraX) * this.width / 2));
                const sy = Math.round((this.height / 2) - (scale * -cameraY) * this.height / 2);
                const kw = Math.max(12, 110 * scale * (this.width / 400));
                const kh = Math.max(8, 65 * scale * (this.height / 400));

                ctx.save();
                ctx.translate(sx, sy);
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(0, 0, kw * 0.6, kh * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();

                // Rival Kart Chassis
                ctx.fillStyle = op.color;
                ctx.shadowColor = op.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.roundRect(-kw / 2, -kh, kw, kh * 0.8, 6);
                ctx.fill();

                // Spoiler & tires
                ctx.fillStyle = '#111827';
                ctx.fillRect(-kw * 0.55, -kh * 0.6, kw * 0.15, kh * 0.5);
                ctx.fillRect(kw * 0.4, -kh * 0.6, kw * 0.15, kh * 0.5);

                // Driver Tag
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(9, Math.round(14 * scale * 2))}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(op.name, 0, -kh - 4);
                ctx.restore();
            }
        });
    }

    renderPlayerKart(ctx) {
        ctx.save();
        const kx = this.width / 2;
        const ky = this.height - 40;
        const kw = 120;
        const kh = 65;

        // Lean angle during turn / drift
        let lean = 0;
        if (this.keys.left) lean = -0.15;
        if (this.keys.right) lean = 0.15;
        if (this.isDrifting) lean = this.driftDirection * 0.25;

        ctx.translate(kx, ky);
        ctx.rotate(lean);

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(0, 5, kw * 0.6, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Underglow neon
        ctx.fillStyle = this.boostStrength > 0 ? '#ff007f' : '#00f0ff';
        ctx.shadowColor = this.boostStrength > 0 ? '#ff007f' : '#00f0ff';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.ellipse(0, 2, kw * 0.5, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#111827';
        ctx.shadowBlur = 0;
        ctx.fillRect(-kw * 0.58, -kh * 0.55, 20, 38);
        ctx.fillRect(kw * 0.58 - 20, -kh * 0.55, 20, 38);

        // Main Cyber Kart Body (Aerodynamic angled polygon)
        const kartGrad = ctx.createLinearGradient(0, -kh, 0, 0);
        kartGrad.addColorStop(0, '#00f0ff');
        kartGrad.addColorStop(0.5, '#0083b0');
        kartGrad.addColorStop(1, '#001a2e');
        ctx.fillStyle = kartGrad;
        ctx.beginPath();
        ctx.moveTo(-kw * 0.35, -kh);
        ctx.lineTo(kw * 0.35, -kh);
        ctx.lineTo(kw * 0.48, -12);
        ctx.lineTo(-kw * 0.48, -12);
        ctx.closePath();
        ctx.fill();

        // Cockpit canopy
        ctx.fillStyle = '#05070a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -kh * 0.55, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Dual Neon Jet Exhausts
        const exhaustPulse = 10 + Math.random() * 8 + (this.boostStrength > 0 ? 25 : 0);
        ctx.fillStyle = this.boostStrength > 0 ? '#ff007f' : '#00f0ff';
        ctx.shadowColor = this.boostStrength > 0 ? '#ff007f' : '#00f0ff';
        ctx.shadowBlur = 18;
        ctx.fillRect(-kw * 0.25, -12, 14, exhaustPulse);
        ctx.fillRect(kw * 0.25 - 14, -12, 14, exhaustPulse);

        // Drift Sparks
        for (const s of this.sparks) {
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4 * (s.life / s.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }

        // Energy Shield bubble if active
        if (this.hasShield) {
            ctx.strokeStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 20;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, -kh * 0.5, kw * 0.65, kh * 0.8, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderHUD(ctx) {
        ctx.save();

        // 1. Position indicator (Top Left)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(16, 16, 120, 68, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.fillText('POSITION', 28, 34);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 32px sans-serif';
        const suffixes = ['ST', 'ND', 'RD', 'TH', 'TH', 'TH'];
        ctx.fillText(`${this.position}`, 28, 68);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(suffixes[this.position - 1] || 'TH', 56, 52);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#8b949e';
        ctx.fillText('/ 6', 82, 68);

        // 2. Lap & Timer (Top Center)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.beginPath();
        ctx.roundRect(this.width / 2 - 90, 16, 180, 54, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff007f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`LAP ${this.currentLap} / ${this.totalLaps}`, this.width / 2, 34);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`TIME ${this.currentLapTime.toFixed(2)}s`, this.width / 2, 56);

        // 3. Speedometer & Drift Charge Bar (Bottom Right)
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.textAlign = 'left';
        ctx.beginPath();
        ctx.roundRect(this.width - 160, this.height - 80, 144, 64, 8);
        ctx.fill();
        ctx.stroke();

        const kmh = Math.round((this.speed / this.maxSpeed) * 260);
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`${kmh}`, this.width - 146, this.height - 48);
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px sans-serif';
        ctx.fillText('KM/H', this.width - 60, this.height - 48);

        // Drift Charge bar
        const driftPct = Math.min(1, this.driftCharge / 180);
        const tier = this.getDriftTier();
        const barColor = tier === 1 ? '#00f0ff' : tier === 2 ? '#ffaa00' : tier === 3 ? '#d946ef' : '#334155';
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.width - 146, this.height - 34, 116, 8);
        ctx.fillStyle = barColor;
        ctx.fillRect(this.width - 146, this.height - 34, 116 * driftPct, 8);

        // 4. Current Item Box (Top Right)
        if (this.currentItem) {
            ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
            ctx.beginPath();
            ctx.roundRect(this.width - 80, 16, 64, 64, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffe600';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.currentItem.toUpperCase(), this.width - 48, 54);
        }

        ctx.restore();
    }

    renderOverlays(ctx) {
        if (this.countdown > 0) {
            ctx.save();
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 30;
            ctx.font = 'bold 72px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.countdown}`, this.width / 2, this.height / 2);
            ctx.restore();
        } else if (this.countdown === 0 && this.countdownTimer > -0.6) {
            ctx.save();
            ctx.fillStyle = '#39ff14';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 35;
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GO!', this.width / 2, this.height / 2);
            ctx.restore();
        }

        if (this.raceFinished) {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 7, 10, 0.88)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.fillStyle = this.position === 1 ? '#ffe600' : '#00f0ff';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 25;
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.position === 1 ? 'VICTORY!' : 'RACE FINISHED', this.width / 2, this.height / 2 - 50);

            ctx.fillStyle = '#ffffff';
            ctx.font = '20px sans-serif';
            ctx.shadowBlur = 0;
            ctx.fillText(`Final Position: ${this.position} of 6`, this.width / 2, this.height / 2 + 5);
            ctx.fillText(`Best Lap: ${this.bestLapTime ? this.bestLapTime.toFixed(2) + 's' : '--'}`, this.width / 2, this.height / 2 + 35);

            ctx.fillStyle = '#8b949e';
            ctx.font = '14px sans-serif';
            ctx.fillText('Tap or press SPACE to Race Again', this.width / 2, this.height / 2 + 80);
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KartEngine };
}
