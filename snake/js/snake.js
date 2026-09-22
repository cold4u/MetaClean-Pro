/**
 * Neon Snake: Cyber Glitch — Arcade Engine
 * Grid-based cyberpunk snake with glitch hazards, powerups, portal wrapping, and touch/D-pad controls.
 */

// CanvasRenderingContext2D roundRect polyfill for iOS Safari < 15.4 / Android WebViews
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

class SnakeGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.audio = audio || {
      init: () => {},
      playEat: () => {},
      playPowerup: () => {},
      playGlitch: () => {},
      playTurn: () => {},
      playDie: () => {}
    };

    // Grid config
    this.gridSize = 20; // 20x20 grid
    this.tileSize = 24; // 20 * 24 = 480px width & height

    // Game states
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.multiplier = 1;
    this.level = 1;

    // Movement & Loop timing
    this.stepInterval = 120; // ms per grid tick
    this.minStepInterval = 55;
    this.lastTickTime = 0;
    this.running = false;
    this.animId = null;

    // Snake entity
    this.snake = [];
    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };

    // Entities
    this.food = null;
    this.powerup = null; // { x, y, type: 'ghost'|'emp'|'mult'|'slow', timer }
    this.glitches = [];  // [ { x, y, life } ]
    this.particles = [];

    // Active buffs
    this.activeBuff = null; // 'ghost' | 'mult' | 'slow'
    this.buffTimer = 0;

    // Stats
    this.bitsEaten = 0;

    // Reset game logic
    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("neon_snake_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("neon_snake_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  reset() {
    const midX = Math.floor(this.gridSize / 2);
    const midY = Math.floor(this.gridSize / 2);

    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];

    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.score = 0;
    this.multiplier = 1;
    this.level = 1;
    this.stepInterval = 120;
    this.bitsEaten = 0;
    this.glitches = [];
    this.particles = [];
    this.activeBuff = null;
    this.buffTimer = 0;
    this.powerup = null;

    this.spawnFood();
  }

  setDirection(dx, dy) {
    // Prevent 180° instant turn into self
    if (this.dir.x + dx === 0 && this.dir.y + dy === 0) return false;
    if (this.nextDir.x + dx === 0 && this.nextDir.y + dy === 0) return false;
    
    // Play turn SFX
    if (dx !== this.dir.x || dy !== this.dir.y) {
      this.audio.playTurn();
    }

    this.nextDir = { x: dx, y: dy };
    return true;
  }

  spawnFood() {
    const occupied = new Set();
    this.snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    this.glitches.forEach(g => occupied.add(`${g.x},${g.y}`));
    if (this.powerup) occupied.add(`${this.powerup.x},${this.powerup.y}`);

    const freeSlots = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        if (!occupied.has(`${x},${y}`)) freeSlots.push({ x, y });
      }
    }

    if (freeSlots.length === 0) {
      this.food = { x: 0, y: 0, isGold: false };
      return;
    }

    const slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
    const isGold = Math.random() < 0.2; // 20% golden bit
    this.food = { x: slot.x, y: slot.y, isGold };
  }

  spawnPowerup() {
    if (this.powerup) return;
    const types = ["ghost", "emp", "mult", "slow"];
    const type = types[Math.floor(Math.random() * types.length)];

    const occupied = new Set();
    this.snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    this.glitches.forEach(g => occupied.add(`${g.x},${g.y}`));
    if (this.food) occupied.add(`${this.food.x},${this.food.y}`);

    const freeSlots = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        if (!occupied.has(`${x},${y}`)) freeSlots.push({ x, y });
      }
    }

    if (freeSlots.length > 0) {
      const slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
      this.powerup = {
        x: slot.x,
        y: slot.y,
        type,
        timer: 10000 // 10s expiration
      };
    }
  }

  spawnGlitch() {
    if (this.glitches.length >= 6) return;
    const occupied = new Set();
    this.snake.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    if (this.food) occupied.add(`${this.food.x},${this.food.y}`);
    if (this.powerup) occupied.add(`${this.powerup.x},${this.powerup.y}`);
    this.glitches.forEach(g => occupied.add(`${g.x},${g.y}`));

    const freeSlots = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const dist = Math.abs(x - this.snake[0].x) + Math.abs(y - this.snake[0].y);
        if (dist > 2 && !occupied.has(`${x},${y}`)) {
          freeSlots.push({ x, y });
        }
      }
    }

    if (freeSlots.length > 0) {
      const slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
      this.glitches.push({
        x: slot.x,
        y: slot.y,
        life: 12000 // Lasts 12s then despawns
      });
      this.audio.playGlitch();
    }
  }

  createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x: (x + 0.5) * this.tileSize,
        y: (y + 0.5) * this.tileSize,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    // Update buff timer
    if (this.activeBuff) {
      this.buffTimer -= deltaMs;
      if (this.buffTimer <= 0) {
        this.activeBuff = null;
        this.buffTimer = 0;
        this.multiplier = 1;
      }
    }

    // Update powerup despawn timer
    if (this.powerup) {
      this.powerup.timer -= deltaMs;
      if (this.powerup.timer <= 0) {
        this.powerup = null;
      }
    }

    // Update glitches
    for (let i = this.glitches.length - 1; i >= 0; i--) {
      this.glitches[i].life -= deltaMs;
      if (this.glitches[i].life <= 0) {
        this.glitches.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Grid tick timing
    let currentSpeed = this.stepInterval;
    if (this.activeBuff === "slow") currentSpeed *= 1.5;

    this.lastTickTime += deltaMs;
    if (this.lastTickTime >= currentSpeed) {
      this.lastTickTime = 0;
      this.tick();
    }
  }

  tick() {
    this.dir = { ...this.nextDir };
    const head = this.snake[0];
    let nextX = head.x + this.dir.x;
    let nextY = head.y + this.dir.y;

    // Wrap-around portal edges
    if (nextX < 0) nextX = this.gridSize - 1;
    else if (nextX >= this.gridSize) nextX = 0;

    if (nextY < 0) nextY = this.gridSize - 1;
    else if (nextY >= this.gridSize) nextY = 0;

    const newHead = { x: nextX, y: nextY };

    // Check glitch collision
    const glitchIdx = this.glitches.findIndex(g => g.x === nextX && g.y === nextY);
    if (glitchIdx !== -1) {
      if (this.activeBuff === "ghost") {
        this.createExplosion(nextX, nextY, "#00ffff", 6);
      } else {
        this.triggerGameOver("Glitch hazard vaporized your snake core!");
        return;
      }
    }

    // Check self collision (ignoring tail tip if not eating this tick)
    const hitTail = this.snake.slice(0, -1).some(seg => seg.x === nextX && seg.y === nextY);
    if (hitTail && this.activeBuff !== "ghost") {
      this.triggerGameOver("Mainframe loop collision! Self-intersection error.");
      return;
    }

    // Move snake
    this.snake.unshift(newHead);

    // Check food collision
    let ateFood = false;
    if (this.food && nextX === this.food.x && nextY === this.food.y) {
      ateFood = true;
      const pts = (this.food.isGold ? 30 : 10) * this.multiplier;
      this.score += pts;
      this.bitsEaten++;
      this.audio.playEat();
      this.createExplosion(nextX, nextY, this.food.isGold ? "#ffcc00" : "#00ffcc", 14);

      if (this.bitsEaten % 5 === 0) {
        this.level++;
        this.stepInterval = Math.max(this.minStepInterval, 120 - (this.level - 1) * 6);
        this.spawnGlitch();
      }

      if (Math.random() < 0.35) {
        this.spawnPowerup();
      }

      this.spawnFood();
    }

    // Check powerup collision
    if (this.powerup && nextX === this.powerup.x && nextY === this.powerup.y) {
      this.applyPowerup(this.powerup.type);
      this.powerup = null;
    }

    // If not ate food, pop tail
    if (!ateFood) {
      this.snake.pop();
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
  }

  applyPowerup(type) {
    this.audio.playPowerup();
    if (type === "emp") {
      const count = this.glitches.length;
      this.glitches.forEach(g => this.createExplosion(g.x, g.y, "#ff0077", 12));
      this.glitches = [];
      this.score += count * 25 * this.multiplier;
      this.activeBuff = "emp";
      this.buffTimer = 1500;
    } else if (type === "mult") {
      this.activeBuff = "mult";
      this.multiplier = 2;
      this.buffTimer = 12000;
    } else if (type === "ghost") {
      this.activeBuff = "ghost";
      this.buffTimer = 10000;
    } else if (type === "slow") {
      this.activeBuff = "slow";
      this.buffTimer = 8000;
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.audio.playDie();
    if (this.snake.length > 0) {
      this.createExplosion(this.snake[0].x, this.snake[0].y, "#ff0055", 25);
    }
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
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ts = this.tileSize;

    // Background Cyber Grid
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += ts) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += ts) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Portal Edges Neon Border
    ctx.save();
    ctx.strokeStyle = this.activeBuff === "ghost" ? "#00ffcc" : "#00e5ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 8;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.restore();

    // Render Glitches
    const timeNow = Date.now();
    this.glitches.forEach(g => {
      const gx = g.x * ts;
      const gy = g.y * ts;
      const pulse = Math.sin(timeNow * 0.008 + g.x) * 0.3 + 0.7;

      ctx.save();
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 12 * pulse;
      ctx.fillStyle = `rgba(255, 0, 85, ${pulse})`;
      ctx.roundRect(gx + 2, gy + 2, ts - 4, ts - 4, 4);
      ctx.fill();

      // Glitch warning cross
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + 6, gy + 6);
      ctx.lineTo(gx + ts - 6, gy + ts - 6);
      ctx.moveTo(gx + ts - 6, gy + 6);
      ctx.lineTo(gx + 6, gy + ts - 6);
      ctx.stroke();
      ctx.restore();
    });

    // Render Food
    if (this.food) {
      const fx = this.food.x * ts;
      const fy = this.food.y * ts;
      const pulse = Math.sin(timeNow * 0.01) * 2;
      const isG = this.food.isGold;

      ctx.save();
      ctx.shadowColor = isG ? "#ffcc00" : "#00ffcc";
      ctx.shadowBlur = 10;
      ctx.fillStyle = isG ? "#ffd700" : "#00ffcc";
      ctx.beginPath();
      ctx.arc(fx + ts / 2, fy + ts / 2, ts / 2 - 3 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core center
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(fx + ts / 2, fy + ts / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Powerup
    if (this.powerup) {
      const px = this.powerup.x * ts;
      const py = this.powerup.y * ts;
      const colors = {
        ghost: "#38bdf8",
        emp: "#f43f5e",
        mult: "#fbbf24",
        slow: "#a855f7"
      };
      const icons = {
        ghost: "👻",
        emp: "⚡",
        mult: "2x",
        slow: "⏱️"
      };
      const pColor = colors[this.powerup.type] || "#38bdf8";

      ctx.save();
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = pColor;
      ctx.roundRect(px + 1, py + 1, ts - 2, ts - 2, 6);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icons[this.powerup.type] || "★", px + ts / 2, py + ts / 2);
      ctx.restore();
    }

    // Render Snake
    const isGhost = this.activeBuff === "ghost";
    this.snake.forEach((seg, idx) => {
      const sx = seg.x * ts;
      const sy = seg.y * ts;

      ctx.save();
      if (idx === 0) {
        ctx.shadowColor = isGhost ? "#38bdf8" : "#00f0ff";
        ctx.shadowBlur = 14;
        ctx.fillStyle = isGhost ? "rgba(56, 189, 248, 0.9)" : "#00f0ff";
        ctx.roundRect(sx + 1, sy + 1, ts - 2, ts - 2, 6);
        ctx.fill();

        ctx.fillStyle = "#070b14";
        if (this.dir.x === 1) {
          ctx.fillRect(sx + ts - 6, sy + 4, 3, 3);
          ctx.fillRect(sx + ts - 6, sy + ts - 7, 3, 3);
        } else if (this.dir.x === -1) {
          ctx.fillRect(sx + 3, sy + 4, 3, 3);
          ctx.fillRect(sx + 3, sy + ts - 7, 3, 3);
        } else if (this.dir.y === 1) {
          ctx.fillRect(sx + 4, sy + ts - 6, 3, 3);
          ctx.fillRect(sx + ts - 7, sy + ts - 6, 3, 3);
        } else {
          ctx.fillRect(sx + 4, sy + 3, 3, 3);
          ctx.fillRect(sx + ts - 7, sy + 3, 3, 3);
        }
      } else {
        const alpha = Math.max(0.3, 1 - idx / (this.snake.length + 5));
        ctx.shadowColor = isGhost ? "rgba(56, 189, 248, 0.5)" : "rgba(0, 240, 255, 0.4)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = isGhost
          ? `rgba(56, 189, 248, ${alpha})`
          : `rgba(0, ${Math.floor(200 + 55 * alpha)}, 255, ${alpha})`;
        ctx.roundRect(sx + 2, sy + 2, ts - 4, ts - 4, 4);
        ctx.fill();
      }
      ctx.restore();
    });

    // Render Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SnakeGame };
}
