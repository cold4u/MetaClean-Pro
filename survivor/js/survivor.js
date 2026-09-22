/**
 * Cyber Survivor: Neural Surge — Arcade Engine
 * Roguelite bullet-heaven auto-shooter with upgrade drafting, synergies, meta-shop, and swarms.
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

class SurvivorGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 540;
    this.height = canvas ? canvas.height : 540;
    this.audio = audio || {
      init: () => {},
      playShoot: () => {},
      playHit: () => {},
      playGem: () => {},
      playLevelUp: () => {},
      playGameOver: () => {}
    };

    // States
    this.state = "START"; // START, PLAYING, LEVELUP, PAUSED, GAMEOVER
    this.survivalTime = 0; // seconds
    this.score = 0;
    this.highScore = this.loadHighScore();

    // Meta Upgrades
    this.meta = this.loadMeta();

    // Player
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      radius: 14,
      hp: 100,
      maxHp: 100,
      speed: 180,
      magnetRadius: 90,
      level: 1,
      xp: 0,
      xpToNext: 10,
      vx: 0,
      vy: 0,
      discAngle: 0
    };

    // Weapons
    this.weapons = {
      gatling: { level: 1, timer: 0, interval: 320, dmg: 15 },
      plasmaDiscs: { level: 0, count: 0, dmg: 18, radius: 55 },
      teslaChain: { level: 0, timer: 0, interval: 1400, dmg: 35, chains: 3 },
      missiles: { level: 0, timer: 0, interval: 1600, dmg: 50 }
    };

    // Controls
    this.input = { x: 0, y: 0 };

    // Entities
    this.enemies = [];
    this.bullets = [];
    this.gems = [];
    this.particles = [];

    // Spawner
    this.spawnTimer = 0;
    this.spawnInterval = 800; // ms

    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("cyber_survivor_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cyber_survivor_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  loadMeta() {
    try {
      if (typeof localStorage !== "undefined") {
        return {
          chips: parseInt(localStorage.getItem("survivor_chips") || "0", 10),
          hpTier: parseInt(localStorage.getItem("survivor_meta_hp") || "0", 10),
          speedTier: parseInt(localStorage.getItem("survivor_meta_speed") || "0", 10),
          magnetTier: parseInt(localStorage.getItem("survivor_meta_magnet") || "0", 10)
        };
      }
    } catch (_) {}
    return { chips: 0, hpTier: 0, speedTier: 0, magnetTier: 0 };
  }

  saveMeta() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("survivor_chips", String(this.meta.chips));
        localStorage.setItem("survivor_meta_hp", String(this.meta.hpTier));
        localStorage.setItem("survivor_meta_speed", String(this.meta.speedTier));
        localStorage.setItem("survivor_meta_magnet", String(this.meta.magnetTier));
      }
    } catch (_) {}
  }

  applyMeta() {
    const p = this.player;
    p.maxHp = 100 + this.meta.hpTier * 25;
    p.hp = p.maxHp;
    p.speed = 180 + this.meta.speedTier * 18;
    p.magnetRadius = 90 + this.meta.magnetTier * 35;
  }

  reset() {
    this.survivalTime = 0;
    this.score = 0;
    this.player.x = this.width / 2;
    this.player.y = this.height / 2;
    this.player.level = 1;
    this.player.xp = 0;
    this.player.xpToNext = 10;
    this.player.discAngle = 0;
    this.applyMeta();

    this.weapons = {
      gatling: { level: 1, timer: 0, interval: 320, dmg: 15 },
      plasmaDiscs: { level: 0, count: 0, dmg: 18, radius: 55 },
      teslaChain: { level: 0, timer: 0, interval: 1400, dmg: 35, chains: 3 },
      missiles: { level: 0, timer: 0, interval: 1600, dmg: 50 }
    };

    this.enemies = [];
    this.bullets = [];
    this.gems = [];
    this.particles = [];
    this.spawnTimer = 0;
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

  getPerkOptions() {
    const pool = [
      { id: "gatling", name: "Pulse Gatling +1", desc: "Increases gatling fire rate and damage" },
      { id: "discs", name: "Plasma Discs +1", desc: "Adds/upgrades rotating plasma blades around player" },
      { id: "tesla", name: "Tesla Chain +1", desc: "Discharges chain lightning across multiple enemies" },
      { id: "missiles", name: "Micro Missiles +1", desc: "Fires homing explosive rockets at toughest target" },
      { id: "heal", name: "Nano Repair", desc: "Instantly restores 40 HP" },
      { id: "speed", name: "Hyper Drive", desc: "+15% Movement Velocity" }
    ];

    // Pick 3 random
    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }

  applyPerk(perkId) {
    if (perkId === "gatling") {
      this.weapons.gatling.level++;
      this.weapons.gatling.interval = Math.max(120, this.weapons.gatling.interval - 40);
      this.weapons.gatling.dmg += 6;
    } else if (perkId === "discs") {
      this.weapons.plasmaDiscs.level++;
      this.weapons.plasmaDiscs.count = Math.min(5, this.weapons.plasmaDiscs.level);
      this.weapons.plasmaDiscs.dmg += 8;
    } else if (perkId === "tesla") {
      this.weapons.teslaChain.level++;
      this.weapons.teslaChain.chains += 1;
      this.weapons.teslaChain.dmg += 12;
      this.weapons.teslaChain.interval = Math.max(800, this.weapons.teslaChain.interval - 150);
    } else if (perkId === "missiles") {
      this.weapons.missiles.level++;
      this.weapons.missiles.dmg += 20;
      this.weapons.missiles.interval = Math.max(700, this.weapons.missiles.interval - 200);
    } else if (perkId === "heal") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    } else if (perkId === "speed") {
      this.player.speed *= 1.15;
    }

    this.state = "PLAYING";
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.width / 2 + 50;
    const ex = this.player.x + Math.cos(angle) * dist;
    const ey = this.player.y + Math.sin(angle) * dist;

    const timeMin = this.survivalTime / 60;
    const rand = Math.random();
    let type = "crawler";
    let hp = 15 + Math.floor(timeMin * 10);
    let speed = 75 + Math.min(50, timeMin * 12);
    let radius = 11;
    let color = "#00f0ff";
    let xpValue = 1;

    if (rand < 0.25) {
      type = "brute";
      hp = 45 + Math.floor(timeMin * 25);
      speed = 50;
      radius = 16;
      color = "#ff0077";
      xpValue = 3;
    } else if (rand < 0.45) {
      type = "swarmer";
      hp = 10;
      speed = 110;
      radius = 8;
      color = "#ffd700";
      xpValue = 1;
    }

    this.enemies.push({
      x: ex,
      y: ey,
      hp,
      maxHp: hp,
      speed,
      radius,
      color,
      type,
      xpValue
    });
  }

  createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        size: 3 + Math.random() * 2
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;
    const p = this.player;

    this.survivalTime += deltaSec;
    this.score = Math.floor(this.survivalTime * 10 + p.level * 50);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    // Move player
    const inputMag = Math.hypot(this.input.x, this.input.y);
    if (inputMag > 0.1) {
      const nx = this.input.x / inputMag;
      const ny = this.input.y / inputMag;
      p.x += nx * p.speed * deltaSec;
      p.y += ny * p.speed * deltaSec;

      // Keep within arena bounds
      p.x = Math.max(p.radius, Math.min(this.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(this.height - p.radius, p.y));
    }

    // Rotate plasma discs
    p.discAngle += 3.5 * deltaSec;

    // Spawner
    this.spawnTimer += deltaMs;
    this.spawnInterval = Math.max(300, 800 - Math.floor(this.survivalTime * 5));
    if (this.spawnTimer >= this.spawnInterval && this.enemies.length < 90) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Auto-fire Weapons
    // 1. Gatling
    const wGat = this.weapons.gatling;
    wGat.timer += deltaMs;
    if (wGat.timer >= wGat.interval && this.enemies.length > 0) {
      wGat.timer = 0;
      // Target nearest enemy
      let nearest = null;
      let minD = Infinity;
      this.enemies.forEach(e => {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < minD) { minD = d; nearest = e; }
      });

      if (nearest) {
        const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
        const bSpeed = 420;
        this.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * bSpeed,
          vy: Math.sin(angle) * bSpeed,
          dmg: wGat.dmg,
          life: 1.2,
          radius: 4,
          color: "#00f0ff"
        });
        this.audio.playShoot();
      }
    }

    // 2. Tesla Chain
    const wTesla = this.weapons.teslaChain;
    if (wTesla.level > 0) {
      wTesla.timer += deltaMs;
      if (wTesla.timer >= wTesla.interval && this.enemies.length > 0) {
        wTesla.timer = 0;
        // Shock nearby enemies
        const targets = this.enemies
          .filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 220)
          .slice(0, wTesla.chains);

        targets.forEach(t => {
          t.hp -= wTesla.dmg;
          this.createExplosion(t.x, t.y, "#00ffcc", 5);
        });
        if (targets.length > 0) this.audio.playHit();
      }
    }

    // 3. Micro Missiles
    const wMis = this.weapons.missiles;
    if (wMis.level > 0) {
      wMis.timer += deltaMs;
      if (wMis.timer >= wMis.interval && this.enemies.length > 0) {
        wMis.timer = 0;
        // Target highest HP enemy
        const strongest = [...this.enemies].sort((a, b) => b.hp - a.hp)[0];
        if (strongest) {
          const angle = Math.atan2(strongest.y - p.y, strongest.x - p.x);
          this.bullets.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(angle) * 320,
            vy: Math.sin(angle) * 320,
            dmg: wMis.dmg,
            homing: true,
            target: strongest,
            life: 2.0,
            radius: 6,
            color: "#ff0077"
          });
        }
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.homing && b.target && b.target.hp > 0) {
        const angle = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        b.vx = Math.cos(angle) * 320;
        b.vy = Math.sin(angle) * 320;
      }
      b.x += b.vx * deltaSec;
      b.y += b.vy * deltaSec;
      b.life -= deltaSec;

      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check hit on enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          e.hp -= b.dmg;
          this.createExplosion(b.x, b.y, b.color, 4);
          this.bullets.splice(i, 1);
          break;
        }
      }
    }

    // Plasma Discs Collision
    const wDiscs = this.weapons.plasmaDiscs;
    if (wDiscs.count > 0) {
      for (let i = 0; i < wDiscs.count; i++) {
        const discAngle = p.discAngle + (i * Math.PI * 2) / wDiscs.count;
        const dx = p.x + Math.cos(discAngle) * wDiscs.radius;
        const dy = p.y + Math.sin(discAngle) * wDiscs.radius;

        this.enemies.forEach(e => {
          if (Math.hypot(dx - e.x, dy - e.y) < 9 + e.radius) {
            e.hp -= wDiscs.dmg * deltaSec * 8; // continuous shred
            if (Math.random() < 0.2) this.createExplosion(dx, dy, "#ffd700", 2);
          }
        });
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Check death
      if (e.hp <= 0) {
        this.createExplosion(e.x, e.y, e.color, 12);
        this.gems.push({
          x: e.x,
          y: e.y,
          val: e.xpValue,
          color: e.xpValue >= 3 ? "#ff0077" : "#00f0ff"
        });
        this.meta.chips += e.xpValue;
        this.saveMeta();
        this.enemies.splice(i, 1);
        continue;
      }

      // Move toward player
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(angle) * e.speed * deltaSec;
      e.y += Math.sin(angle) * e.speed * deltaSec;

      // Damage player on contact
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        p.hp -= 18 * deltaSec;
        if (p.hp <= 0) {
          this.triggerGameOver("Neural core desynced by cyber virus swarm!");
          return;
        }
      }
    }

    // Update Gems (magnet & pickup)
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dist = Math.hypot(p.x - g.x, p.y - g.y);

      if (dist < p.magnetRadius) {
        const angle = Math.atan2(p.y - g.y, p.x - g.x);
        const magnetSpeed = 340;
        g.x += Math.cos(angle) * magnetSpeed * deltaSec;
        g.y += Math.sin(angle) * magnetSpeed * deltaSec;
      }

      if (dist < p.radius + 8) {
        p.xp += g.val;
        this.audio.playGem();
        this.gems.splice(i, 1);

        // Check level up
        if (p.xp >= p.xpToNext) {
          p.xp -= p.xpToNext;
          p.level++;
          p.xpToNext = Math.floor(p.xpToNext * 1.35 + 5);
          this.audio.playLevelUp();
          this.state = "LEVELUP";
          if (typeof this.onLevelUp === "function") {
            this.onLevelUp(this.getPerkOptions());
          }
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) this.particles.splice(i, 1);
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.audio.playGameOver();
    this.createExplosion(this.player.x, this.player.y, "#ff0055", 30);
    if (typeof this.onGameOver === "function") {
      this.onGameOver(this.score, msg);
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.player;

    // Background Cyber Grid
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Render Gems
    this.gems.forEach(g => {
      ctx.save();
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Enemy inner core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Bullets
    this.bullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Plasma Discs
    const wDiscs = this.weapons.plasmaDiscs;
    if (wDiscs.count > 0) {
      for (let i = 0; i < wDiscs.count; i++) {
        const discAngle = p.discAngle + (i * Math.PI * 2) / wDiscs.count;
        const dx = p.x + Math.cos(discAngle) * wDiscs.radius;
        const dy = p.y + Math.sin(discAngle) * wDiscs.radius;

        ctx.save();
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render Player
    ctx.save();
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = "#050811";
    ctx.fillRect(p.x - 6, p.y - 4, 12, 6);
    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(p.x - 3, p.y - 3, 6, 4);

    // Magnet aura faint circle
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();

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
  module.exports = { SurvivorGame };
}
