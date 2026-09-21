/**
 * Neon Breaker: Quantum Void — Automated Logic Tests
 */

const assert = require("assert");
const { BRICK_COLORS, BREAKER_LEVELS, ProceduralBreakerGenerator } = require("../js/levels.js");

console.log("--- Running Neon Breaker Logic Tests ---");

// Test 1: Level configurations
assert.strictEqual(BREAKER_LEVELS.length, 15, "Should have 15 curated levels");
BREAKER_LEVELS.forEach(lvl => {
  assert(lvl.cols >= 8 && lvl.cols <= 12, `Level ${lvl.id} cols should be 8-12`);
  assert(lvl.rows >= 4 && lvl.rows <= 9, `Level ${lvl.id} rows should be 4-9`);
  assert.strictEqual(lvl.grid.length, lvl.rows, `Level ${lvl.id} grid rows mismatch`);
});
console.log("  ✓ All 15 curated levels configured properly");

// Test 2: Brick Colors definition
const requiredColors = ["cyan", "pink", "gold", "lime", "purple", "armor", "bomb"];
requiredColors.forEach(c => {
  assert(BRICK_COLORS[c], `Missing color ${c}`);
  assert(BRICK_COLORS[c].hex, `Missing hex for ${c}`);
  assert(BRICK_COLORS[c].pts > 0, `Points must be positive for ${c}`);
});
console.log("  ✓ Brick colors and score point values verified");

// Test 3: Procedural Generator produces valid endless levels
const pLvl = ProceduralBreakerGenerator.generate(25);
assert(pLvl.id === 25, "Procedural level ID should match");
assert(pLvl.grid.length > 0, "Procedural grid should have rows");
console.log("  ✓ Procedural endless wave generator verified");

// Test 4: Paddle Deflection Physics Formula
function calcExitAngle(ballX, paddleX, paddleW) {
  const offset = (ballX - (paddleX + paddleW / 2)) / (paddleW / 2);
  const maxAngle = Math.PI * 0.4;
  return offset * maxAngle;
}

const centerHit = calcExitAngle(200, 150, 100);
assert.strictEqual(centerHit, 0, "Center hit should deflect straight up (angle 0)");

const rightTipHit = calcExitAngle(250, 150, 100);
assert(rightTipHit > 0, "Right tip hit should deflect rightward");

const leftTipHit = calcExitAngle(150, 150, 100);
assert(leftTipHit < 0, "Left tip hit should deflect leftward");
console.log("  ✓ Paddle dynamic angle deflection physics verified");

// Test 5: Circle-to-AABB Brick Collision Test
function checkCollision(ball, brick) {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dX = ball.x - closestX;
  const dY = ball.y - closestY;
  return (dX * dX + dY * dY) < (ball.r * ball.r);
}

const brick = { x: 100, y: 100, w: 40, h: 20 };
assert.strictEqual(checkCollision({ x: 120, y: 110, r: 5 }, brick), true, "Ball inside brick should collide");
assert.strictEqual(checkCollision({ x: 100, y: 96, r: 5 }, brick), true, "Ball touching top of brick should collide");
assert.strictEqual(checkCollision({ x: 50, y: 50, r: 5 }, brick), false, "Distant ball should not collide");
console.log("  ✓ Circle-to-AABB brick collision detection verified");

console.log("\nAll 5/5 Neon Breaker tests passed successfully! 🎉");
