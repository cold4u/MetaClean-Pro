/**
 * Neon Breaker: Quantum Void — Studio Game Engine
 */

// CanvasRenderingContext2D roundRect Polyfill for legacy browsers & webviews
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    if (typeof radii === "number") radii = [radii, radii, radii, radii];
    if (Array.isArray(radii)) {
      if (radii.length === 1) radii = [radii[0], radii[0], radii[0], radii[0]];
      else if (radii.length === 2) radii = [radii[0], radii[1], radii[0], radii[1]];
      else if (radii.length === 3) radii = [radii[0], radii[1], radii[2], radii[1]];
    } else {
      radii = [0, 0, 0, 0];
    }
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

class NeonBreaker {
  constructor() {
    this.audio = new BreakerAudio();
    this.canvas = document.getElementById("breakerCanvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.width = 480;
    this.height = 680;

    // Game state
    this.state = "START"; // START, PLAYING, PAUSED, WIN, GAMEOVER
    this.score = 0;
    this.highScore = parseInt(this.storageGet("breaker_high_score", "0"), 10) || 0;
    this.lives = 3;
    this.combo = 1;
    this.maxCombo = 1;
    this.levelIndex = 1;
    this.unlockedLevel = parseInt(this.storageGet("breaker_unlocked_level", "1"), 10) || 1;

    // Objects
    this.paddle = {
      x: this.width / 2 - 45,
      y: this.height - 45,
      w: 90,
      baseW: 90,
      h: 14,
      speed: 8,
      isLasers: false,
      laserTimer: 0,
      isExpanded: false,
      expandTimer: 0,
      isShield: false,
      shieldTimer: 0
    };

    this.balls = [];
    this.bricks = [];
    this.powerups = [];
    this.lasers = [];
    this.particles = [];
    this.popups = [];

    this.keys = {};
    this.pointerX = null;
    this.lastTime = performance.now();

    this.initDOM();
    this.bindEvents();
    this.resize();
    this.loadLevel(this.levelIndex);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  storageGet(k, def) {
    try {
      if (typeof localStorage !== "undefined") {
        const v = localStorage.getItem(k);
        return v !== null ? v : def;
      }
    } catch (_) {}
    return def;
  }

  storageSet(k, v) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(k, String(v));
      }
    } catch (_) {}
  }

  haptic(ms = 15) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  initDOM() {
    this.dom = {
      score: document.getElementById("scoreDisplay"),
      highScore: document.getElementById("highScoreDisplay"),
      level: document.getElementById("levelDisplay"),
      lives: document.getElementById("livesDisplay"),
      combo: document.getElementById("comboDisplay"),
      btnSound: document.getElementById("btnSound"),
      btnPause: document.getElementById("btnPause"),
      btnFire: document.getElementById("btnFire"),
      btnLaunch: document.getElementById("btnLaunch"),
      btnLevelSelect: document.getElementById("btnLevelSelect"),
      // Modals
      modal: document.getElementById("breakerModal"),
      modalTitle: document.getElementById("modalTitle"),
      modalStats: document.getElementById("modalStats"),
      btnModalAction: document.getElementById("btnModalAction"),
      btnModalLevels: document.getElementById("btnModalLevels"),
      // Level select modal
      levelModal: document.getElementById("levelSelectModal"),
      levelGrid: document.getElementById("levelSelectGrid"),
      btnCloseLevelSelect: document.getElementById("btnCloseLevelSelect")
    };

    if (this.dom.highScore) this.dom.highScore.textContent = this.highScore;
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        this.handleAction();
      }
      if (e.code === "KeyP") this.togglePause();
      if (e.code === "Escape") {
        if (this.dom.levelModal) this.dom.levelModal.classList.add("hidden");
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Touch & Pointer on Canvas Container
    const canvasWrap = document.getElementById("canvasWrap") || this.canvas;
    if (canvasWrap) {
      const onPointerMove = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const canvasX = (e.clientX - rect.left) * scaleX;
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.w, canvasX - this.paddle.w / 2));
      };

      canvasWrap.addEventListener("pointerdown", (e) => {
        try { canvasWrap.setPointerCapture(e.pointerId); } catch (_) {}
        onPointerMove(e);
        this.handleAction();
      });

      canvasWrap.addEventListener("pointermove", (e) => {
        if (e.buttons > 0 || e.pointerType === "touch") {
          onPointerMove(e);
        }
      });

      const endPointer = (e) => {
        try { canvasWrap.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      canvasWrap.addEventListener("pointerup", endPointer);
      canvasWrap.addEventListener("pointercancel", endPointer);
    }

    if (this.dom.btnLaunch) this.dom.btnLaunch.addEventListener("click", () => this.handleAction());
    if (this.dom.btnFire) this.dom.btnFire.addEventListener("click", () => this.fireLaser());
    if (this.dom.btnLevelSelect) this.dom.btnLevelSelect.addEventListener("click", () => this.openLevelSelect());
    if (this.dom.btnPause) this.dom.btnPause.addEventListener("click", () => this.togglePause());
    if (this.dom.btnSound) {
      this.dom.btnSound.addEventListener("click", () => {
        const on = this.audio.toggle();
        this.dom.btnSound.textContent = on ? "🔊 SFX: ON" : "🔇 SFX: OFF";
      });
    }

    if (this.dom.btnModalAction) {
      this.dom.btnModalAction.addEventListener("click", () => {
        this.dom.modal.classList.add("hidden");
        if (this.state === "WIN") {
          this.loadLevel(this.levelIndex + 1);
          this.state = "PLAYING";
        } else {
          // Restart
          this.score = 0;
          this.lives = 3;
          this.loadLevel(this.levelIndex);
          this.state = "PLAYING";
        }
      });
    }

    if (this.dom.btnModalLevels) {
      this.dom.btnModalLevels.addEventListener("click", () => {
        this.dom.modal.classList.add("hidden");
        this.openLevelSelect();
      });
    }

    if (this.dom.btnCloseLevelSelect) {
      this.dom.btnCloseLevelSelect.addEventListener("click", () => {
        this.dom.levelModal.classList.add("hidden");
      });
    }

    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx) {
      if (this.ctx.setTransform) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        this.ctx.scale(dpr, dpr);
      }
    }
  }

  loadLevel(idx) {
    let lvl = BREAKER_LEVELS.find(l => l.id === idx);
    if (!lvl) {
      lvl = ProceduralBreakerGenerator.generate(idx);
    }
    this.levelIndex = idx;
    this.combo = 1;
    this.lasers = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];

    // Reset paddle
    this.paddle.w = this.paddle.baseW;
    this.paddle.x = this.width / 2 - this.paddle.w / 2;
    this.paddle.isLasers = false;
    this.paddle.isExpanded = false;
    this.paddle.isShield = false;

    // Reset ball on paddle
    this.balls = [{
      x: this.width / 2,
      y: this.paddle.y - 8,
      vx: 0,
      vy: 0,
      r: 6,
      stuck: true,
      explosive: false
    }];

    // Build bricks
    this.bricks = [];
    const marginX = 20;
    const marginTop = 50;
    const totalW = this.width - marginX * 2;
    const bW = totalW / lvl.cols;
    const bH = 20;

    for (let r = 0; r < lvl.rows; r++) {
      for (let c = 0; c < lvl.cols; c++) {
        const type = lvl.grid[r] ? lvl.grid[r][c] : 0;
        if (type > 0) {
          let colorKey = "cyan";
          let hp = 1;
          let isBomb = false;
          let isPower = false;

          if (type === 1) colorKey = "cyan";
          else if (type === 2) colorKey = "pink";
          else if (type === 3) colorKey = "gold";
          else if (type === 4) colorKey = "lime";
          else if (type === 5) colorKey = "purple";
          else if (type === 6) { colorKey = "armor"; hp = 2; }
          else if (type === 7) { colorKey = "bomb"; isBomb = true; }
          else if (type === 8) { colorKey = "gold"; isPower = true; }

          this.bricks.push({
            x: marginX + c * bW,
            y: marginTop + r * (bH + 6),
            w: bW - 4,
            h: bH,
            r, c,
            hp,
            maxHp: hp,
            colorKey,
            isBomb,
            isPower
          });
        }
      }
    }

    if (this.dom.level) this.dom.level.textContent = lvl.name || `Level ${idx}`;
    this.updateHUD();
  }

  handleAction() {
    this.audio.init();
    // 1. Launch ball if stuck
    const stuckBall = this.balls.find(b => b.stuck);
    if (stuckBall) {
      stuckBall.stuck = false;
      const angle = (Math.random() * 0.4 - 0.2); // slight random angle
      const speed = 7.0;
      stuckBall.vx = speed * Math.sin(angle);
      stuckBall.vy = -speed * Math.cos(angle);
      this.audio.playPaddleHit();
      this.state = "PLAYING";
      return;
    }

    // 2. Fire laser if paddle armed
    if (this.paddle.isLasers) {
      this.fireLaser();
    }
  }

  fireLaser() {
    if (!this.paddle.isLasers) return;
    this.audio.playLaser();
    this.haptic(20);
    this.lasers.push({ x: this.paddle.x + 8, y: this.paddle.y, vy: -12, w: 3, h: 14 });
    this.lasers.push({ x: this.paddle.x + this.paddle.w - 11, y: this.paddle.y, vy: -12, w: 3, h: 14 });
  }

  togglePause() {
    if (this.state === "PLAYING") this.state = "PAUSED";
    else if (this.state === "PAUSED") this.state = "PLAYING";
    if (this.dom.btnPause) {
      this.dom.btnPause.textContent = this.state === "PAUSED" ? "▶ Resume" : "⏸ Pause";
    }
  }

  updateHUD() {
    if (this.dom.score) this.dom.score.textContent = this.score;
    if (this.dom.lives) this.dom.lives.textContent = "❤️".repeat(Math.max(0, this.lives));
    if (this.dom.combo) {
      this.dom.combo.textContent = `${this.combo.toFixed(1)}x`;
      this.dom.combo.style.color = this.combo > 2 ? "#ff0055" : "#00f0ff";
    }
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.storageSet("breaker_high_score", this.highScore);
      if (this.dom.highScore) this.dom.highScore.textContent = this.highScore;
    }
  }

  update(dt) {
    if (this.state !== "PLAYING") return;

    // Keyboard paddle motion
    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) {
      this.paddle.x = Math.max(0, this.paddle.x - this.paddle.speed);
    }
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) {
      this.paddle.x = Math.min(this.width - this.paddle.w, this.paddle.x + this.paddle.speed);
    }

    // Powerup Timers
    if (this.paddle.isLasers) {
      this.paddle.laserTimer -= dt;
      if (this.paddle.laserTimer <= 0) this.paddle.isLasers = false;
    }
    if (this.paddle.isExpanded) {
      this.paddle.expandTimer -= dt;
      if (this.paddle.expandTimer <= 0) {
        this.paddle.isExpanded = false;
        this.paddle.w = this.paddle.baseW;
      }
    }
    if (this.paddle.isShield) {
      this.paddle.shieldTimer -= dt;
      if (this.paddle.shieldTimer <= 0) this.paddle.isShield = false;
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.stuck) {
        b.x = this.paddle.x + this.paddle.w / 2;
        b.y = this.paddle.y - b.r - 2;
        continue;
      }

      b.x += b.vx;
      b.y += b.vy;

      // Wall bounce
      if (b.x - b.r <= 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
        this.audio.playPaddleHit();
      } else if (b.x + b.r >= this.width) {
        b.x = this.width - b.r;
        b.vx = -Math.abs(b.vx);
        this.audio.playPaddleHit();
      }

      if (b.y - b.r <= 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
        this.audio.playPaddleHit();
      }

      // Safety Shield Bounce
      if (this.paddle.isShield && b.y + b.r >= this.height - 4) {
        b.y = this.height - 4 - b.r;
        b.vy = -Math.abs(b.vy);
        this.audio.playPaddleHit();
        this.spawnParticles(b.x, b.y, "#00f0ff", 12);
      }

      // Paddle Collision
      if (
        b.vy > 0 &&
        b.y + b.r >= this.paddle.y &&
        b.y - b.r <= this.paddle.y + this.paddle.h &&
        b.x + b.r >= this.paddle.x &&
        b.x - b.r <= this.paddle.x + this.paddle.w
      ) {
        b.y = this.paddle.y - b.r;
        // Dynamic angle deflection based on hit location
        const offset = (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
        const maxAngle = Math.PI * 0.4;
        const angle = offset * maxAngle;
        const speed = Math.max(7.5, Math.hypot(b.vx, b.vy));
        b.vx = speed * Math.sin(angle);
        b.vy = -speed * Math.cos(angle);

        this.audio.playPaddleHit(offset);
        this.haptic(15);
        this.spawnParticles(b.x, b.y, "#00f0ff", 6);
      }

      // Brick Collisions
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const br = this.bricks[j];
        if (this.checkBallBrickCollision(b, br)) {
          this.hitBrick(br, b.explosive);
          if (!b.explosive) {
            // Deflect ball
            const overlapX = (b.x < br.x + br.w / 2) ? (br.x - (b.x + b.r)) : ((br.x + br.w) - (b.x - b.r));
            const overlapY = (b.y < br.y + br.h / 2) ? (br.y - (b.y + b.r)) : ((br.y + br.h) - (b.y - b.r));
            if (Math.abs(overlapX) < Math.abs(overlapY)) {
              b.vx = -b.vx;
            } else {
              b.vy = -b.vy;
            }
          }
          break;
        }
      }

      // Ball Fell Below Screen
      if (b.y - b.r > this.height) {
        this.balls.splice(i, 1);
      }
    }

    // Check If All Balls Lost
    if (this.balls.length === 0) {
      this.combo = 1;
      this.lives--;
      this.audio.playBallLost();
      this.haptic(80);
      this.updateHUD();

      if (this.lives <= 0) {
        this.gameOver();
      } else {
        // Respawn stuck ball
        this.balls.push({
          x: this.paddle.x + this.paddle.w / 2,
          y: this.paddle.y - 8,
          vx: 0,
          vy: 0,
          r: 6,
          stuck: true,
          explosive: false
        });
      }
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y += l.vy;

      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const br = this.bricks[j];
        if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
          this.hitBrick(br, false);
          this.lasers.splice(i, 1);
          break;
        }
      }

      if (l.y < 0) this.lasers.splice(i, 1);
    }

    // Update Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += p.vy;

      // Check paddle catch
      if (
        p.y + p.h >= this.paddle.y &&
        p.y <= this.paddle.y + this.paddle.h &&
        p.x + p.w >= this.paddle.x &&
        p.x <= this.paddle.x + this.paddle.w
      ) {
        this.applyPowerup(p.type);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.y > this.height) this.powerups.splice(i, 1);
    }

    // Check Victory
    if (this.bricks.length === 0) {
      this.levelWin();
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= pt.decay;
      if (pt.alpha <= 0) this.particles.splice(i, 1);
    }

    // Update Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy;
      pop.alpha -= pop.decay;
      if (pop.alpha <= 0) this.popups.splice(i, 1);
    }
  }

  checkBallBrickCollision(ball, brick) {
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    const dX = ball.x - closestX;
    const dY = ball.y - closestY;
    return (dX * dX + dY * dY) < (ball.r * ball.r);
  }

  hitBrick(brick, isExplosiveBall = false) {
    if (isExplosiveBall || brick.isBomb) {
      this.explodeBrick(brick);
      return;
    }

    brick.hp--;
    const def = BRICK_COLORS[brick.colorKey] || BRICK_COLORS.cyan;

    if (brick.hp <= 0) {
      // Destroyed!
      this.removeBrick(brick);
      this.audio.playBrickHit(this.combo);
      this.score += Math.round(def.pts * this.combo);
      this.spawnPopups(brick.x + brick.w / 2, brick.y, `+${Math.round(def.pts * this.combo)}`, def.hex);
      this.combo = Math.min(10, this.combo + 0.2);
      this.updateHUD();
    } else {
      // Armored hit
      this.audio.playArmorHit();
      this.spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, "#8a9eb5", 6);
    }
  }

  explodeBrick(centerBrick) {
    this.audio.playExplosion();
    this.haptic(60);
    this.spawnParticles(centerBrick.x + centerBrick.w / 2, centerBrick.y + centerBrick.h / 2, "#ff1744", 25);

    // Explode adjacent bricks in radius 90px
    const radius = 90;
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const b = this.bricks[i];
      const dist = Math.hypot(
        (b.x + b.w / 2) - (centerBrick.x + centerBrick.w / 2),
        (b.y + b.h / 2) - (centerBrick.y + centerBrick.h / 2)
      );
      if (dist <= radius) {
        this.removeBrick(b);
        this.score += 150;
      }
    }
    this.spawnPopups(centerBrick.x + centerBrick.w / 2, centerBrick.y, "CHAIN BLAST! +500", "#ff1744");
    this.updateHUD();
  }

  removeBrick(brick) {
    const idx = this.bricks.indexOf(brick);
    if (idx !== -1) this.bricks.splice(idx, 1);

    const def = BRICK_COLORS[brick.colorKey] || BRICK_COLORS.cyan;
    this.spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, def.hex, 10);

    // Powerup drop chance
    if (brick.isPower || Math.random() < 0.2) {
      this.spawnPowerup(brick.x + brick.w / 2 - 12, brick.y + brick.h / 2);
    }
  }

  spawnPowerup(x, y) {
    const types = ["MULTIBALL", "LASER", "SHIELD", "EXPAND", "EXPLOSIVE"];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerups.push({ x, y, w: 24, h: 24, vy: 2.2, type });
  }

  applyPowerup(type) {
    this.audio.playPowerup();
    this.haptic(35);

    if (type === "MULTIBALL") {
      // Duplicate balls
      const newBalls = [];
      this.balls.forEach(b => {
        newBalls.push({
          x: b.x, y: b.y,
          vx: b.vx * 0.8 - 3, vy: b.vy * 0.8,
          r: b.r, stuck: false, explosive: b.explosive
        });
        newBalls.push({
          x: b.x, y: b.y,
          vx: b.vx * 0.8 + 3, vy: b.vy * 0.8,
          r: b.r, stuck: false, explosive: b.explosive
        });
      });
      this.balls.push(...newBalls);
      this.spawnPopups(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20, "MULTIBALL! 💥", "#ff0077");
    } else if (type === "LASER") {
      this.paddle.isLasers = true;
      this.paddle.laserTimer = 15; // 15 seconds
      this.spawnPopups(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20, "LASER CANNONS! ⚡", "#00ff66");
    } else if (type === "SHIELD") {
      this.paddle.isShield = true;
      this.paddle.shieldTimer = 18;
      this.spawnPopups(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20, "SAFETY BARRIER! 🛡️", "#00f0ff");
    } else if (type === "EXPAND") {
      this.paddle.isExpanded = true;
      this.paddle.expandTimer = 14;
      this.paddle.w = this.paddle.baseW * 1.45;
      this.spawnPopups(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20, "PADDLE EXPAND! 📏", "#ffcc00");
    } else if (type === "EXPLOSIVE") {
      this.balls.forEach(b => b.explosive = true);
      this.spawnPopups(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20, "PLASMA BOMB BALL! 💣", "#ff1744");
    }
  }

  spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color,
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  spawnPopups(x, y, text, color) {
    this.popups.push({ x, y, text, color, vy: -1.2, alpha: 1.0, decay: 0.02 });
  }

  levelWin() {
    this.state = "WIN";
    this.audio.playLevelWin();
    this.haptic(100);

    const nextId = this.levelIndex + 1;
    if (nextId > this.unlockedLevel) {
      this.unlockedLevel = nextId;
      this.storageSet("breaker_unlocked_level", this.unlockedLevel);
    }

    if (this.dom.modalTitle) this.dom.modalTitle.textContent = "SECTOR BREACHED!";
    if (this.dom.modalStats) {
      this.dom.modalStats.innerHTML = `
        <div class="stat-box"><span>SCORE</span><b>${this.score}</b></div>
        <div class="stat-box"><span>MAX COMBO</span><b>${this.combo.toFixed(1)}x</b></div>
      `;
    }
    if (this.dom.btnModalAction) this.dom.btnModalAction.textContent = "Next Sector ➔";
    if (this.dom.modal) this.dom.modal.classList.remove("hidden");
  }

  gameOver() {
    this.state = "GAMEOVER";
    this.audio.playBallLost();

    if (this.dom.modalTitle) this.dom.modalTitle.textContent = "SYSTEM PURGED";
    if (this.dom.modalStats) {
      this.dom.modalStats.innerHTML = `
        <div class="stat-box"><span>FINAL SCORE</span><b>${this.score}</b></div>
        <div class="stat-box"><span>HIGH SCORE</span><b>${this.highScore}</b></div>
      `;
    }
    if (this.dom.btnModalAction) this.dom.btnModalAction.textContent = "Try Again ↺";
    if (this.dom.modal) this.dom.modal.classList.remove("hidden");
  }

  openLevelSelect() {
    if (!this.dom.levelGrid) return;
    this.dom.levelGrid.innerHTML = "";

    BREAKER_LEVELS.forEach(lvl => {
      const card = document.createElement("button");
      card.className = "lvl-card";
      const isLocked = lvl.id > this.unlockedLevel;

      if (isLocked) {
        card.classList.add("locked");
        card.disabled = true;
        card.innerHTML = `<span class="num">${lvl.id}</span><span>🔒</span>`;
      } else {
        if (lvl.id === this.levelIndex) card.classList.add("active");
        card.innerHTML = `<span class="num">${lvl.id}</span><span class="name">${lvl.name}</span>`;
        card.addEventListener("click", () => {
          this.dom.levelModal.classList.add("hidden");
          this.loadLevel(lvl.id);
          this.state = "PLAYING";
        });
      }
      this.dom.levelGrid.appendChild(card);
    });

    if (this.dom.levelModal) this.dom.levelModal.classList.remove("hidden");
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background Grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }

    // Safety Shield Barrier
    if (this.paddle.isShield) {
      ctx.save();
      ctx.strokeStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, this.height - 4);
      ctx.lineTo(this.width, this.height - 4);
      ctx.stroke();
      ctx.restore();
    }

    // Bricks
    this.bricks.forEach(b => {
      const def = BRICK_COLORS[b.colorKey] || BRICK_COLORS.cyan;
      ctx.save();
      ctx.fillStyle = def.hex;
      ctx.shadowColor = def.hex;
      ctx.shadowBlur = 8;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Inner beveled highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);

      // Special icons
      if (b.isBomb) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("💣", b.x + b.w / 2, b.y + b.h - 5);
      } else if (b.isPower) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("★", b.x + b.w / 2, b.y + b.h - 5);
      } else if (b.maxHp > 1 && b.hp === 1) {
        // Crack decal
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x + 4, b.y + 4);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2);
        ctx.lineTo(b.x + b.w - 4, b.y + b.h - 4);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Paddle
    ctx.save();
    ctx.fillStyle = this.paddle.isLasers ? "#00ff66" : (this.paddle.isExpanded ? "#ffcc00" : "#00f0ff");
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 6);
    ctx.fill();

    // Laser Turrets on Paddle
    if (this.paddle.isLasers) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.paddle.x + 6, this.paddle.y - 4, 4, 6);
      ctx.fillRect(this.paddle.x + this.paddle.w - 10, this.paddle.y - 4, 4, 6);
    }
    ctx.restore();

    // Lasers
    ctx.save();
    ctx.fillStyle = "#00ff66";
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur = 10;
    this.lasers.forEach(l => {
      ctx.fillRect(l.x, l.y, l.w, l.h);
    });
    ctx.restore();

    // Balls
    this.balls.forEach(b => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.explosive ? "#ff1744" : "#ffffff";
      ctx.shadowColor = b.explosive ? "#ff1744" : "#00f0ff";
      ctx.shadowBlur = b.explosive ? 16 : 10;
      ctx.fill();
      ctx.restore();
    });

    // Powerups
    this.powerups.forEach(p => {
      ctx.save();
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = "#ff0077";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#ff0077";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      const icon = {
        MULTIBALL: "💥",
        LASER: "⚡",
        SHIELD: "🛡️",
        EXPAND: "📏",
        EXPLOSIVE: "💣"
      }[p.type] || "★";
      ctx.fillText(icon, p.x + p.w / 2, p.y + p.h - 6);
      ctx.restore();
    });

    // Particles
    this.particles.forEach(pt => {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Popups
    this.popups.forEach(pop => {
      ctx.save();
      ctx.globalAlpha = pop.alpha;
      ctx.fillStyle = pop.color;
      ctx.shadowColor = pop.color;
      ctx.shadowBlur = 6;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    });

    // Tap to launch guide when ball stuck
    const stuckBall = this.balls.find(b => b.stuck);
    if (stuckBall && this.state !== "PAUSED") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 240, 255, 0.75)";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TAP SCREEN OR PRESS SPACE TO LAUNCH", this.width / 2, this.paddle.y - 25);
      ctx.restore();
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

function launchNeonBreaker() {
  if (!window.neonBreakerInstance) {
    try {
      window.neonBreakerInstance = new NeonBreaker();
      console.log("Neon Breaker initialized successfully!");
    } catch (err) {
      console.error("Failed to initialize Neon Breaker:", err);
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", launchNeonBreaker);
  } else {
    launchNeonBreaker();
  }
  window.addEventListener("load", launchNeonBreaker);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { NeonBreaker };
}
