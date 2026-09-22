const assert = require('assert');
const { JumpGame } = require('../js/jump.js');

console.log("=== RUNNING QUANTUM JUMP LOGIC TESTS ===");

const game = new JumpGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.ok(game.platforms.length >= 5, "Initial platforms generated");
assert.strictEqual(game.score, 0);
assert.strictEqual(game.altitude, 0);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Gravity and Jump Velocity
game.state = "PLAYING";
const initialY = game.player.y;
game.player.vy = 0;
game.update(16);
assert.ok(game.player.vy > 0, "Gravity accelerates player downwards");
assert.ok(game.player.y > initialY, "Player position moved downwards");
console.log("✔ Test 2 passed: Gravity physics");

// Test 3: Horizontal movement & border wrap
game.keys.left = true;
game.update(16);
assert.ok(game.player.vx < 0, "Moving left sets negative vx");
assert.strictEqual(game.player.facing, "left");

// Force position past left edge
game.player.x = -20;
game.update(16);
assert.ok(game.player.x > 400, "Left border wrap repositions player to right edge");
console.log("✔ Test 3 passed: Horizontal movement and border wrap");

// Test 4: Landing on Platform triggers bounce
game.player.x = 200;
game.player.y = 300;
game.player.vy = 5; // falling
game.platforms = [{
  x: 180,
  y: 330,
  w: 70,
  h: 14,
  type: "standard",
  broken: false
}];
game.update(16);
assert.strictEqual(game.player.vy, game.jumpVelocity, "Landing on platform resets upward jump velocity");
console.log("✔ Test 4 passed: Platform bounce");

// Test 5: Crumble platform breaks upon contact
game.player.x = 200;
game.player.y = 300;
game.player.vy = 5;
game.platforms = [{
  x: 180,
  y: 330,
  w: 70,
  h: 14,
  type: "crumble",
  broken: false
}];
game.update(16);
assert.strictEqual(game.platforms[0].broken, true, "Crumble platform broke after landing");
console.log("✔ Test 5 passed: Crumble platform");

// Test 6: Spring platform gives super jump
game.player.x = 200;
game.player.y = 300;
game.player.vy = 5;
game.platforms = [{
  x: 180,
  y: 330,
  w: 70,
  h: 14,
  type: "standard",
  hasSpring: true,
  broken: false
}];
game.update(16);
assert.strictEqual(game.player.vy, game.springVelocity, "Spring gives super jump velocity");
console.log("✔ Test 6 passed: Spring booster");

// Test 7: Camera scroll increases altitude and score
game.player.y = 100; // Far above camThreshold (640 * 0.45 = 288)
game.update(16);
assert.ok(game.altitude > 0, "Altitude increased as player moved up");
assert.ok(game.score > 0, "Score increased proportionally to altitude");
console.log("✔ Test 7 passed: Camera scrolling and score tracking");

// Test 8: Fall into abyss triggers Game Over
game.player.y = 700; // Below canvas height + 40
game.update(16);
assert.strictEqual(game.state, "GAMEOVER", "Falling below floor triggers GAMEOVER");
console.log("✔ Test 8 passed: Fall Game Over");

console.log("\nALL 8 QUANTUM JUMP LOGIC TESTS PASSED! 🦘✨\n");
