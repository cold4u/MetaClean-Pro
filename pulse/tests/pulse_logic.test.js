const assert = require('assert');
const { PulseGame } = require('../js/pulse.js');

console.log("=== RUNNING CYBER PULSE LOGIC TESTS ===");

const game = new PulseGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.health, 100);
assert.strictEqual(game.score, 0);
assert.strictEqual(game.combo, 0);
assert.strictEqual(game.multiplier, 1);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Perfect Hit scoring and combo
game.state = "PLAYING";
// Place note directly on target line in lane 0
game.notes = [{ lane: 0, y: game.targetY, hit: false }];
game.hitLane(0);
assert.strictEqual(game.notes[0].hit, true, "Note marked as hit");
assert.strictEqual(game.score, 100, "Perfect hit awarded 100 points");
assert.strictEqual(game.combo, 1, "Combo increased to 1");
console.log("✔ Test 2 passed: Perfect Hit scoring and combo");

// Test 3: Great Hit scoring
game.notes = [{ lane: 1, y: game.targetY + 25, hit: false }];
game.hitLane(1);
assert.strictEqual(game.notes[0].hit, true, "Note hit within great range");
assert.strictEqual(game.score, 160, "Great hit added 60 points (100 + 60)");
assert.strictEqual(game.combo, 2, "Combo increased to 2");
console.log("✔ Test 3 passed: Great Hit scoring");

// Test 4: Good Hit scoring
game.notes = [{ lane: 2, y: game.targetY - 50, hit: false }];
game.hitLane(2);
assert.strictEqual(game.notes[0].hit, true, "Note hit within good range");
assert.strictEqual(game.score, 190, "Good hit added 30 points (160 + 30)");
assert.strictEqual(game.combo, 3, "Combo increased to 3");
console.log("✔ Test 4 passed: Good Hit scoring");

// Test 5: Misclick / Empty lane penalty
const prevScore = game.score;
game.notes = []; // No notes
game.hitLane(0);
assert.strictEqual(game.score, prevScore, "Score does not increase on miss");
assert.strictEqual(game.combo, 0, "Combo reset to 0 on empty lane tap");
assert.strictEqual(game.multiplier, 1, "Multiplier reset to 1x");
assert.strictEqual(game.health, 95, "Health decreased by 5 on misclick");
console.log("✔ Test 5 passed: Misclick penalty");

// Test 6: Combo Multiplier progression
game.combo = 9;
game.notes = [{ lane: 0, y: game.targetY, hit: false }];
game.hitLane(0); // combo becomes 10 -> multiplier becomes 2x
assert.strictEqual(game.combo, 10);
assert.strictEqual(game.multiplier, 2, "10 combo triggers 2x multiplier");

// Test 7: Drop update misses note and drains health
game.combo = 10;
game.notes = [{ lane: 3, y: game.targetY + 70, hit: false }]; // Past miss threshold
game.update(16);
assert.strictEqual(game.notes[0].hit, true, "Note marked as missed");
assert.strictEqual(game.combo, 0, "Combo broken by missed note");
assert.strictEqual(game.health, 90, "Health decreased by 10 on note miss (100 - 10 = 90)");
console.log("✔ Test 7 passed: Falling note miss handling");

// Test 8: Health depletion triggers GameOver
game.health = 5;
game.notes = [{ lane: 0, y: game.targetY + 70, hit: false }];
game.update(16);
assert.strictEqual(game.health, 0);
assert.strictEqual(game.state, "GAMEOVER", "0 health triggers GAMEOVER");
console.log("✔ Test 8 passed: Health depletion GameOver");

console.log("\nALL 8 CYBER PULSE LOGIC TESTS PASSED! 🎵✨\n");
