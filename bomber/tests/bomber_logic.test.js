const assert = require('assert');
const { BomberEngine } = require('../js/bomber.js');

console.log("Running Cyber Bomber: Grid Detonator Unit Tests...");

// Mock Audio
const mockAudio = {
    bombDrop: () => {},
    explode: () => {},
    powerup: () => {},
    eliminated: () => {},
    victory: () => {}
};

// Test 1: Grid & Players Initialization
{
    const engine = new BomberEngine(null, mockAudio);
    assert.strictEqual(engine.cols, 15, "Grid must have 15 columns");
    assert.strictEqual(engine.rows, 13, "Grid must have 13 rows");
    assert.strictEqual(engine.players.length, 4, "Must have 4 players (1 human + 3 bots)");
    assert.strictEqual(engine.grid[0][0], 1, "Perimeter must be solid wall");
    assert.strictEqual(engine.grid[2][2], 1, "Pillar at (2,2) must be solid wall");
    assert.strictEqual(engine.players[0].col, 1, "Player 1 starts at col 1");
    assert.strictEqual(engine.players[0].row, 1, "Player 1 starts at row 1");
    console.log("✔ Test 1: Grid and players initialization passed");
}

// Test 2: Bomb Dropping Mechanics
{
    const engine = new BomberEngine(null, mockAudio);
    const p = engine.players[0];
    assert.strictEqual(engine.bombs.length, 0, "Initially 0 bombs");

    const dropped = engine.dropBomb(p);
    assert.strictEqual(dropped, true, "Should successfully drop bomb");
    assert.strictEqual(engine.bombs.length, 1, "Should have 1 active bomb");
    assert.strictEqual(p.activeBombs, 1, "Player activeBombs count should be 1");

    // Second drop should fail because maxBombs is 1
    const secondDrop = engine.dropBomb(p);
    assert.strictEqual(secondDrop, false, "Cannot exceed maxBombs");
    console.log("✔ Test 2: Bomb dropping mechanics passed");
}

// Test 3: Detonation and Cross Blast
{
    const engine = new BomberEngine(null, mockAudio);
    // Force clear center tiles for clean blast test
    engine.grid[5][5] = 0;
    engine.grid[5][4] = 0;
    engine.grid[5][6] = 0;
    engine.grid[4][5] = 0;
    engine.grid[6][5] = 0;

    const p = engine.players[0];
    p.x = engine.offsetX + 5 * engine.tileSize + 20;
    p.y = engine.offsetY + 5 * engine.tileSize + 20;
    p.bombRange = 2;

    engine.dropBomb(p);
    assert.strictEqual(engine.bombs.length, 1);

    // Trigger immediate detonation
    engine.detonateBomb(0);
    assert.strictEqual(engine.bombs.length, 0, "Bomb should be consumed");
    assert(engine.flames.length >= 5, "Cross blast should generate flames in center and 4 directions");
    console.log("✔ Test 3: Detonation and cross blast passed");
}

// Test 4: Crate Destruction
{
    const engine = new BomberEngine(null, mockAudio);
    // Place destructible crate at (5, 6)
    engine.grid[5][5] = 0;
    engine.grid[5][6] = 2; // Crate

    const p = engine.players[0];
    p.x = engine.offsetX + 5 * engine.tileSize + 20;
    p.y = engine.offsetY + 5 * engine.tileSize + 20;
    p.bombRange = 2;

    engine.dropBomb(p);
    engine.detonateBomb(0);

    assert.strictEqual(engine.grid[5][6], 0, "Crate should be destroyed into empty floor");
    console.log("✔ Test 4: Crate destruction passed");
}

// Test 5: Elimination in Blast
{
    const engine = new BomberEngine(null, mockAudio);
    const bot = engine.players[1];
    bot.x = engine.offsetX + 3 * engine.tileSize + 20;
    bot.y = engine.offsetY + 3 * engine.tileSize + 20;
    bot.col = 3;
    bot.row = 3;

    // Add flame directly on bot's tile
    engine.addFlame(3, 3);
    engine.updateFlames(0.016);

    assert.strictEqual(bot.alive, false, "Bot caught in flame must be eliminated");
    console.log("✔ Test 5: Elimination in blast passed");
}

// Test 6: Threat Detection Algorithm
{
    const engine = new BomberEngine(null, mockAudio);
    // Clear line from (3, 3) to (5, 3)
    engine.grid[3][3] = 0;
    engine.grid[3][4] = 0;
    engine.grid[3][5] = 0;

    // Place bomb at (3, 3)
    engine.bombs.push({
        col: 3,
        row: 3,
        timer: 2.0,
        range: 3,
        owner: null,
        allowedEntityId: null
    });

    const isThreatenedInLine = engine.isTileThreatened(4, 3);
    assert.strictEqual(isThreatenedInLine, true, "Tile in direct line of blast must be threatened");

    const isSafeDiagonal = engine.isTileThreatened(4, 4);
    assert.strictEqual(isSafeDiagonal, false, "Diagonal tile not in cross line must be safe");
    console.log("✔ Test 6: Threat detection algorithm passed");
}

console.log("\nALL CYBER BOMBER UNIT TESTS PASSED (6/6)!\n");
