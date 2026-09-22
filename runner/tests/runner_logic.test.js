const assert = require('assert');
const { RunnerGame } = require('../js/runner.js');

console.log("=== RUNNING GRAVITY RUNNER LOGIC TESTS ===");

const game = new RunnerGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.player.gravityDir, 1, "Starts with downward gravity");
assert.strictEqual(game.player.grounded, true, "Starts grounded on floor");
assert.strictEqual(game.score, 0);
assert.strictEqual(game.distance, 0);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Gravity Flip when grounded
game.state = "PLAYING";
const flipped = game.flipGravity();
assert.strictEqual(flipped, true, "Can flip gravity when grounded");
assert.strictEqual(game.player.gravityDir, -1, "Gravity inverted to ceiling (-1)");
assert.strictEqual(game.player.grounded, false, "Leaves surface upon flip");
console.log("✔ Test 2 passed: Gravity Flip");

// Test 3: Reaching ceiling grounds player
// Simulate physics ticks until player reaches ceiling
for (let i = 0; i < 25; i++) {
  game.update(16);
}
assert.strictEqual(game.player.y, game.ceilingY, "Player reached ceiling rail");
assert.strictEqual(game.player.grounded, true, "Player grounded on ceiling");
console.log("✔ Test 3 passed: Reaching ceiling");

// Test 4: Distance & score accumulation
const prevDist = game.distance;
game.update(50);
assert.ok(game.distance >= prevDist, "Distance accumulated with speed");
console.log("✔ Test 4 passed: Distance accumulation");

// Test 5: Collecting energy bit
game.collectibles = [{
  x: game.player.x,
  y: game.player.y,
  w: 18,
  h: 18,
  type: "bit"
}];
const scoreBefore = game.score;
game.update(16);
assert.strictEqual(game.collectibles.length, 0, "Bit collected");
assert.strictEqual(game.score, scoreBefore + 50, "Energy bit awarded 50 points");
console.log("✔ Test 5 passed: Bit collection");

// Test 6: Collecting shield gives immunity
game.collectibles = [{
  x: game.player.x,
  y: game.player.y,
  w: 18,
  h: 18,
  type: "shield"
}];
game.update(16);
assert.ok(game.player.shieldTimer > 0, "Shield timer active");
console.log("✔ Test 6 passed: Shield pickup");

// Test 7: Shield destroys obstacle safely
game.obstacles = [{
  x: game.player.x,
  y: game.player.y,
  w: 24,
  h: 30,
  type: "barrier"
}];
game.update(16);
assert.strictEqual(game.obstacles.length, 0, "Obstacle vaporized by shield");
assert.strictEqual(game.state, "PLAYING", "Player survived due to shield");
console.log("✔ Test 7 passed: Shield protection");

// Test 8: Collision without shield triggers GameOver
game.player.shieldTimer = 0;
game.obstacles = [{
  x: game.player.x,
  y: game.player.y,
  w: 24,
  h: 30,
  type: "barrier"
}];
game.update(16);
assert.strictEqual(game.state, "GAMEOVER", "Barrier collision triggers GAMEOVER");
console.log("✔ Test 8 passed: Collision GameOver");

console.log("\nALL 8 GRAVITY RUNNER LOGIC TESTS PASSED! ⚡✨\n");
