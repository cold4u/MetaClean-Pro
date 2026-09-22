const assert = require('assert');
const { PacmanEngine } = require('../js/pacman.js');

console.log("Running Quantum Maze: Cyber Ghost Hunt Unit Tests...");

// Mock Audio
const mockAudio = {
    waka: () => {},
    energizer: () => {},
    eatGhost: () => {},
    death: () => {},
    victory: () => {}
};

// Test 1: Maze & Entities Initialization
{
    const engine = new PacmanEngine(null, mockAudio);
    assert.strictEqual(engine.cols, 19, "Must have 19 columns");
    assert.strictEqual(engine.rows, 21, "Must have 21 rows");
    assert.strictEqual(engine.lives, 3, "Should start with 3 lives");
    assert(engine.pelletsRemaining > 100, `Expected > 100 pellets, found ${engine.pelletsRemaining}`);
    assert.strictEqual(engine.ghosts.length, 4, "Must have 4 ghosts");
    console.log("✔ Test 1: Maze and entities initialization passed");
}

// Test 2: Direction Buffering & Movement
{
    const engine = new PacmanEngine(null, mockAudio);
    // Player starts at (9, 16)
    // Send input left
    engine.setNextDirection(-1, 0);
    assert.strictEqual(engine.player.dir.dx, -1, "Player should begin moving left");

    const initialX = engine.player.x;
    engine.updatePlayer(0.05);
    assert(engine.player.x < initialX, "Player x should decrease when moving left");
    console.log("✔ Test 2: Direction buffering & movement passed");
}

// Test 3: Pellet Consumption
{
    const engine = new PacmanEngine(null, mockAudio);
    const initialPellets = engine.pelletsRemaining;
    const initialScore = engine.score;

    // Force tile (9, 16) to have pellet 0
    engine.grid[16][9] = 0;
    engine.player.col = 9;
    engine.player.row = 16;
    engine.player.x = engine.offsetX + 9 * engine.tileSize + engine.tileSize / 2;
    engine.player.y = engine.offsetY + 16 * engine.tileSize + engine.tileSize / 2;

    engine.updatePlayer(0.016);
    assert.strictEqual(engine.score, initialScore + 10, "Score should increase by 10");
    assert.strictEqual(engine.pelletsRemaining, initialPellets - 1, "Pellets remaining should decrease by 1");
    assert.strictEqual(engine.grid[16][9], 3, "Tile should now be empty (3)");
    console.log("✔ Test 3: Pellet consumption passed");
}

// Test 4: Energizer & Frightened Ghost Transition
{
    const engine = new PacmanEngine(null, mockAudio);
    assert.strictEqual(engine.frightenedTimer, 0, "Initially frightened timer is 0");

    engine.triggerEnergizer();
    assert(engine.frightenedTimer > 0, "Frightened timer should be active");
    for (const g of engine.ghosts) {
        assert.strictEqual(g.state, 'frightened', "Ghosts should be frightened");
    }
    console.log("✔ Test 4: Energizer & frightened transition passed");
}

// Test 5: Ghost Eating Mechanics
{
    const engine = new PacmanEngine(null, mockAudio);
    engine.triggerEnergizer();

    const ghost = engine.ghosts[0];
    ghost.x = engine.player.x;
    ghost.y = engine.player.y;

    const initialScore = engine.score;
    engine.checkGhostCollisions();

    assert.strictEqual(ghost.state, 'eaten', "Frightened ghost should transition to eaten");
    assert.strictEqual(engine.score, initialScore + 200, "First ghost eaten should award 200 points");
    console.log("✔ Test 5: Ghost eating mechanics passed");
}

// Test 6: Warp Tunnel Wrapping
{
    const engine = new PacmanEngine(null, mockAudio);
    engine.player.row = 10;
    engine.player.y = engine.offsetY + 10 * engine.tileSize + engine.tileSize / 2;
    engine.player.x = engine.offsetX - 5; // Left past boundary
    engine.player.dir = { dx: -1, dy: 0 };

    engine.updatePlayer(0.016);
    assert(engine.player.x >= engine.offsetX + (engine.cols - 2) * engine.tileSize, "Player should wrap around to right tunnel entrance");
    console.log("✔ Test 6: Warp tunnel wrapping passed");
}

console.log("\nALL QUANTUM MAZE UNIT TESTS PASSED (6/6)!\n");
