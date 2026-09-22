const assert = require('assert');
const { SnakeGame } = require('../js/snake.js');

console.log("=== RUNNING NEON SNAKE LOGIC TESTS ===");

const game = new SnakeGame(null, null);

// Test 1: Initial state
assert.strictEqual(game.snake.length, 3, "Snake starts with 3 segments");
assert.strictEqual(game.dir.x, 1, "Snake starts moving right");
assert.strictEqual(game.dir.y, 0);
assert.strictEqual(game.score, 0, "Initial score is 0");
assert.ok(game.food, "Food is spawned");
console.log("✔ Test 1 passed: Initialization");

// Test 2: Direction change constraints (no 180° turns)
const headBefore = { ...game.snake[0] };
// Currently moving right (+1, 0). Cannot turn left (-1, 0)
const reversed = game.setDirection(-1, 0);
assert.strictEqual(reversed, false, "Cannot reverse directly into tail");
assert.strictEqual(game.nextDir.x, 1, "Direction remains right");

// Can turn Up (0, -1)
const turnedUp = game.setDirection(0, -1);
assert.strictEqual(turnedUp, true, "Can turn up");
assert.strictEqual(game.nextDir.y, -1, "Next direction is up");
console.log("✔ Test 2 passed: Direction constraints");

// Test 3: Tick movement
game.state = "PLAYING";
game.tick();
assert.strictEqual(game.snake[0].y, headBefore.y - 1, "Snake moved up by 1 tile");
console.log("✔ Test 3 passed: Tick movement");

// Test 4: Wall / Portal wrapping
game.reset();
game.snake[0] = { x: 19, y: 10 }; // At right edge
game.dir = { x: 1, y: 0 };
game.nextDir = { x: 1, y: 0 };
game.state = "PLAYING";
game.tick();
assert.strictEqual(game.snake[0].x, 0, "Snake wrapped from right edge (19) to left edge (0)");
console.log("✔ Test 4 passed: Portal wrapping");

// Test 5: Eating food & growing
game.reset();
game.state = "PLAYING";
const initialLen = game.snake.length;
game.food = { x: game.snake[0].x + 1, y: game.snake[0].y, isGold: false };
game.dir = { x: 1, y: 0 };
game.nextDir = { x: 1, y: 0 };
game.tick();
assert.strictEqual(game.score, 10, "Eating food scores 10 points");
assert.strictEqual(game.snake.length, initialLen + 1, "Snake grew by 1 segment");
console.log("✔ Test 5 passed: Food consumption and growth");

// Test 6: Powerup - EMP destroys glitches
game.reset();
game.glitches = [
  { x: 5, y: 5, life: 1000 },
  { x: 7, y: 7, life: 1000 }
];
game.applyPowerup("emp");
assert.strictEqual(game.glitches.length, 0, "EMP destroyed all glitches");
assert.strictEqual(game.score, 50, "EMP scored points for 2 glitches (2 * 25)");
console.log("✔ Test 6 passed: EMP Powerup");

// Test 7: Powerup - Multiplier
game.reset();
game.state = "PLAYING";
game.applyPowerup("mult");
assert.strictEqual(game.multiplier, 2, "Multiplier is 2x");
game.food = { x: game.snake[0].x + 1, y: game.snake[0].y, isGold: false };
game.tick();
assert.strictEqual(game.score, 20, "Scored 20 pts (10 * 2x)");
console.log("✔ Test 7 passed: Multiplier Powerup");

// Test 8: Self Collision Game Over
game.reset();
game.state = "PLAYING";
// Snake of length 5 looping into its own body segment at (6, 5)
game.snake = [
  { x: 5, y: 5 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 6, y: 5 },
  { x: 7, y: 5 }
];
game.dir = { x: 1, y: 0 };
game.nextDir = { x: 1, y: 0 };
game.tick();
assert.strictEqual(game.state, "GAMEOVER", "Self collision triggered GAMEOVER");
console.log("✔ Test 8 passed: Self collision");

// Test 9: Ghost Mode bypasses collision
game.reset();
game.state = "PLAYING";
game.applyPowerup("ghost");
game.snake = [
  { x: 5, y: 5 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 6, y: 5 },
  { x: 7, y: 5 }
];
game.dir = { x: 1, y: 0 };
game.nextDir = { x: 1, y: 0 };
game.tick();
assert.strictEqual(game.state, "PLAYING", "Ghost mode allowed passing through tail without game over");
console.log("✔ Test 9 passed: Ghost mode collision bypass");

console.log("\nALL 9 SNAKE LOGIC TESTS PASSED SUCCESSFULLY! 🐍✨\n");
