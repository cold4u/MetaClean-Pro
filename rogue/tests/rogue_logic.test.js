const assert = require('assert');
const { RogueGame } = require('../js/rogue.js');

console.log("=== RUNNING NEON ROGUE LOGIC TESTS ===");

const game = new RogueGame(null, null);

// Test 1: Initialization & Dungeon Graph
assert.strictEqual(game.state, "START");
assert.strictEqual(game.dungeon.length, 3);
assert.strictEqual(game.dungeon[0][0].type, "start");
assert.strictEqual(game.dungeon[2][2].type, "boss");
assert.strictEqual(game.dungeon[1][1].type, "shop");
console.log("✔ Test 1 passed: Initialization and Dungeon Graph");

// Test 2: Dash roll gives i-frames and sets velocity
game.state = "PLAYING";
const dashed = game.dash();
assert.strictEqual(dashed, true, "Dash executed");
assert.ok(game.player.dashTimer > 0, "Player has active i-frames");
assert.ok(game.player.dashCooldown > 0, "Dash cooldown active");
console.log("✔ Test 2 passed: Dash roll & i-frames");

// Test 3: Attack with Katana
game.player.weaponIdx = 0; // Katana
game.enemies = [{
  x: game.player.x + 20,
  y: game.player.y,
  hp: 50,
  radius: 12
}];
game.aimAngle = 0; // Aim right
game.attack();
assert.ok(game.enemies[0].hp < 50, "Enemy took melee slash damage");
assert.strictEqual(game.slashes.length, 1, "Slash visual created");
console.log("✔ Test 3 passed: Katana attack");

// Test 4: Attack with Shotgun
game.player.weaponIdx = 1; // Shotgun
game.weapons[1].timer = 0;
game.attack();
assert.strictEqual(game.playerBullets.length, 5, "Shotgun fired 5 pellets in spread");
console.log("✔ Test 4 passed: Shotgun spread attack");

// Test 5: Room door navigation when cleared
game.enemies = []; // Room cleared
game.currentRoom = { gx: 0, gy: 0 };
game.player.x = game.width / 2;
game.player.y = 540; // Walk into bottom door (gx: 0, gy: 1)
game.update(16);
assert.strictEqual(game.currentRoom.gy, 1, "Navigated through bottom door to room (0, 1)");
console.log("✔ Test 5 passed: Room door navigation");

// Test 6: Boss defeat triggers victory
game.currentRoom = { gx: 2, gy: 2 };
game.loadCurrentRoom();
assert.strictEqual(game.enemies[0].isBoss, true, "Loaded boss chamber");
game.enemies[0].hp = 0; // Boss defeated
game.update(16);
assert.strictEqual(game.state, "VICTORY", "Boss defeat triggered VICTORY");
console.log("✔ Test 6 passed: Boss defeat and Victory");

console.log("\nALL 6 NEON ROGUE LOGIC TESTS PASSED! 🗡️✨\n");
