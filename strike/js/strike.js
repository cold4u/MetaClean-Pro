/**
 * Cyber Strike: Void Invaders — Studio Game Engine
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

class CyberStrike {
  constructor() {
    this.audio = new StrikeAudio();
    this.canvas = document.getElementById("strikeCanvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.width = 480;
    this.height = 700;

    // Game state
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = parseInt(this.storageGet("strike_high_score", "0"), 10) || 0;
    this.wave = 1;
    this.bombs = 2;
    this.bombCharge = 100; // 0 to 100%

    // Player Ship
    this.player = {
      x: this.width / 2,
      y: this.height - 90,
      w: 32,
      h: 36,
      speed: 7,
      health: 100,
      maxHealth: 100,
      shield: 100,
      maxShield: 100,
      weaponTier: 1, // 1 to 4
      fireTimer: 0,
      fireRate: 0.14,
      invulnTimer: 0
    };

    // Arrays
    this.bullets = [];      // Player bullets
    this.enemyBullets = []; // Enemy bullets
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.stars = [];

    this.keys = {};
    this.targetX = this.player.x;
    this.targetY = this.player.y;
    this.isTouchActive = false;
    this.waveSpawnTimer = 0;
    this.enemiesRemainingInWave = 0;
    this.boss = null;
    this.lastTime = performance.now();

    this.initDOM();
    this.initStars();
    this.bindEvents();
    this.resize();
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
      wave: document.getElementById("waveDisplay"),
      healthFill: document.getElementById("healthFill"),
      shieldFill: document.getElementById("shieldFill"),
      bombCount: document.getElementById("bombCountDisplay"),
      btnSound: document.getElementById("btnSound"),
      btnPause: document.getElementById("btnPause"),
      btnBomb: document.getElementById("btnBomb"),
      btnStart: document.getElementById("btnStartGame"),
      // Modals
      startScreen: document.getElementById("startScreen"),
      gameOverModal: document.getElementById("gameOverModal"),
      finalScore: document.getElementById("finalScoreDisplay"),
      btnRestart: document.getElementById("btnRestartGame"),
      bossWarning: document.getElementById("bossWarning")
    };

    if (this.dom.highScore) this.dom.highScore.textContent = this.highScore;
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: Math.random() * 2 + 0.5,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (this.state === "START" || this.state === "GAMEOVER") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          this.startGame();
          return;
        }
      }
      if (e.code === "Space" || e.code === "KeyB") {
        e.preventDefault();
        this.triggerBomb();
      }
      if (e.code === "KeyP") this.togglePause();
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    const wrap = document.getElementById("canvasWrap") || this.canvas;
    if (wrap) {
      let lastTouchTime = 0;

      const handlePointer = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        const touchX = (e.clientX - rect.left) * scaleX;
        const touchY = (e.clientY - rect.top) * scaleY;

        // Offset Y slightly upwards on touch so thumb does not block view of ship
        const offsetY = e.pointerType === "touch" ? 50 : 0;
        this.targetX = Math.max(20, Math.min(this.width - 20, touchX));
        this.targetY = Math.max(60, Math.min(this.height - 30, touchY - offsetY));
        this.isTouchActive = true;
      };

      wrap.addEventListener("pointerdown", (e) => {
        try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
        handlePointer(e);

        // Double tap detection for Bomb deployment
        const now = Date.now();
        if (now - lastTouchTime < 300) {
          this.triggerBomb();
        }
        lastTouchTime = now;
      });

      wrap.addEventListener("pointermove", (e) => {
        if (e.buttons > 0 || e.pointerType === "touch") {
          handlePointer(e);
        }
      });

      const endPointer = (e) => {
        this.isTouchActive = false;
        try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      wrap.addEventListener("pointerup", endPointer);
      wrap.addEventListener("pointercancel", endPointer);
    }

    if (this.dom.btnBomb) this.dom.btnBomb.addEventListener("click", () => this.triggerBomb());
    if (this.dom.btnPause) this.dom.btnPause.addEventListener("click", () => this.togglePause());
    if (this.dom.btnSound) {
      this.dom.btnSound.addEventListener("click", () => {
        const on = this.audio.toggle();
        this.dom.btnSound.textContent = on ? "🔊 SFX: ON" : "🔇 SFX: OFF";
      });
    }

    if (this.dom.startScreen) {
      this.dom.startScreen.addEventListener("click", () => this.startGame());
    }

    if (this.dom.btnStart) {
      this.dom.btnStart.addEventListener("click", (e) => {
        e.stopPropagation();
        this.startGame();
      });
    }

    if (this.dom.gameOverModal) {
      this.dom.gameOverModal.addEventListener("click", () => this.startGame());
    }

    if (this.dom.btnRestart) {
      this.dom.btnRestart.addEventListener("click", (e) => {
        e.stopPropagation();
        this.startGame();
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

  startGame() {
    this.audio.init();
    if (this.dom.startScreen) this.dom.startScreen.classList.add("hidden");
    if (this.dom.gameOverModal) this.dom.gameOverModal.classList.add("hidden");

    this.score = 0;
    this.wave = 1;
    this.bombs = 2;
    this.player.health = 100;
    this.player.shield = 100;
    this.player.weaponTier = 1;
    this.player.x = this.width / 2;
    this.player.y = this.height - 90;
    this.targetX = this.player.x;
    this.targetY = this.player.y;

    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.boss = null;

    this.state = "PLAYING";
    this.startWave(this.wave);
    this.updateHUD();
  }

  startWave(num) {
    this.wave = num;
    this.enemiesRemainingInWave = 8 + num * 3;
    this.waveSpawnTimer = 0.5;

    if (this.dom.wave) this.dom.wave.textContent = `WAVE ${num}`;

    // Boss wave every 5 waves
    if (num % 5 === 0) {
      this.audio.playBossWarning();
      if (this.dom.bossWarning) {
        this.dom.bossWarning.classList.remove("hidden");
        setTimeout(() => this.dom.bossWarning.classList.add("hidden"), 2200);
      }
      this.spawnBoss(num);
    }
  }

  spawnBoss(waveNum) {
    this.boss = {
      x: this.width / 2,
      y: -90,
      targetY: 110,
      w: 120,
      h: 80,
      hp: 600 + waveNum * 150,
      maxHp: 600 + waveNum * 150,
      vx: 2.2,
      shootTimer: 0.8,
      missileTimer: 2.5,
      angle: 0
    };
  }

  togglePause() {
    if (this.state === "PLAYING") this.state = "PAUSED";
    else if (this.state === "PAUSED") this.state = "PLAYING";
    if (this.dom.btnPause) {
      this.dom.btnPause.textContent = this.state === "PAUSED" ? "▶ Resume" : "⏸ Pause";
    }
  }

  triggerBomb() {
    if (this.bombs <= 0 || this.state !== "PLAYING") return;
    this.bombs--;
    this.audio.playBomb();
    this.haptic(100);

    // Screen clearing shockwave
    this.enemyBullets = [];

    // Damage all regular enemies and boss
    this.enemies.forEach(e => {
      e.hp -= 150;
      this.spawnParticles(e.x, e.y, "#00f0ff", 12);
    });

    if (this.boss) {
      this.boss.hp -= 200;
      this.spawnParticles(this.boss.x, this.boss.y, "#ff0077", 25);
    }

    // Shockwave particle ring
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * 9,
        vy: Math.sin(a) * 9,
        size: 4,
        color: "#00f0ff",
        alpha: 1.0,
        decay: 0.02
      });
    }

    this.spawnPopups(this.player.x, this.player.y - 40, "EMP SHOCKWAVE DETONATED!", "#00f0ff");
    this.updateHUD();
  }

  updateHUD() {
    if (this.dom.score) this.dom.score.textContent = this.score;
    if (this.dom.healthFill) this.dom.healthFill.style.width = `${Math.max(0, this.player.health)}%`;
    if (this.dom.shieldFill) this.dom.shieldFill.style.width = `${Math.max(0, this.player.shield)}%`;
    if (this.dom.bombCount) this.dom.bombCount.textContent = `💣 × ${this.bombs}`;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.storageSet("strike_high_score", this.highScore);
      if (this.dom.highScore) this.dom.highScore.textContent = this.highScore;
    }
  }

  update(dt) {
    // Starfield animation
    this.stars.forEach(s => {
      s.y += s.speed;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }
    });

    if (this.state !== "PLAYING") return;

    // Player Keyboard Movement
    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) this.targetX -= this.player.speed;
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) this.targetX += this.player.speed;
    if (this.keys["ArrowUp"] || this.keys["KeyW"]) this.targetY -= this.player.speed;
    if (this.keys["ArrowDown"] || this.keys["KeyS"]) this.targetY += this.player.speed;

    // Smooth movement interpolation to target
    this.player.x += (this.targetX - this.player.x) * 0.22;
    this.player.y += (this.targetY - this.player.y) * 0.22;
    this.player.x = Math.max(20, Math.min(this.width - 20, this.player.x));
    this.player.y = Math.max(60, Math.min(this.height - 30, this.player.y));

    // Shield passive regeneration
    if (this.player.shield < this.player.maxShield) {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 3 * dt);
      if (this.dom.shieldFill) this.dom.shieldFill.style.width = `${this.player.shield}%`;
    }

    // Invulnerability timer
    if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt;

    // Auto-fire blasters
    this.player.fireTimer -= dt;
    if (this.player.fireTimer <= 0) {
      this.player.fireTimer = this.player.fireRate;
      this.fireWeapons();
    }

    // Wave Spawning
    if (this.enemiesRemainingInWave > 0 && !this.boss) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        this.waveSpawnTimer = Math.max(0.6, 1.6 - this.wave * 0.08);
        this.spawnEnemy();
        this.enemiesRemainingInWave--;
      }
    } else if (this.enemies.length === 0 && !this.boss && this.enemiesRemainingInWave <= 0) {
      // Wave cleared! Advance
      this.score += 500;
      this.spawnPopups(this.width / 2, this.height / 2, `WAVE ${this.wave} CLEARED! +500`, "#00ff66");
      this.startWave(this.wave + 1);
    }

    // Update Player Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      // Check Boss hit
      if (this.boss) {
        if (
          b.x >= this.boss.x - this.boss.w / 2 &&
          b.x <= this.boss.x + this.boss.w / 2 &&
          b.y >= this.boss.y - this.boss.h / 2 &&
          b.y <= this.boss.y + this.boss.h / 2
        ) {
          this.boss.hp -= b.dmg;
          this.spawnParticles(b.x, b.y, "#00f0ff", 4);
          this.bullets.splice(i, 1);
          if (this.boss.hp <= 0) {
            this.destroyBoss();
          }
          continue;
        }
      }

      // Check Enemy hit
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (
          b.x >= e.x - e.w / 2 &&
          b.x <= e.x + e.w / 2 &&
          b.y >= e.y - e.h / 2 &&
          b.y <= e.y + e.h / 2
        ) {
          e.hp -= b.dmg;
          this.spawnParticles(b.x, b.y, "#00f0ff", 3);
          this.bullets.splice(i, 1);

          if (e.hp <= 0) {
            this.destroyEnemy(e, j);
          }
          break;
        }
      }

      if (b.y < -20 || b.x < 0 || b.x > this.width) {
        this.bullets.splice(i, 1);
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;

      if (e.type === "DRONE") {
        e.y += e.vy;
        e.x += Math.sin(e.t * 3) * 2;
      } else if (e.type === "INTERCEPTOR") {
        e.y += e.vy;
        e.x += (this.player.x - e.x) * 0.02;
      } else if (e.type === "CRUISER") {
        e.y += e.vy;
      }

      // Enemy shooting
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = e.shootInterval;
        if (e.type === "CRUISER") {
          // 3-way spread
          for (let a of [-0.25, 0, 0.25]) {
            this.enemyBullets.push({
              x: e.x, y: e.y + e.h / 2,
              vx: Math.sin(a) * 4.5,
              vy: Math.cos(a) * 4.5,
              r: 4
            });
          }
        } else {
          this.enemyBullets.push({
            x: e.x, y: e.y + e.h / 2,
            vx: 0, vy: 4.8,
            r: 3.5
          });
        }
      }

      // Collide with player
      if (this.checkShipCollision(this.player, e)) {
        this.damagePlayer(30);
        this.destroyEnemy(e, i);
        continue;
      }

      if (e.y > this.height + 40) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Boss
    if (this.boss) {
      if (this.boss.y < this.boss.targetY) {
        this.boss.y += 1.5;
      } else {
        this.boss.x += this.boss.vx;
        if (this.boss.x - this.boss.w / 2 <= 20 || this.boss.x + this.boss.w / 2 >= this.width - 20) {
          this.boss.vx = -this.boss.vx;
        }

        // Boss shooting
        this.boss.shootTimer -= dt;
        if (this.boss.shootTimer <= 0) {
          this.boss.shootTimer = 0.7;
          // Dual turrets
          for (let dx of [-35, 35]) {
            this.enemyBullets.push({
              x: this.boss.x + dx, y: this.boss.y + 30,
              vx: (Math.random() - 0.5) * 2,
              vy: 5.2,
              r: 4.5
            });
          }
        }

        // Missile barrage
        this.boss.missileTimer -= dt;
        if (this.boss.missileTimer <= 0) {
          this.boss.missileTimer = 2.8;
          for (let a of [-0.4, -0.2, 0, 0.2, 0.4]) {
            this.enemyBullets.push({
              x: this.boss.x, y: this.boss.y + 30,
              vx: Math.sin(a) * 5,
              vy: Math.cos(a) * 5,
              r: 5
            });
          }
        }
      }
    }

    // Update Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx;
      eb.y += eb.vy;

      // Hit player
      const dist = Math.hypot(eb.x - this.player.x, eb.y - this.player.y);
      if (dist < eb.r + 14) {
        this.damagePlayer(15);
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (eb.y > this.height + 20 || eb.x < 0 || eb.x > this.width) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // Update Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 2.0;

      const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (dist < 26) {
        this.collectPowerup(p.type);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.y > this.height + 20) this.powerups.splice(i, 1);
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

  fireWeapons() {
    this.audio.playLaser();
    const tier = this.player.weaponTier;

    if (tier === 1) {
      // Single laser
      this.bullets.push({ x: this.player.x, y: this.player.y - 18, vx: 0, vy: -14, dmg: 35 });
    } else if (tier === 2) {
      // Twin blasters
      this.bullets.push({ x: this.player.x - 8, y: this.player.y - 16, vx: 0, vy: -14, dmg: 30 });
      this.bullets.push({ x: this.player.x + 8, y: this.player.y - 16, vx: 0, vy: -14, dmg: 30 });
    } else if (tier === 3) {
      // Triple spread
      this.bullets.push({ x: this.player.x, y: this.player.y - 18, vx: 0, vy: -14, dmg: 30 });
      this.bullets.push({ x: this.player.x - 9, y: this.player.y - 16, vx: -2.5, vy: -13.5, dmg: 25 });
      this.bullets.push({ x: this.player.x + 9, y: this.player.y - 16, vx: 2.5, vy: -13.5, dmg: 25 });
    } else {
      // Tier 4: Plasma 5-way wave
      for (let a of [-0.22, -0.11, 0, 0.11, 0.22]) {
        this.bullets.push({
          x: this.player.x,
          y: this.player.y - 18,
          vx: Math.sin(a) * 14,
          vy: -Math.cos(a) * 14,
          dmg: 28
        });
      }
    }
  }

  spawnEnemy() {
    const types = ["DRONE", "INTERCEPTOR", "CRUISER"];
    const r = Math.random();
    let type = "DRONE";
    let hp = 40;
    let w = 28;
    let h = 28;
    let vy = 2.5;

    if (r < 0.5) {
      type = "DRONE";
      hp = 40 + this.wave * 5;
    } else if (r < 0.8) {
      type = "INTERCEPTOR";
      hp = 60 + this.wave * 8;
      vy = 3.4;
      w = 26; h = 30;
    } else {
      type = "CRUISER";
      hp = 120 + this.wave * 15;
      vy = 1.4;
      w = 42; h = 38;
    }

    this.enemies.push({
      x: Math.random() * (this.width - 80) + 40,
      y: -40,
      type,
      w, h,
      hp, maxHp: hp,
      vy,
      t: Math.random() * 10,
      shootTimer: Math.random() * 1.5 + 0.8,
      shootInterval: Math.max(1.0, 2.2 - this.wave * 0.05)
    });
  }

  destroyEnemy(e, idx) {
    this.enemies.splice(idx, 1);
    this.audio.playEnemyExplosion();
    this.haptic(25);
    this.spawnParticles(e.x, e.y, "#ff0077", 14);

    const pts = e.type === "CRUISER" ? 250 : (e.type === "INTERCEPTOR" ? 150 : 80);
    this.score += pts;
    this.spawnPopups(e.x, e.y, `+${pts}`, "#ffcc00");

    // Powerup drop
    if (Math.random() < 0.18) {
      const types = ["UPGRADE", "SHIELD", "BOMB"];
      const type = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({ x: e.x, y: e.y, type });
    }

    this.updateHUD();
  }

  destroyBoss() {
    this.audio.playEnemyExplosion();
    this.audio.playBomb();
    this.haptic(120);

    for (let i = 0; i < 50; i++) {
      this.spawnParticles(this.boss.x, this.boss.y, "#ff1744", 2);
      this.spawnParticles(this.boss.x, this.boss.y, "#00f0ff", 2);
    }

    this.score += 3000;
    this.spawnPopups(this.boss.x, this.boss.y, "DREADNOUGHT DESTROYED! +3000", "#00ff66");
    this.boss = null;
    this.updateHUD();
    this.startWave(this.wave + 1);
  }

  damagePlayer(amt) {
    if (this.player.invulnTimer > 0) return;
    this.haptic(50);
    this.player.invulnTimer = 0.5;

    // Shield absorbs damage first
    if (this.player.shield > 0) {
      if (this.player.shield >= amt) {
        this.player.shield -= amt;
        this.spawnParticles(this.player.x, this.player.y, "#00f0ff", 8);
      } else {
        const remaining = amt - this.player.shield;
        this.player.shield = 0;
        this.player.health -= remaining;
        this.spawnParticles(this.player.x, this.player.y, "#ff1744", 10);
      }
    } else {
      this.player.health -= amt;
      this.spawnParticles(this.player.x, this.player.y, "#ff1744", 12);
    }

    this.updateHUD();

    if (this.player.health <= 0) {
      this.gameOver();
    }
  }

  collectPowerup(type) {
    this.audio.playPowerup();
    this.haptic(35);

    if (type === "UPGRADE") {
      this.player.weaponTier = Math.min(4, this.player.weaponTier + 1);
      this.spawnPopups(this.player.x, this.player.y - 25, `WEAPON UPGRADED: TIER ${this.player.weaponTier}!`, "#00ff66");
    } else if (type === "SHIELD") {
      this.player.shield = Math.min(this.player.maxShield, this.player.shield + 50);
      this.spawnPopups(this.player.x, this.player.y - 25, "SHIELD RECHARGED +50!", "#00f0ff");
    } else if (type === "BOMB") {
      this.bombs = Math.min(5, this.bombs + 1);
      this.spawnPopups(this.player.x, this.player.y - 25, "+1 EMP BOMB ACQUIRED!", "#ffcc00");
    }
    this.updateHUD();
  }

  checkShipCollision(p, e) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    return d < (p.w / 2 + e.w / 2);
  }

  spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: Math.random() * 3 + 2,
        color,
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  spawnPopups(x, y, text, color) {
    this.popups.push({ x, y, text, color, vy: -1.0, alpha: 1.0, decay: 0.015 });
  }

  gameOver() {
    this.state = "GAMEOVER";
    this.haptic(100);
    if (this.dom.finalScore) this.dom.finalScore.textContent = this.score;
    if (this.dom.gameOverModal) this.dom.gameOverModal.classList.remove("hidden");
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Starfield
    ctx.fillStyle = "#ffffff";
    this.stars.forEach(s => {
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.globalAlpha = 1.0;

    // Player Ship
    if (this.state === "PLAYING" || this.state === "PAUSED") {
      const isFlicker = this.player.invulnTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0;
      if (!isFlicker) {
        ctx.save();
        ctx.translate(this.player.x, this.player.y);

        // Neon Thruster plume
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-6, 16);
        ctx.lineTo(0, 24 + Math.random() * 6);
        ctx.lineTo(6, 16);
        ctx.fill();

        // Hull
        ctx.fillStyle = "#0d1828";
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(16, 14);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-16, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit canopy
        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(4, 0);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();

        // Energy Shield Ring
        if (this.player.shield > 0) {
          ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
          ctx.shadowColor = "#00f0ff";
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    // Player Bullets
    ctx.save();
    ctx.fillStyle = "#00ff88";
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 10;
    this.bullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 7, 4, 14);
    });
    ctx.restore();

    // Enemy Bullets
    ctx.save();
    ctx.fillStyle = "#ff1744";
    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = 8;
    this.enemyBullets.forEach(eb => {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);

      const color = e.type === "CRUISER" ? "#ff0077" : (e.type === "INTERCEPTOR" ? "#ffcc00" : "#b55fe6");
      ctx.fillStyle = "#121324";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (e.type === "CRUISER") {
        ctx.moveTo(0, 18);
        ctx.lineTo(20, -14);
        ctx.lineTo(0, -6);
        ctx.lineTo(-20, -14);
      } else {
        ctx.moveTo(0, 14);
        ctx.lineTo(14, -12);
        ctx.lineTo(0, -6);
        ctx.lineTo(-14, -12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Enemy Health Bar if damaged
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(-15, -20, 30, 3);
        ctx.fillStyle = "#00ff66";
        ctx.fillRect(-15, -20, (e.hp / e.maxHp) * 30, 3);
      }
      ctx.restore();
    });

    // Boss
    if (this.boss) {
      ctx.save();
      ctx.translate(this.boss.x, this.boss.y);

      // Boss Dreadnought Hull
      ctx.fillStyle = "#0d111d";
      ctx.strokeStyle = "#ff1744";
      ctx.shadowColor = "#ff1744";
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(55, 10);
      ctx.lineTo(45, -35);
      ctx.lineTo(0, -20);
      ctx.lineTo(-45, -35);
      ctx.lineTo(-55, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Core
      ctx.fillStyle = "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 5, 14, 0, Math.PI * 2);
      ctx.fill();

      // Boss Health Bar
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(-50, -48, 100, 7);
      ctx.fillStyle = "#ff1744";
      ctx.fillRect(-50, -48, Math.max(0, (this.boss.hp / this.boss.maxHp) * 100), 7);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.strokeRect(-50, -48, 100, 7);

      ctx.restore();
    }

    // Powerups
    this.powerups.forEach(p => {
      ctx.save();
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00ff66";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const icon = { UPGRADE: "⚡", SHIELD: "🛡️", BOMB: "💣" }[p.type] || "★";
      ctx.fillText(icon, p.x, p.y + 4);
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
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

function launchCyberStrike() {
  if (!window.cyberStrikeInstance) {
    try {
      window.cyberStrikeInstance = new CyberStrike();
      console.log("Cyber Strike initialized successfully!");
    } catch (err) {
      console.error("Failed to initialize Cyber Strike:", err);
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", launchCyberStrike);
  } else {
    launchCyberStrike();
  }
  window.addEventListener("load", launchCyberStrike);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CyberStrike };
}
