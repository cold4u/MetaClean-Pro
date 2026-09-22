/**
 * Neon Defense: Mainframe Turret — Arcade Engine
 * 360-degree radial turret defender with particle sparks, EMP shockwaves, and multi-tier viral swarms.
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

class DefenseGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 500;
    this.height = canvas ? canvas.height : 500;
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.coreRadius = 24;

    this.audio = audio || {
      init: () => {},
      playLaser: () => {},
      playExplosion: () => {},
      playEMP: () => {},
      playPowerup: () => {},
      playCoreHit: () => {}
    };

    // States
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.coreHP = 100;
    this.empCount = 2;

    // Turret & Fire
    this.turretAngle = -Math.PI / 2;
    this.isFiring = false;
    this.fireTimer = 0;
    this.fireInterval = 140; // ms
    this.tripleSpreadTimer = 0;

    // Spawner
    this.spawnTimer = 0;
    this.spawnInterval = 1100; // ms

    // Entities
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.empShockwaves = [];

    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("neon_defense_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("neon_defense_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  reset() {
    this.score = 0;
    this.coreHP = 100;
    this.empCount = 2;
    this.turretAngle = -Math.PI / 2;
    this.isFiring = false;
    this.fireTimer = 0;
    this.tripleSpreadTimer = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1100;

    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.empShockwaves = [];
  }

  aimAt(screenX, screenY) {
    this.turretAngle = Math.atan2(screenY - this.cy, screenX - this.cx);
  }

  fireBolt(angle) {
    const speed = 560;
    const spawnDist = this.coreRadius + 12;
    const bx = this.cx + Math.cos(angle) * spawnDist;
    const by = this.cy + Math.sin(angle) * spawnDist;

    this.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 4,
      life: 1.4
    });
  }

  triggerFire() {
    if (this.tripleSpreadTimer > 0) {
      this.fireBolt(this.turretAngle - 0.2);
      this.fireBolt(this.turretAngle);
      this.fireBolt(this.turretAngle + 0.2);
    } else {
      this.fireBolt(this.turretAngle);
    }
    this.audio.playLaser();
  }

  triggerEMP() {
    if (this.state !== "PLAYING" || this.empCount <= 0) return false;
    this.empCount--;
    this.audio.playEMP();

    this.empShockwaves.push({
      radius: 20,
      maxRadius: 360,
      alpha: 1.0
    });

    // Destroy all enemies
    const enemyCount = this.enemies.length;
    this.enemies.forEach(e => {
      this.createExplosion(e.x, e.y, "#ff0077", 14);
      this.score += e.pts;
    });
    this.enemies = [];

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    return true;
  }

  spawnEnemy() {
    // Spawn on random angle beyond canvas edge
    const angle = Math.random() * Math.PI * 2;
    const dist = 320;
    const ex = this.cx + Math.cos(angle) * dist;
    const ey = this.cy + Math.sin(angle) * dist;

    const rand = Math.random();
    let type = "scout";
    let hp = 1;
    let radius = 10;
    let speed = 95 + Math.min(60, this.score * 0.02);
    let pts = 25;
    let color = "#00f0ff";

    if (rand < 0.3) {
      type = "brute";
      hp = 3;
      radius = 16;
      speed = 60 + Math.min(30, this.score * 0.015);
      pts = 60;
      color = "#ff0055";
    } else if (rand < 0.55) {
      type = "corruptor";
      hp = 2;
      radius = 13;
      speed = 80 + Math.min(40, this.score * 0.02);
      pts = 40;
      color = "#b026ff";
    }

    this.enemies.push({
      x: ex,
      y: ey,
      hp,
      maxHp: hp,
      radius,
      speed,
      pts,
      type,
      color
    });
  }

  createExplosion(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.035 + Math.random() * 0.03,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;

    // Buff Timers
    if (this.tripleSpreadTimer > 0) {
      this.tripleSpreadTimer -= deltaMs;
    }

    // Auto / Continuous Firing
    if (this.isFiring) {
      this.fireTimer += deltaMs;
      if (this.fireTimer >= this.fireInterval) {
        this.fireTimer = 0;
        this.triggerFire();
      }
    } else {
      this.fireTimer = this.fireInterval;
    }

    // Spawner scaling
    this.spawnTimer += deltaMs;
    this.spawnInterval = Math.max(450, 1100 - this.score * 0.25);
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Update EMP Shockwaves
    for (let i = this.empShockwaves.length - 1; i >= 0; i--) {
      const sw = this.empShockwaves[i];
      sw.radius += 550 * deltaSec;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) {
        this.empShockwaves.splice(i, 1);
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * deltaSec;
      b.y += b.vy * deltaSec;
      b.life -= deltaSec;

      if (b.life <= 0 || b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check bullet hit on enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dist = Math.hypot(b.x - e.x, b.y - e.y);
        if (dist <= b.radius + e.radius) {
          e.hp--;
          this.createExplosion(b.x, b.y, "#00f0ff", 4);
          this.bullets.splice(i, 1);

          if (e.hp <= 0) {
            this.audio.playExplosion();
            this.createExplosion(e.x, e.y, e.color, 16);
            this.score += e.pts;

            if (this.score > this.highScore) {
              this.highScore = this.score;
              this.saveHighScore();
            }

            // Powerup drop chance (14%)
            if (Math.random() < 0.14) {
              const types = ["spread", "emp", "repair"];
              const pType = types[Math.floor(Math.random() * types.length)];
              this.powerups.push({
                x: e.x,
                y: e.y,
                type: pType,
                radius: 12
              });
            }

            // If brute splits
            if (e.type === "brute") {
              for (let k = 0; k < 2; k++) {
                const offAngle = (k === 0 ? 0.6 : -0.6);
                this.enemies.push({
                  x: e.x + Math.cos(offAngle) * 15,
                  y: e.y + Math.sin(offAngle) * 15,
                  hp: 1,
                  maxHp: 1,
                  radius: 9,
                  speed: 120,
                  pts: 15,
                  type: "scout",
                  color: "#00f0ff"
                });
              }
            }

            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Update Enemies (fly towards center)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const angle = Math.atan2(this.cy - e.y, this.cx - e.x);
      e.x += Math.cos(angle) * e.speed * deltaSec;
      e.y += Math.sin(angle) * e.speed * deltaSec;

      // Check impact on core
      const distToCore = Math.hypot(e.x - this.cx, e.y - this.cy);
      if (distToCore <= e.radius + this.coreRadius) {
        const dmg = e.type === "brute" ? 25 : 15;
        this.coreHP = Math.max(0, this.coreHP - dmg);
        this.audio.playCoreHit();
        this.createExplosion(e.x, e.y, "#ff0055", 20);
        this.enemies.splice(i, 1);

        if (this.coreHP <= 0) {
          this.triggerGameOver("Mainframe core collapsed! Breach fatal.");
          return;
        }
      }
    }

    // Update Powerups (drift slightly towards core)
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      const angle = Math.atan2(this.cy - p.y, this.cx - p.x);
      p.x += Math.cos(angle) * 35 * deltaSec;
      p.y += Math.sin(angle) * 35 * deltaSec;

      // Check pickup by core or proximity
      const dist = Math.hypot(p.x - this.cx, p.y - this.cy);
      if (dist <= p.radius + this.coreRadius + 15) {
        this.audio.playPowerup();
        this.createExplosion(p.x, p.y, "#ffd700", 14);

        if (p.type === "spread") {
          this.tripleSpreadTimer = 10000;
        } else if (p.type === "emp") {
          this.empCount = Math.min(5, this.empCount + 1);
        } else if (p.type === "repair") {
          this.coreHP = Math.min(100, this.coreHP + 30);
        }
        this.powerups.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.audio.playExplosion();
    this.createExplosion(this.cx, this.cy, "#ff0055", 35);
    if (typeof this.onGameOver === "function") {
      this.onGameOver(this.score, msg);
    }
  }

  start() {
    this.audio.init();
    this.reset();
    this.state = "PLAYING";
  }

  togglePause() {
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      return true;
    } else if (this.state === "PAUSED") {
      this.state = "PLAYING";
      return false;
    }
    return false;
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const timeNow = Date.now();

    // Dark cyber radar background
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, 0, w, h);

    // Radar concentric rings
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    [60, 120, 180, 240].forEach(r => {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Radar crosshairs
    ctx.beginPath();
    ctx.moveTo(this.cx, 0);
    ctx.lineTo(this.cx, h);
    ctx.moveTo(0, this.cy);
    ctx.lineTo(w, this.cy);
    ctx.stroke();
    ctx.restore();

    // EMP Shockwaves
    this.empShockwaves.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = `rgba(0, 240, 255, ${sw.alpha})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Render Powerups
    this.powerups.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.type === "spread" ? "#00f0ff" : p.type === "emp" ? "#ff0077" : "#00ff66";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = p.type === "spread" ? "3X" : p.type === "emp" ? "⚡" : "HP";
      ctx.fillText(icon, p.x, p.y);
      ctx.restore();
    });

    // Render Bullets
    this.bullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Central Core & Rotating Shield Ring
    ctx.save();
    // Shield ring
    const rot = timeNow * 0.002;
    ctx.strokeStyle = this.coreHP > 30 ? "#00f0ff" : "#ff0055";
    ctx.lineWidth = 3;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.coreRadius + 8, rot, rot + Math.PI * 1.5);
    ctx.stroke();

    // Core Orb
    ctx.fillStyle = this.coreHP > 30 ? "#0d1b33" : "#330d1b";
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // Core Glow
    ctx.fillStyle = this.coreHP > 30 ? "#00f0ff" : "#ff0055";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.coreRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render Rotating Turret Barrel
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.turretAngle);

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.roundRect(8, -4, 22, 8, 3);
    ctx.fill();

    // Barrel emitter tip
    ctx.fillStyle = this.tripleSpreadTimer > 0 ? "#ff0077" : "#00f0ff";
    ctx.fillRect(26, -3, 6, 6);
    ctx.restore();

    // Render Particles
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
  module.exports = { DefenseGame };
}
