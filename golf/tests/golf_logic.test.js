const assert = require('assert');
const { GolfEngine } = require('../js/golf.js');

console.log("Running Quantum Mini-Golf Unit Tests...");

// Mock Audio
const mockAudio = {
    putt: () => {},
    wallBounce: () => {},
    booster: () => {},
    wormhole: () => {},
    cupIn: () => {},
    hazard: () => {},
    victory: () => {}
};

// Test 1: Course & 9 Holes Initialization
{
    const engine = new GolfEngine(null, mockAudio);
    assert.strictEqual(engine.holes.length, 9, "Course should have 9 holes");
    assert.strictEqual(engine.currentHoleIndex, 0, "Should start at Hole 1");
    assert.strictEqual(engine.isBallStopped(), true, "Ball should start at rest");
    console.log("✔ Test 1: Course & holes initialization passed");
}

// Test 2: Putting Mechanics
{
    const engine = new GolfEngine(null, mockAudio);
    engine.putt(300, 0);
    assert.strictEqual(engine.ball.vx, 300, "Ball should gain 300 X velocity");
    assert.strictEqual(engine.strokesThisHole, 1, "Strokes count should increment to 1");
    console.log("✔ Test 2: Putting mechanics passed");
}

// Test 3: Wall Collision & Reflection
{
    const engine = new GolfEngine(null, mockAudio);
    // Position ball near right wall (x: 740)
    engine.ball.x = 735;
    engine.ball.y = 300;
    engine.ball.vx = 200; // moving right into wall
    engine.ball.vy = 0;

    engine.update(0.016);
    assert(engine.ball.vx < 0, "Velocity should reflect into negative X");
    console.log("✔ Test 3: Wall bounce reflection passed");
}

// Test 4: Speed Booster Pad Acceleration
{
    const engine = new GolfEngine(null, mockAudio);
    engine.loadHole(3); // Hole 4 has booster pad at (320, 250)
    engine.ball.x = 330;
    engine.ball.y = 280;
    engine.ball.vx = 50;
    engine.ball.vy = 0;

    engine.update(0.05);
    assert(engine.ball.vx > 100, "Booster pad should accelerate ball velocity");
    console.log("✔ Test 4: Speed booster acceleration passed");
}

// Test 5: Wormhole Teleportation
{
    const engine = new GolfEngine(null, mockAudio);
    engine.loadHole(2); // Hole 3 has wormhole: in (320, 300), out (480, 300)
    engine.ball.x = 320;
    engine.ball.y = 300;
    engine.ball.vx = 50;
    engine.ball.vy = 0;

    engine.update(0.016);
    assert(Math.abs(engine.ball.x - 480) < 2.0, "Ball should be teleported near wormhole exit X");
    console.log("✔ Test 5: Wormhole teleportation passed");
}

// Test 6: Cup Detection & Scorecard Recording
{
    const engine = new GolfEngine(null, mockAudio);
    const cup = engine.holes[0].cup;
    engine.ball.x = cup.x - 2;
    engine.ball.y = cup.y;
    engine.ball.vx = 20;
    engine.ball.vy = 0;
    engine.strokesThisHole = 2;

    engine.update(0.016);
    assert.strictEqual(engine.holeCompleted, true, "Hole should be marked completed");
    assert.strictEqual(engine.scorecard.length, 1, "Scorecard should have 1 recorded hole");
    console.log("✔ Test 6: Cup detection & scorecard passed");
}

console.log("All GolfEngine Unit Tests Passed Successfully!");
