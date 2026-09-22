const assert = require('assert');
const { TowerGame } = require('../js/tower.js');

console.log("=== RUNNING MATRIX TOWER DEFENSE LOGIC TESTS ===");

const game = new TowerGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.credits, 350);
assert.strictEqual(game.coreHP, 20);
assert.strictEqual(game.sockets.length, 10);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Build Tower on socket
const built = game.buildTower(0, "pulse"); // Cost: 100
assert.strictEqual(built, true, "Pulse tower successfully built");
assert.strictEqual(game.credits, 250, "Credits deducted (350 - 100 = 250)");
assert.ok(game.sockets[0].tower, "Socket 0 has active tower");
console.log("✔ Test 2 passed: Tower building and credit economics");

// Test 3: Upgrade Tower
const upgraded = game.upgradeTower(0); // Cost: 80
assert.strictEqual(upgraded, true, "Tower upgraded to level 2");
assert.strictEqual(game.sockets[0].tower.level, 2);
assert.strictEqual(game.credits, 170, "Credits deducted for upgrade (250 - 80 = 170)");
console.log("✔ Test 3 passed: Tower upgrade tier progression");

// Test 4: Insufficient credits rejected
game.credits = 10;
const rejected = game.buildTower(1, "rocket"); // Cost: 250
assert.strictEqual(rejected, false, "Cannot build without required credits");
console.log("✔ Test 4 passed: Economy guardrails");

// Test 5: Tower attacks enemy in range
game.state = "PLAYING";
game.sockets[0].tower.timer = game.sockets[0].tower.interval;
game.enemies = [{
  x: game.sockets[0].x + 20,
  y: game.sockets[0].y + 20,
  hp: 50,
  maxHp: 50,
  speed: 10,
  reward: 15,
  wpIdx: 0
}];
game.update(16);
assert.ok(game.enemies[0].hp < 50, "Enemy took projectile damage from tower");
assert.ok(game.projectiles.length > 0, "Laser visual fired");
console.log("✔ Test 5 passed: Tower targeting & firing");

// Test 6: Core damage on enemy breach
game.enemies = [{
  x: game.waypoints[game.waypoints.length - 1].x,
  y: game.waypoints[game.waypoints.length - 1].y,
  wpIdx: game.waypoints.length - 2,
  hp: 20,
  maxHp: 20,
  speed: 100,
  reward: 10
}];
game.update(100);
assert.ok(game.coreHP < 20, "Core damaged by breached enemy");
console.log("✔ Test 6 passed: Core breach damage");

console.log("\nALL 6 MATRIX TOWER DEFENSE LOGIC TESTS PASSED! 🏰✨\n");
