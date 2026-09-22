const assert = require('assert');
const { PortalGame } = require('../js/portal.js');

console.log("=== RUNNING QUANTUM PORTAL LOGIC TESTS ===");

const game = new PortalGame(null, null);

// Test 1: Initialization
assert.strictEqual(game.state, "START");
assert.strictEqual(game.currentLevelIdx, 0);
assert.ok(game.walls.length > 0, "Chamber walls created");
console.log("✔ Test 1 passed: Initialization");

// Test 2: Shoot Blue Portal on portalable wall
const hitBlue = game.shootPortal(false, 300, 20); // Shoot towards ceiling
assert.strictEqual(hitBlue, true, "Blue portal successfully placed on ceiling");
assert.ok(game.bluePortal, "Blue portal exists");
assert.strictEqual(game.bluePortal.ny, 1, "Ceiling portal normal points down (+1)");
console.log("✔ Test 2 passed: Blue portal placement");

// Test 3: Shoot Orange Portal on portalable wall
const hitOrange = game.shootPortal(true, 20, 200); // Shoot towards left wall
assert.strictEqual(hitOrange, true, "Orange portal successfully placed on left wall");
assert.ok(game.orangePortal, "Orange portal exists");
assert.strictEqual(game.orangePortal.nx, 1, "Left wall portal normal points right (+1)");
console.log("✔ Test 3 passed: Orange portal placement");

// Test 4: Momentum-preserving teleportation
game.player.x = game.bluePortal.x - 10;
game.player.y = game.bluePortal.y - 10;
game.player.vy = -6; // Entering ceiling portal upward
const didTeleport = game.teleportEntity(game.player);
assert.strictEqual(didTeleport, true, "Player teleported through portal");
assert.ok(game.player.vx > 0, "Player exited orange portal redirected along normal (pointing right)");
console.log("✔ Test 4 passed: Momentum preservation & teleportation");

// Test 5: Chamber 2 - Pressure plate with Weighted Cube opens door
game.loadLevel(1);
assert.strictEqual(game.doors[0].open, false, "Door starts locked");
// Place cube directly on button
game.cubes[0].x = game.buttons[0].x + 5;
game.cubes[0].y = game.buttons[0].y - 20;
game.state = "PLAYING";
game.update(16);
assert.strictEqual(game.buttons[0].pressed, true, "Button pressed by cube");
assert.strictEqual(game.doors[0].open, true, "Door opened when button pressed");
console.log("✔ Test 5 passed: Weighted Cube & Pressure plate mechanism");

// Test 6: Level transition upon entering open door
game.player.x = game.doors[0].x + 5;
game.player.y = game.doors[0].y + 10;
game.update(16);
assert.strictEqual(game.state, "LEVEL_CLEAR", "Entering open door triggers LEVEL_CLEAR");
console.log("✔ Test 6 passed: Level clear transition");

console.log("\nALL 6 QUANTUM PORTAL LOGIC TESTS PASSED! 🌀✨\n");
