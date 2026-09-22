const assert = require('assert');
const { DefenseGame } = require('../js/defense.js');

console.log("=== RUNNING NEON DEFENSE LOGIC TESTS ===");

const game = new DefenseGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.coreHP, 100);
assert.strictEqual(game.empCount, 2);
assert.strictEqual(game.score, 0);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Turret Aiming
game.aimAt(game.cx + 100, game.cy);
assert.ok(Math.abs(game.turretAngle) < 0.05, "Turret aims right (angle ~0)");
game.aimAt(game.cx, game.cy + 100);
assert.ok(Math.abs(game.turretAngle - Math.PI / 2) < 0.05, "Turret aims down (angle ~PI/2)");
console.log("✔ Test 2 passed: Turret Aiming");

// Test 3: Firing Plasma Bolts
game.state = "PLAYING";
game.turretAngle = 0;
game.triggerFire();
assert.strictEqual(game.bullets.length, 1, "Single bolt fired");
assert.ok(game.bullets[0].vx > 0, "Bullet moves right along angle");
console.log("✔ Test 3 passed: Plasma bolt firing");

// Test 4: Triple Spread Fire
game.tripleSpreadTimer = 5000;
game.triggerFire();
assert.strictEqual(game.bullets.length, 4, "Fired 3 spread bolts (1 + 3 = 4)");
console.log("✔ Test 4 passed: Triple spread firing");

// Test 5: Bullet destroys enemy and grants score
game.bullets = [{
  x: 200,
  y: 200,
  vx: 0,
  vy: 0,
  radius: 4,
  life: 1.0
}];
game.enemies = [{
  x: 200,
  y: 200,
  hp: 1,
  radius: 10,
  speed: 100,
  pts: 25,
  color: "#00f0ff"
}];
game.update(16);
assert.strictEqual(game.enemies.length, 0, "Enemy destroyed by bullet");
assert.strictEqual(game.score, 25, "Enemy score awarded");
console.log("✔ Test 5 passed: Bullet enemy impact");

// Test 6: EMP Bomb clears all enemies
game.enemies = [
  { x: 100, y: 100, hp: 1, radius: 10, speed: 50, pts: 25, color: "#00f0ff" },
  { x: 400, y: 400, hp: 3, radius: 16, speed: 50, pts: 60, color: "#ff0055" }
];
const empUsed = game.triggerEMP();
assert.strictEqual(empUsed, true, "EMP triggered");
assert.strictEqual(game.empCount, 1, "EMP count decremented");
assert.strictEqual(game.enemies.length, 0, "All enemies wiped by EMP");
assert.strictEqual(game.score, 25 + 25 + 60, "Points awarded for wiped enemies");
console.log("✔ Test 6 passed: EMP clearing");

// Test 7: Enemy damages core
game.enemies = [{
  x: game.cx + 5,
  y: game.cy + 5,
  radius: 10,
  speed: 0,
  type: "scout"
}];
game.update(16);
assert.ok(game.coreHP < 100, "Core damaged by enemy impact");
assert.strictEqual(game.enemies.length, 0, "Impacting enemy removed");
console.log("✔ Test 7 passed: Core impact damage");

// Test 8: Core destruction triggers GameOver
game.coreHP = 10;
game.enemies = [{
  x: game.cx + 5,
  y: game.cy + 5,
  radius: 10,
  speed: 0,
  type: "scout"
}];
game.update(16);
assert.strictEqual(game.coreHP, 0);
assert.strictEqual(game.state, "GAMEOVER", "Core destruction triggers GAMEOVER");
console.log("✔ Test 8 passed: Core destruction GameOver");

console.log("\nALL 8 NEON DEFENSE LOGIC TESTS PASSED! 🛡️✨\n");
