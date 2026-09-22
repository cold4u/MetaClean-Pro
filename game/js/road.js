/**
 * Road & Environment Engine
 * Handles multi-lane highway rendering, scrolling road markings,
 * roadside scenery (trees, light poles, barriers), and collectible items.
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
    this.lineTo(x + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

class Road {
  constructor(canvasWidth, canvasHeight, laneCount = 4) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.laneCount = laneCount;

    // Road dimensions
    this.roadWidth = Math.min(canvasWidth * 0.78, 360);
    this.left = (canvasWidth - this.roadWidth) / 2;
    this.right = this.left + this.roadWidth;
    this.laneWidth = this.roadWidth / this.laneCount;

    // Scrolling states
    this.offsetY = 0;
    this.dashLength = 36;
    this.dashGap = 28;

    // Road Curvature & Banking (Studio OutRun Perspective)
    this.currentCurve = 0;
    this.targetCurve = 0;
    this.curveTimer = 0;

    // Cyberpunk Parallax Night Skyline
    this.stars = [];
    this.skyline = [];
    this.initHorizon();

    // Roadside scenery items
    this.scenery = [];
    this.initScenery();

    // Collectibles (Coins, Nitro cans, Repair kits)
    this.collectibles = [];
    this.distanceSinceLastSpawn = 0;
    this.spawnInterval = 280; // pixels of travel before considering spawn
  }

  getCurveOffset(y = 560) {
    const factor = Math.max(0, 1 - (y / this.canvasHeight));
    return this.currentCurve * (factor * factor);
  }

  getLaneCenter(laneIndex, y = 560) {
    const safeIndex = Math.max(0, Math.min(this.laneCount - 1, laneIndex));
    return this.left + (safeIndex + 0.5) * this.laneWidth + this.getCurveOffset(y);
  }

  initHorizon() {
    this.stars = [];
    for (let i = 0; i < 35; i++) {
      this.stars.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * 85,
        radius: 0.6 + Math.random() * 1.4,
        twinkleSpeed: 0.02 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2
      });
    }

    this.skyline = [];
    let curX = -20;
    while (curX < this.canvasWidth + 50) {
      const w = 18 + Math.random() * 24;
      const h = 24 + Math.random() * 45;
      const windows = [];
      for (let wy = 8; wy < h - 6; wy += 8) {
        for (let wx = 4; wx < w - 4; wx += 6) {
          if (Math.random() > 0.45) {
            const pal = ['#ffd700', '#00f0ff', '#ff0055', '#ffffff'];
            windows.push({ x: wx, y: wy, color: pal[Math.floor(Math.random() * pal.length)] });
          }
        }
      }
      this.skyline.push({
        x: curX,
        width: w,
        height: h,
        windows: windows,
        color: Math.random() > 0.5 ? '#0c1222' : '#121a30'
      });
      curX += w + 2;
    }
  }

  initScenery() {
    this.scenery = [];
    // Populate roadside scenery along left and right shoulders
    for (let y = -100; y < this.canvasHeight + 100; y += 120) {
      // Left side trees and lamp posts
      this.scenery.push({
        side: 'left',
        x: this.left - 24,
        y: y,
        type: Math.random() > 0.4 ? 'tree' : 'lamp'
      });
      // Right side trees and lamp posts
      this.scenery.push({
        side: 'right',
        x: this.right + 24,
        y: y + 60,
        type: Math.random() > 0.4 ? 'tree' : 'lamp'
      });
    }
  }

  update(speed, dt = 16.667) {
    const dtNorm = Math.min(2.0, Math.max(0.4, dt / 16.667));
    const step = speed * dtNorm;

    // Smooth road curvature transitions
    this.curveTimer += dtNorm;
    if (this.curveTimer > 280) {
      this.curveTimer = 0;
      const targets = [-26, 0, 26, 0];
      this.targetCurve = targets[Math.floor(Math.random() * targets.length)];
    }
    this.currentCurve += (this.targetCurve - this.currentCurve) * (0.015 * dtNorm);

    // Twinkle background stars
    for (const star of this.stars) {
      star.phase += star.twinkleSpeed * dtNorm;
    }

    // Scroll road texture and lane dividers (smooth continuous sub-pixel scrolling)
    this.offsetY = (this.offsetY + step) % (this.dashLength + this.dashGap);

    // Scroll and recycle roadside scenery
    for (const item of this.scenery) {
      item.y += step;
      if (item.y > this.canvasHeight + 100) {
        item.y -= (this.canvasHeight + 200);
        item.type = Math.random() > 0.4 ? 'tree' : 'lamp';
      }
    }

    // Scroll collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.y += step;
      if (c.rotation !== undefined) {
        c.rotation += 0.05 * dtNorm;
      }
      // Remove off-screen collectibles
      if (c.y > this.canvasHeight + 100 || c.collected) {
        this.collectibles.splice(i, 1);
      }
    }

    // Spawn new collectibles periodically
    this.distanceSinceLastSpawn += step;
    if (this.distanceSinceLastSpawn >= this.spawnInterval) {
      this.distanceSinceLastSpawn = 0;
      this.spawnCollectible();
    }
  }

  spawnCollectible() {
    // Max active collectibles
    if (this.collectibles.length >= 6) return;

    const lane = Math.floor(Math.random() * this.laneCount);
    const x = this.getLaneCenter(lane);
    const y = -80;

    const rand = Math.random();
    if (rand < 0.52) {
      // Coin: common (+points & score)
      this.collectibles.push({
        type: 'coin',
        x: x,
        y: y,
        radius: 14,
        rotation: 0,
        collected: false
      });
    } else if (rand < 0.72) {
      // Nitro Boost Canister: refills boost
      this.collectibles.push({
        type: 'nitro',
        x: x,
        y: y,
        width: 22,
        height: 32,
        collected: false
      });
    } else if (rand < 0.88) {
      // Rocket Ammo Crate: +3 missiles
      this.collectibles.push({
        type: 'rocket',
        x: x,
        y: y,
        width: 26,
        height: 26,
        collected: false
      });
    } else {
      // Repair Kit: repairs damage
      this.collectibles.push({
        type: 'repair',
        x: x,
        y: y,
        width: 26,
        height: 26,
        collected: false
      });
    }
  }

  checkCollectibles(player) {
    const hits = [];
    const pBounds = player.getBounds();

    for (const c of this.collectibles) {
      if (c.collected) continue;

      let hit = false;
      if (c.type === 'coin') {
        // Circle vs rectangle collision
        const closestX = Math.max(pBounds.x, Math.min(c.x, pBounds.x + pBounds.width));
        const closestY = Math.max(pBounds.y, Math.min(c.y, pBounds.y + pBounds.height));
        const distSq = (c.x - closestX) ** 2 + (c.y - closestY) ** 2;
        hit = distSq < (c.radius ** 2);
      } else {
        // AABB rectangle collision
        hit = (
          pBounds.x < c.x + c.width / 2 &&
          pBounds.x + pBounds.width > c.x - c.width / 2 &&
          pBounds.y < c.y + c.height / 2 &&
          pBounds.y + pBounds.height > c.y - c.height / 2
        );
      }

      if (hit) {
        c.collected = true;
        hits.push(c.type);
      }
    }
    return hits;
  }

  draw(ctx, player = null) {
    // 1. Draw Starry Night Horizon & Cyberpunk Skyline
    this.drawHorizon(ctx, player);

    // 2. Draw Curved Road Surface, Kerbs, and Glow Lines
    this.drawCurvedRoad(ctx);

    // 3. Draw Roadside Scenery (Trees, Street Lamps, and Curve Chevrons)
    this.drawScenery(ctx);

    // 4. Draw Collectibles
    this.drawCollectibles(ctx);
  }

  drawHorizon(ctx, player) {
    // Cyberpunk gradient sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 110);
    skyGrad.addColorStop(0, '#040711');
    skyGrad.addColorStop(0.7, '#0b1124');
    skyGrad.addColorStop(1, '#1b1233');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.canvasWidth, 110);

    // Twinkling stars
    for (const s of this.stars) {
      const alpha = 0.35 + Math.sin(s.phase) * 0.45;
      ctx.fillStyle = `rgba(220, 240, 255, ${Math.max(0.1, alpha)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant Synthwave Horizon Moon
    ctx.save();
    ctx.shadowColor = 'rgba(255, 0, 85, 0.4)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255, 50, 120, 0.15)';
    ctx.beginPath();
    ctx.arc(this.canvasWidth / 2 + this.currentCurve * 0.4, 60, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 230, 240, 0.6)';
    ctx.beginPath();
    ctx.arc(this.canvasWidth / 2 + this.currentCurve * 0.4, 60, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Parallax Skyline Buildings
    const parallaxShift = player ? -player.vx * 2.2 : 0;
    for (const b of this.skyline) {
      const bx = b.x + parallaxShift + (this.currentCurve * 0.3);
      const by = 110 - b.height;

      // Building silhouette
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.width, b.height);

      // Roof antenna
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(bx + b.width / 2 - 1, by - 6, 2, 6);

      // Glowing windows
      for (const w of b.windows) {
        ctx.fillStyle = w.color;
        ctx.fillRect(bx + w.x, by + w.y, 3, 4);
      }
    }

    // Horizon separation line
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(this.canvasWidth, 110);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawCurvedRoad(ctx) {
    const sliceH = 14;
    const curbW = 10;

    for (let y = 110; y < this.canvasHeight; y += sliceH) {
      const nextY = Math.min(this.canvasHeight, y + sliceH);
      const offsetTop = this.getCurveOffset(y);
      const offsetBot = this.getCurveOffset(nextY);

      const leftTop = this.left + offsetTop;
      const leftBot = this.left + offsetBot;
      const rightTop = this.right + offsetTop;
      const rightBot = this.right + offsetBot;

      // 1. Shoulders
      ctx.fillStyle = '#0a1017';
      ctx.fillRect(0, y, leftTop, nextY - y);
      ctx.fillRect(rightTop, y, this.canvasWidth - rightTop, nextY - y);

      // 2. Asphalt Surface
      ctx.fillStyle = '#1a202b';
      ctx.beginPath();
      ctx.moveTo(leftTop, y);
      ctx.lineTo(rightTop, y);
      ctx.lineTo(rightBot, nextY);
      ctx.lineTo(leftBot, nextY);
      ctx.closePath();
      ctx.fill();

      // 3. Alternating Kerb Curbs
      const isRed = Math.floor((y - this.offsetY) / 24) % 2 === 0;
      ctx.fillStyle = isRed ? '#e71d36' : '#ffffff';

      // Left curb polygon
      ctx.beginPath();
      ctx.moveTo(leftTop - curbW, y);
      ctx.lineTo(leftTop, y);
      ctx.lineTo(leftBot, nextY);
      ctx.lineTo(leftBot - curbW, nextY);
      ctx.closePath();
      ctx.fill();

      // Right curb polygon
      ctx.beginPath();
      ctx.moveTo(rightTop, y);
      ctx.lineTo(rightTop + curbW, y);
      ctx.lineTo(rightBot + curbW, nextY);
      ctx.lineTo(rightBot, nextY);
      ctx.closePath();
      ctx.fill();

      // 4. Glowing Neon Edge Lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(leftTop, y);
      ctx.lineTo(leftBot, nextY);
      ctx.moveTo(rightTop, y);
      ctx.lineTo(rightBot, nextY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 5. Curved Dashed Lane Dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 2.5;

    for (let lane = 1; lane < this.laneCount; lane++) {
      for (let y = 110; y < this.canvasHeight; y += 14) {
        const dashPhase = (y - this.offsetY) % (this.dashLength + this.dashGap);
        if (dashPhase >= 0 && dashPhase < this.dashLength) {
          const topX = this.left + lane * this.laneWidth + this.getCurveOffset(y);
          const botX = this.left + lane * this.laneWidth + this.getCurveOffset(y + 14);
          ctx.beginPath();
          ctx.moveTo(topX, y);
          ctx.lineTo(botX, y + 14);
          ctx.stroke();
        }
      }
    }
  }

  drawScenery(ctx) {
    // Curve Chevron Warning Indicators when approaching bend
    if (Math.abs(this.currentCurve) > 10) {
      ctx.save();
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      const arrowTxt = this.currentCurve > 0 ? '▶ ▶ ▶' : '◀ ◀ ◀';
      const arrowX = this.currentCurve > 0 ? this.right + this.getCurveOffset(180) + 16 : this.left + this.getCurveOffset(180) - 75;
      ctx.fillText(arrowTxt, arrowX, 180);
      ctx.restore();
    }

    for (const item of this.scenery) {
      if (item.y < 100) continue;
      const curveX = this.getCurveOffset(item.y);
      const posX = item.x + curveX;

      if (item.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(posX - 3, item.y + 4, 6, 12);
        // Foliage layers
        ctx.fillStyle = '#1b4d3e';
        ctx.beginPath();
        ctx.arc(posX, item.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(posX, item.y - 4, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'lamp') {
        // Pole
        ctx.fillStyle = '#718096';
        ctx.fillRect(posX - 2, item.y - 10, 4, 26);
        // Light head
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(posX, item.y - 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  drawCollectibles(ctx) {
    for (const c of this.collectibles) {
      if (c.type === 'coin') {
        ctx.save();
        ctx.translate(c.x, c.y);
        // Golden halo
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;

        // Rotating ellipse coin simulation
        const scaleX = Math.cos(c.rotation || 0);
        ctx.scale(Math.abs(scaleX) * 0.7 + 0.3, 1);

        // Outer coin
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner rim
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, c.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        // Star / Symbol
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 1);

        ctx.restore();
      } else if (c.type === 'nitro') {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;

        // Canister Body
        ctx.fillStyle = '#0077ff';
        ctx.beginPath();
        ctx.roundRect(-c.width / 2, -c.height / 2, c.width, c.height, 5);
        ctx.fill();

        // Cap
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-c.width / 4, -c.height / 2 - 4, c.width / 2, 4);

        // Lightning Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);

        ctx.restore();
      } else if (c.type === 'rocket') {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 14;

        // Rocket Ammo Crate
        ctx.fillStyle = '#2b0b14';
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-c.width / 2, -c.height / 2, c.width, c.height, 4);
        ctx.fill();
        ctx.stroke();

        // Missile Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚀', 0, 0);

        ctx.restore();
      } else if (c.type === 'repair') {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 12;

        // Medkit box
        ctx.fillStyle = '#103b2b';
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-c.width / 2, -c.height / 2, c.width, c.height, 4);
        ctx.fill();
        ctx.stroke();

        // Green Plus / Wrench
        ctx.fillStyle = '#00ff88';
        const crossW = 6;
        const crossH = 14;
        ctx.fillRect(-crossW / 2, -crossH / 2, crossW, crossH);
        ctx.fillRect(-crossH / 2, -crossW / 2, crossH, crossW);

        ctx.restore();
      }
    }
  }

  reset() {
    this.offsetY = 0;
    this.collectibles = [];
    this.distanceSinceLastSpawn = 0;
  }
}

// Export for Node test environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Road };
}
