/**
 * Gravity Runner: Quantum Flip — Arcade Engine
 * High-speed gravity-flipping endless runner with laser gates, sawblades, and phase shields.
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

class RunnerGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 640;
    this.height = canvas ? canvas.height : 360;
    this.audio = audio || {
      init: () => {},
      playFlip: () => {},
      playCoin: () => {},
      playShield: () => {},
      playCrash: () => {}
    };

    // Floor and Ceiling bounds
    this.ceilingY = 36;
    this.floorY = this.height - 36;

    // States
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.distance = 0;
    this.speed = 300;

    // Player
    this.player = {
      x: 80,
      y: this.floorY - 34,
      w: 26,
      h: 34,
      vy: 0,
      gravityDir: 1, // 1 = down, -1 = up
      grounded: true,
      shieldTimer: 0
    };

    // Spawner
    this.spawnTimer = 0;
    this.spawnInterval = 1200; // ms

    // Entities
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];

    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("gravity_runner_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gravity_runner_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  reset() {
    this.score = 0;
    this.distance = 0;
    this.speed = 300;
    this.player = {
      x: 80,
      y: this.floorY - 34,
      w: 26,
      h: 34,
      vy: 0,
      gravityDir: 1,
      grounded: true,
      shieldTimer: 0
    };
    this.spawnTimer = 0;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
  }

  flipGravity() {
    if (this.state !== "PLAYING") return false;
    // Allow flip if grounded or near surface
    if (this.player.grounded) {
      this.player.gravityDir = -this.player.gravityDir;
      this.player.grounded = false;
      this.player.vy = this.player.gravityDir * 3;
      this.audio.playFlip();
      this.createExplosion(this.player.x + 13, this.player.y + 17, "#00f0ff", 10);
      return true;
    }
    return false;
  }

  spawnObstacle() {
    const isCeiling = Math.random() < 0.5;
    const typeRand = Math.random();

    if (typeRand < 0.7) {
      // Static barrier on floor or ceiling
      const h = 30 + Math.random() * 25;
      const w = 24;
      const y = isCeiling ? this.ceilingY : this.floorY - h;
      this.obstacles.push({
        x: this.width + 20,
        y,
        w,
        h,
        isCeiling,
        type: "barrier"
      });
    } else {
      // Mid-air sawblade
      this.obstacles.push({
        x: this.width + 20,
        y: (this.floorY + this.ceilingY) / 2 - 16,
        w: 32,
        h: 32,
        type: "sawblade",
        rot: 0
      });
    }

    // Chance to spawn energy bit or shield
    if (Math.random() < 0.45) {
      const cy = (this.floorY + this.ceilingY) / 2 + (Math.random() - 0.5) * 80;
      const isShield = Math.random() < 0.15;
      this.collectibles.push({
        x: this.width + 120,
        y: cy,
        w: 18,
        h: 18,
        type: isShield ? "shield" : "bit"
      });
    }
  }

  createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.04 + Math.random() * 0.04,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;
    const p = this.player;

    // Progression: speed increases gradually
    this.speed = Math.min(520, 300 + this.distance * 0.12);
    this.distance += Math.floor(this.speed * deltaSec * 0.2);
    this.score = this.distance;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    // Shield Timer
    if (p.shieldTimer > 0) {
      p.shieldTimer -= deltaMs;
    }

    // Physics
    const gravityForce = 18 * p.gravityDir;
    p.vy += gravityForce;
    p.y += p.vy * deltaSec * 35;

    // Floor collision
    if (p.y >= this.floorY - p.h) {
      p.y = this.floorY - p.h;
      p.vy = 0;
      p.grounded = (p.gravityDir === 1);
    }
    // Ceiling collision
    else if (p.y <= this.ceilingY) {
      p.y = this.ceilingY;
      p.vy = 0;
      p.grounded = (p.gravityDir === -1);
    } else {
      p.grounded = false;
    }

    // Trail particles
    if (Math.random() < 0.4) {
      this.particles.push({
        x: p.x,
        y: p.y + p.h / 2,
        vx: -2 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 2,
        color: p.shieldTimer > 0 ? "#ff0077" : "#00f0ff",
        life: 0.8,
        decay: 0.05,
        size: 3
      });
    }

    // Spawner
    this.spawnTimer += deltaMs;
    const currentInterval = Math.max(700, 1300 - this.distance * 0.2);
    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed * deltaSec;

      // Check collision
      if (
        p.x + p.w - 4 > obs.x &&
        p.x + 4 < obs.x + obs.w &&
        p.y + p.h - 4 > obs.y &&
        p.y + 4 < obs.y + obs.h
      ) {
        if (p.shieldTimer > 0) {
          // Shield absorbs obstacle
          this.createExplosion(obs.x + obs.w / 2, obs.y + obs.h / 2, "#ff0077", 14);
          this.obstacles.splice(i, 1);
          this.score += 50;
        } else {
          this.triggerGameOver("Shattered by quantum laser barrier!");
          return;
        }
      }

      if (obs.x < -60) {
        this.obstacles.splice(i, 1);
      }
    }

    // Move collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.x -= this.speed * deltaSec;

      // Check pickup collision
      if (
        p.x + p.w > c.x &&
        p.x < c.x + c.w &&
        p.y + p.h > c.y &&
        p.y < c.y + c.h
      ) {
        if (c.type === "shield") {
          p.shieldTimer = 6000;
          this.audio.playShield();
          this.createExplosion(c.x + 9, c.y + 9, "#ff0077", 16);
        } else {
          this.score += 50;
          this.audio.playCoin();
          this.createExplosion(c.x + 9, c.y + 9, "#ffd700", 12);
        }
        this.collectibles.splice(i, 1);
      } else if (c.x < -40) {
        this.collectibles.splice(i, 1);
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
    this.audio.playCrash();
    this.createExplosion(this.player.x + 13, this.player.y + 17, "#ff0055", 25);
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

    // Background
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, 0, w, h);

    // Ceiling & Floor rails
    ctx.fillStyle = "#0d1626";
    ctx.fillRect(0, 0, w, this.ceilingY);
    ctx.fillRect(0, this.floorY, w, h - this.floorY);

    // Neon Track Borders
    ctx.save();
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, this.ceilingY);
    ctx.lineTo(w, this.ceilingY);
    ctx.moveTo(0, this.floorY);
    ctx.lineTo(w, this.floorY);
    ctx.stroke();
    ctx.restore();

    // Render Obstacles
    this.obstacles.forEach(obs => {
      ctx.save();
      if (obs.type === "sawblade") {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#ff0055";
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 10;
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
        ctx.fill();

        // Warning core stripe
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(obs.x + 6, obs.y + 4, obs.w - 12, obs.h - 8);
      }
      ctx.restore();
    });

    // Render Collectibles
    this.collectibles.forEach(c => {
      ctx.save();
      if (c.type === "shield") {
        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(c.x + 9, c.y + 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText("🛡️", c.x + 2, c.y + 13);
      } else {
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(c.x + 9, c.y + 9, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Render Player
    const p = this.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.gravityDir === -1) {
      ctx.scale(1, -1);
    }

    // Shield Aura
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = "#ff0077";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ff0077";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cyber Runner Body
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 6);
    ctx.fill();

    // Runner Visor
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, -p.h / 2 + 4, p.w / 2 - 2, 7);
    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(4, -p.h / 2 + 5, 6, 4);

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
  module.exports = { RunnerGame };
}
