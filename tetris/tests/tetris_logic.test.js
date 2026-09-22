const assert = require('assert');
const { TetrisEngine, TETROMINOES } = require('../js/tetris.js');

console.log("Running Quantum Fall: Cyber Blocks Unit Tests...");

// Mock Audio
const mockAudio = {
    move: () => {},
    rotate: () => {},
    drop: () => {},
    lock: () => {},
    lineClear: () => {},
    gameOver: () => {}
};

// Test 1: Matrix & 7 Tetromino Definitions
{
    const engine = new TetrisEngine(null, mockAudio);
    assert.strictEqual(engine.cols, 10, "Matrix should have 10 columns");
    assert.strictEqual(engine.rows, 20, "Matrix should have 20 rows");
    assert.strictEqual(Object.keys(TETROMINOES).length, 7, "Must define 7 tetromino shapes");
    assert(engine.currentPiece !== null, "Current piece should be spawned");
    assert(engine.nextPiece !== null, "Next piece should be queued");
    console.log("✔ Test 1: Matrix and tetromino initialization passed");
}

// Test 2: Horizontal Movement & Boundary Clamping
{
    const engine = new TetrisEngine(null, mockAudio);
    // Push piece far to the left
    for (let i = 0; i < 15; i++) {
        engine.move(-1);
    }
    const leftmostX = engine.currentPiece.x;
    engine.move(-1);
    assert.strictEqual(engine.currentPiece.x, leftmostX, "Piece must not move past left boundary");
    console.log("✔ Test 2: Horizontal movement & boundary clamping passed");
}

// Test 3: Rotation & Wall Kicks
{
    const engine = new TetrisEngine(null, mockAudio);
    // Set piece to 'T'
    engine.currentPiece = {
        type: 'T',
        color: TETROMINOES.T.color,
        matrix: TETROMINOES.T.matrix.map(r => [...r]),
        x: 0,
        y: 5
    };
    const preRotationMatrix = JSON.stringify(engine.currentPiece.matrix);
    engine.rotate(1);
    const postRotationMatrix = JSON.stringify(engine.currentPiece.matrix);
    assert.notStrictEqual(preRotationMatrix, postRotationMatrix, "Matrix must be rotated");
    assert(engine.currentPiece.x >= 0, "Piece must not kick out of matrix bounds");
    console.log("✔ Test 3: Rotation & wall kicks passed");
}

// Test 4: Hard Drop Mechanics
{
    const engine = new TetrisEngine(null, mockAudio);
    engine.currentPiece.x = 3;
    engine.currentPiece.y = 0;

    const ghostY = engine.getGhostY();
    assert(ghostY >= 16, `Ghost Y should be near bottom (>= 16), got ${ghostY}`);

    const scoreBefore = engine.score;
    engine.hardDrop();

    // Piece was locked and new piece spawned at y=0
    assert(engine.score > scoreBefore, "Hard drop should award distance points");
    // Check that bottom row of matrix now contains locked blocks
    const bottomHasBlocks = engine.matrix[19].some(cell => cell !== 0);
    assert.strictEqual(bottomHasBlocks, true, "Bottom row should contain locked blocks from hard drop");
    console.log("✔ Test 4: Hard drop mechanics passed");
}

// Test 5: Line Clear Detection & Scoring
{
    const engine = new TetrisEngine(null, mockAudio);
    // Fill row 19 completely except column 0
    for (let c = 1; c < engine.cols; c++) {
        engine.matrix[19][c] = '#00f0ff';
    }
    // Fill column 0
    engine.matrix[19][0] = '#00f0ff';

    const initialScore = engine.score;
    engine.clearLines();

    assert.strictEqual(engine.lines, 1, "Should have cleared 1 line");
    assert.strictEqual(engine.score, initialScore + 100, "1 line clear should award 100 points");
    // Row 19 should now be empty (shifted down from row 18)
    assert(engine.matrix[19].every(cell => cell === 0), "Row 19 should now be empty after clear");
    console.log("✔ Test 5: Line clear detection and scoring passed");
}

// Test 6: Hold Piece Mechanism
{
    const engine = new TetrisEngine(null, mockAudio);
    const firstPieceType = engine.currentPiece.type;
    assert.strictEqual(engine.holdPiece, null, "Initially hold slot is empty");

    engine.hold();
    assert.strictEqual(engine.holdPiece, firstPieceType, "Hold slot should now contain first piece");
    assert.strictEqual(engine.canHold, false, "canHold should be false until next lock");

    // Second hold in same turn should be rejected
    engine.hold();
    assert.strictEqual(engine.holdPiece, firstPieceType, "Hold piece should remain unchanged");
    console.log("✔ Test 6: Hold piece mechanism passed");
}

console.log("\nALL QUANTUM FALL UNIT TESTS PASSED (6/6)!\n");
