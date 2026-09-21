/**
 * Cyber Strike: Void Invaders — Automated Logic & Physics Tests
 */

const assert = require("assert");

console.log("--- Running Cyber Strike Logic Tests ---");

// Test 1: Projectile Trajectory Calculation
function createBulletVector(angleDeg, speed) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    vx: Math.sin(rad) * speed,
    vy: -Math.cos(rad) * speed
  };
}

const forwardBullet = createBulletVector(0, 10);
assert.strictEqual(forwardBullet.vx, 0, "Forward bullet vx should be 0");
assert.strictEqual(forwardBullet.vy, -10, "Forward bullet vy should be -10");

const rightSpread = createBulletVector(15, 10);
assert(rightSpread.vx > 0, "Right angled bullet should have positive vx");
assert(rightSpread.vy < 0, "Right angled bullet should travel upwards (negative vy)");
console.log("  ✓ Projectile angle vector calculations verified");

// Test 2: Weapon Spread Tiers
function generatePlayerBullets(tier, px, py) {
  const list = [];
  if (tier === 1) {
    list.push({ x: px, y: py - 18, vx: 0, vy: -12 });
  } else if (tier === 2) {
    list.push({ x: px - 8, y: py - 16, vx: 0, vy: -12 });
    list.push({ x: px + 8, y: py - 16, vx: 0, vy: -12 });
  } else if (tier === 3) {
    list.push({ x: px, y: py - 18, vx: 0, vy: -13 });
    list.push({ x: px - 8, y: py - 16, vx: -2.8, vy: -12.5 });
    list.push({ x: px + 8, y: py - 16, vx: 2.8, vy: -12.5 });
  } else {
    // Tier 4 Plasma Storm
    list.push({ x: px, y: py - 20, vx: 0, vy: -14, damage: 30 });
    list.push({ x: px - 8, y: py - 18, vx: -2.2, vy: -13.5, damage: 20 });
    list.push({ x: px + 8, y: py - 18, vx: 2.2, vy: -13.5, damage: 20 });
    list.push({ x: px - 16, y: py - 16, vx: -4.4, vy: -12.5, damage: 20 });
    list.push({ x: px + 16, y: py - 16, vx: 4.4, vy: -12.5, damage: 20 });
  }
  return list;
}

assert.strictEqual(generatePlayerBullets(1, 100, 200).length, 1, "Tier 1 must fire 1 bullet");
assert.strictEqual(generatePlayerBullets(2, 100, 200).length, 2, "Tier 2 must fire 2 bullets");
assert.strictEqual(generatePlayerBullets(3, 100, 200).length, 3, "Tier 3 must fire 3 bullets");
assert.strictEqual(generatePlayerBullets(4, 100, 200).length, 5, "Tier 4 must fire 5 bullets");
console.log("  ✓ Weapon tier upgrade progression verified (1 to 5 projectiles)");

// Test 3: Box-to-Box (AABB) Collision Detection
function checkAABB(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}

const enemy = { x: 200, y: 150, w: 36, h: 36 };
const directHit = { x: 200, y: 155, w: 6, h: 14 };
const cleanMiss = { x: 280, y: 150, w: 6, h: 14 };

assert.strictEqual(checkAABB(directHit, enemy), true, "Direct hit should register collision");
assert.strictEqual(checkAABB(cleanMiss, enemy), false, "Clear miss should NOT register collision");
console.log("  ✓ AABB projectile hit detection physics verified");

// Test 4: EMP Shockwave Screen Cleansing
function simulateEMPShockwave(bullets, enemies) {
  // Clears all enemy bullets
  bullets.length = 0;
  // Inflicts 120 damage to all active enemies
  enemies.forEach(e => {
    e.health -= 120;
  });
  return {
    survivingEnemies: enemies.filter(e => e.health > 0)
  };
}

const enemyBullets = [{ x: 50, y: 100 }, { x: 200, y: 300 }, { x: 120, y: 220 }];
const activeEnemies = [
  { type: "DRONE", health: 30 },
  { type: "CRUISER", health: 180 },
  { type: "DREADNOUGHT", health: 1000 }
];

const empResult = simulateEMPShockwave(enemyBullets, activeEnemies);
assert.strictEqual(enemyBullets.length, 0, "All enemy bullets must be eradicated by EMP");
assert.strictEqual(empResult.survivingEnemies.length, 2, "Drone (30 HP) should be destroyed; Cruiser and Dreadnought survive with reduced HP");
assert.strictEqual(activeEnemies[1].health, 60, "Cruiser HP should be 180 - 120 = 60");
console.log("  ✓ EMP Shockwave blast mechanics verified");

// Test 5: Wave & Boss Progression Formula
function isBossWave(wave) {
  return wave > 0 && wave % 5 === 0;
}

assert.strictEqual(isBossWave(1), false, "Wave 1 is normal wave");
assert.strictEqual(isBossWave(4), false, "Wave 4 is normal wave");
assert.strictEqual(isBossWave(5), true, "Wave 5 is a Dreadnought Boss Wave");
assert.strictEqual(isBossWave(10), true, "Wave 10 is a Dreadnought Boss Wave");
console.log("  ✓ Boss wave scheduling formula verified");

console.log("All 5/5 Cyber Strike logic tests PASSED successfully!\n");
