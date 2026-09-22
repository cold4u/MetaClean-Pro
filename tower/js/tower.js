/**
 * Matrix Defense: Core Command — Arcade Engine
 * Strategic path-building Tower Defense with 5 tower classes, 3 upgrade tiers, and wave boss scaling.
 */

if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    if (!radii) radii = 0;
    if (typeof radii === "number") radii = [radii, radii, radii, radii];
    const r = radii[0] || 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y + x, y, r);
    this.closePath();
    return this;
  };
}

class TowerGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 600;
    this.height = canvas ? canvas.height : 450;
    this.audio = audio || {
      init: () => {},
      playBuild: () => {},
      playLaser: () => {},
      playRocket: () => {},
      playWaveStart: () => {}
    };

    this.state = "START"; // START, PLAYING, WAVE_PAUSE, GAMEOVER, VICTORY
    this.credits = 350;
    this.coreHP = 20;
    this.maxCoreHP = 20;
    this.wave = 1;
    this.maxWave = 15;
    this.score = 0;

    // Waypoints for circuit track
    this.waypoints = [
      { x: 0, y: 100 },
      { x: 180, y: 100 },
      { x: 180, y: 320 },
      { x: 380, y: 320 },
      { x: 380, y: 140 },
      { x: 540, y: 140 },
      { x: 540, y: 400 },
      { x: 600, y: 400 }
    ];

    // Turret Sockets
    this.sockets = [
      { id: 0, x: 90, y: 50, tower: null },
      { id: 1, x: 120, y: 170, tower: null },
      { id: 2, x: 240, y: 180, tower: null },
      { id: 3, x: 240, y: 260, tower: null },
      { id: 4, x: 320, y: 380, tower: null },
      { id: 5, x: 320, y: 220, tower: null },
      { id: 6, x: 440, y: 80, tower: null },
      { id: 7, x: 440, y: 240, tower: null },
      { id: 8, x: 480, y: 340, tower: null },
      { id: 9, x: 80, y: 380, tower: null }
    ];

    this.selectedSocket = null;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.spawningQueue = [];
    this.spawnTimer = 0;
  }

  start() {
    this.audio.init();
    this.credits = 350;
    this.coreHP = 20;
    this.wave = 1;
    this.score = 0;
    this.sockets.forEach(s => s.tower = null);
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.startWave(1);
    this.state = "PLAYING";
  }

  buildTower(socketId, type) {
    const socket = this.sockets.find(s => s.id === socketId);
    if (!socket || socket.tower) return false;

    const costs = { pulse: 100, laser: 150, tesla: 200, rocket: 250, miner: 180 };
    const cost = costs[type] || 100;
    if (this.credits < cost) return false;

    this.credits -= cost;
    this.audio.playBuild();

    socket.tower = {
      type,
      level: 1,
      range: type === "laser" ? 120 : type === "rocket" ? 160 : type === "tesla" ? 95 : type === "miner" ? 0 : 110,
      dmg: type === "rocket" ? 75 : type === "laser" ? 30 : type === "tesla" ? 40 : type === "miner" ? 0 : 18,
      interval: type === "pulse" ? 280 : type === "rocket" ? 1400 : type === "tesla" ? 1100 : type === "miner" ? 8000 : 100,
      timer: 0,
      kills: 0
    };
    return true;
  }

  upgradeTower(socketId) {
    const socket = this.sockets.find(s => s.id === socketId);
    if (!socket || !socket.tower || socket.tower.level >= 3) return false;

    const upCost = socket.tower.level === 1 ? 80 : 140;
    if (this.credits < upCost) return false;

    this.credits -= upCost;
    socket.tower.level++;
    socket.tower.dmg = Math.floor(socket.tower.dmg * 1.45);
    socket.tower.range += 15;
    socket.tower.interval = Math.max(80, Math.floor(socket.tower.interval * 0.85));
    this.audio.playBuild();
    return true;
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.spawningQueue = [];
    this.spawnTimer = 0;
    this.audio.playWaveStart();

    const count = 8 + waveNum * 3;
    const isBossWave = (waveNum % 5 === 0);

    for (let i = 0; i < count; i++) {
      const isTank = Math.random() < 0.25;
      const isFast = Math.random() < 0.3;
      this.spawningQueue.push({
        hp: (isTank ? 90 : isFast ? 25 : 45) + waveNum * 12,
        speed: (isFast ? 105 : isTank ? 45 : 70),
        reward: isTank ? 25 : 12,
        color: isTank ? "#ff0077" : isFast ? "#ffd700" : "#00f0ff",
        radius: isTank ? 12 : isFast ? 7 : 9
      });
    }

    if (isBossWave) {
      this.spawningQueue.push({
        hp: 350 + waveNum * 60,
        speed: 38,
        reward: 120,
        color: "#ff0055",
        radius: 18,
        isBoss: true
      });
    }
  }

  createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        life: 1,
        decay: 0.04,
        size: 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;

    // Spawner
    if (this.spawningQueue.length > 0) {
      this.spawnTimer += deltaMs;
      if (this.spawnTimer >= 750) {
        this.spawnTimer = 0;
        const eData = this.spawningQueue.shift();
        this.enemies.push({
          x: this.waypoints[0].x,
          y: this.waypoints[0].y,
          wpIdx: 0,
          hp: eData.hp,
          maxHp: eData.hp,
          speed: eData.speed,
          reward: eData.reward,
          color: eData.color,
          radius: eData.radius,
          isBoss: eData.isBoss || false
        });
      }
    }

    // Update Towers
    this.sockets.forEach(s => {
      const t = s.tower;
      if (!t) return;

      t.timer += deltaMs;

      // Miner tower creates passive credits
      if (t.type === "miner") {
        if (t.timer >= t.interval) {
          t.timer = 0;
          this.credits += 25 * t.level;
          this.createExplosion(s.x, s.y, "#ffd700", 6);
        }
        return;
      }

      // Find targets in range
      const inRange = this.enemies.filter(e => Math.hypot(e.x - s.x, e.y - s.y) <= t.range);
      if (inRange.length === 0) return;

      if (t.timer >= t.interval) {
        t.timer = 0;

        if (t.type === "pulse" || t.type === "laser") {
          const target = inRange[0];
          target.hp -= t.dmg;
          this.projectiles.push({
            x1: s.x, y1: s.y, x2: target.x, y2: target.y,
            color: t.type === "laser" ? "#ff0077" : "#00f0ff", life: 0.1
          });
          this.audio.playLaser();
        } else if (t.type === "tesla") {
          const targets = inRange.slice(0, 3);
          targets.forEach(tgt => {
            tgt.hp -= t.dmg;
            tgt.speed *= 0.6; // slow
            this.projectiles.push({
              x1: s.x, y1: s.y, x2: tgt.x, y2: tgt.y,
              color: "#00ffcc", life: 0.15
            });
          });
        } else if (t.type === "rocket") {
          const target = inRange[0];
          this.audio.playRocket();
          // AoE Splash
          this.enemies.forEach(e => {
            if (Math.hypot(e.x - target.x, e.y - target.y) <= 45) {
              e.hp -= t.dmg;
            }
          });
          this.createExplosion(target.x, target.y, "#ffaa00", 16);
        }
      }
    });

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.hp <= 0) {
        this.credits += e.reward;
        this.score += e.reward * 10;
        this.createExplosion(e.x, e.y, e.color, e.isBoss ? 25 : 10);
        this.enemies.splice(i, 1);
        continue;
      }

      // Move along waypoints
      const targetWp = this.waypoints[e.wpIdx + 1];
      if (targetWp) {
        const dx = targetWp.x - e.x;
        const dy = targetWp.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 4) {
          e.wpIdx++;
          if (e.wpIdx >= this.waypoints.length - 1) {
            // Reached Core!
            this.coreHP -= e.isBoss ? 5 : 1;
            this.createExplosion(e.x, e.y, "#ff0055", 15);
            this.enemies.splice(i, 1);

            if (this.coreHP <= 0) {
              this.state = "GAMEOVER";
              if (typeof this.onGameOver === "function") this.onGameOver(this.score);
              return;
            }
            continue;
          }
        } else {
          e.x += (dx / dist) * e.speed * deltaSec;
          e.y += (dy / dist) * e.speed * deltaSec;
        }
      }
    }

    // Check wave complete
    if (this.spawningQueue.length === 0 && this.enemies.length === 0) {
      if (this.wave >= this.maxWave) {
        this.state = "VICTORY";
        if (typeof this.onVictory === "function") this.onVictory(this.score);
      } else {
        this.startWave(this.wave + 1);
      }
    }

    // Projectile beams life
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].life -= deltaSec;
      if (this.projectiles[i].life <= 0) this.projectiles.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) this.particles.splice(i, 1);
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background Matrix
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    // Render Track Path
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    ctx.stroke();

    // Inner rail stripe
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Sockets
    this.sockets.forEach(s => {
      ctx.save();
      const isSelected = (this.selectedSocket === s.id);
      ctx.fillStyle = isSelected ? "rgba(0, 240, 255, 0.3)" : "#1e293b";
      ctx.strokeStyle = isSelected ? "#00f0ff" : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Tower if built
      if (s.tower) {
        const colors = { pulse: "#00f0ff", laser: "#ff0077", tesla: "#00ffcc", rocket: "#ffaa00", miner: "#ffd700" };
        ctx.fillStyle = colors[s.tower.type] || "#fff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
        ctx.fill();

        // Level stars
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`L${s.tower.level}`, s.x, s.y + 3);

        // Range circle if selected
        if (isSelected) {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.tower.range, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Projectile Beams
    this.projectiles.forEach(p => {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.restore();
    });

    // Enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Health bar
      ctx.fillStyle = "#334155";
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 6, e.radius * 2, 3);
      ctx.fillStyle = "#00ff66";
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 6, (e.hp / e.maxHp) * (e.radius * 2), 3);
      ctx.restore();
    });

    // Particles
    this.particles.forEach(part => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, part.life);
      ctx.fillStyle = part.color;
      ctx.shadowColor = part.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TowerGame };
}
