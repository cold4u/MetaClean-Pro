const assert = require('assert');
const { SurvivorGame } = require('../js/survivor.js');

console.log("=== RUNNING CYBER SURVIVOR LOGIC TESTS ===");

const game = new SurvivorGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.player.level, 1);
assert.strictEqual(game.player.xp, 0);
assert.ok(game.player.hp > 0);
console.log("✔ Test 1 passed: Initialization");

// Test 2: Movement
game.state = "PLAYING";
const initX = game.player.x;
game.input = { x: 1, y: 0 };
game.update(100);
assert.ok(game.player.x > initX, "Player moved right with input");
console.log("✔ Test 2 passed: Player Movement");

// Test 3: XP Gem pickup and level up
game.gems = [{ x: game.player.x, y: game.player.y, val: 12, color: "#00f0ff" }];
game.update(16);
assert.strictEqual(game.gems.length, 0, "Gem was collected");
assert.strictEqual(game.player.level, 2, "Leveled up to 2");
assert.strictEqual(game.state, "LEVELUP", "Game transitioned to LEVELUP state");
console.log("✔ Test 3 passed: XP collection and Level Up");

// Test 4: Perk Application (Plasma Discs)
game.applyPerk("discs");
assert.strictEqual(game.weapons.plasmaDiscs.level, 1);
assert.strictEqual(game.weapons.plasmaDiscs.count, 1);
assert.strictEqual(game.state, "PLAYING", "State restored to PLAYING after perk");
console.log("✔ Test 4 passed: Perk Application");

// Test 5: Auto-fire Gatling hits enemy
game.enemies = [{
  x: game.player.x + 50,
  y: game.player.y,
  hp: 20,
  speed: 0,
  radius: 10,
  color: "#00f0ff",
  xpValue: 1
}];
game.weapons.gatling.timer = game.weapons.gatling.interval;
game.update(16);
assert.ok(game.bullets.length > 0, "Gatling bullet fired automatically");
console.log("✔ Test 5 passed: Auto-fire Gatling");

// Test 6: Enemy death spawns gem and awards meta chips
const chipsBefore = game.meta.chips;
game.enemies[0].hp = 0;
game.update(16);
assert.strictEqual(game.enemies.length, 0, "Dead enemy removed");
assert.strictEqual(game.gems.length, 1, "Gem dropped on enemy death");
assert.strictEqual(game.meta.chips, chipsBefore + 1, "Meta-chips awarded");
console.log("✔ Test 6 passed: Enemy defeat & drop");

// Test 7: Health depletion triggers GameOver
game.player.hp = 1;
game.enemies = [{
  x: game.player.x,
  y: game.player.y,
  hp: 100,
  speed: 0,
  radius: 20,
  color: "#ff0077"
}];
game.update(100);
assert.strictEqual(game.state, "GAMEOVER", "Player death triggers GAMEOVER");
console.log("✔ Test 7 passed: Health depletion GameOver");

// Test 8: Meta Upgrades apply to stats
game.meta.hpTier = 2;
game.meta.speedTier = 3;
game.applyMeta();
assert.strictEqual(game.player.maxHp, 150, "Max HP boosted by meta tier (100 + 2*25)");
assert.strictEqual(game.player.speed, 180 + 3 * 18, "Speed boosted by meta tier");
console.log("✔ Test 8 passed: Meta upgrades application");

console.log("\nALL 8 CYBER SURVIVOR LOGIC TESTS PASSED! 🧬✨\n");
