const assert = require('assert');
const { BilliardsEngine } = require('../js/billiards.js');

console.log("Running Neon Pool: Cyber Cue Unit Tests...");

// Mock Audio
const mockAudio = {
    cueHit: () => {},
    ballHit: () => {},
    cushionHit: () => {},
    pocket: () => {},
    foul: () => {},
    victory: () => {}
};

// Test 1: Rack Initialization
{
    const engine = new BilliardsEngine(null, mockAudio);
    assert.strictEqual(engine.balls.length, 10, "Rack should contain 10 balls (cue + 9 object balls)");
    assert.strictEqual(engine.cueBall.num, 0, "Cue ball number should be 0");
    const nineBall = engine.balls.find(b => b.num === 9);
    assert(nineBall !== undefined, "9-ball should exist in diamond rack");
    console.log("✔ Test 1: Rack initialization passed");
}

// Test 2: Cue Strike Mechanics
{
    const engine = new BilliardsEngine(null, mockAudio);
    assert.strictEqual(engine.allStopped(), true, "All balls should initially be stopped");
    engine.strikeCue(0.5, 0); // 50% power directly to the right
    assert(engine.cueBall.vx > 0, "Cue ball should have positive X velocity");
    assert.strictEqual(engine.shotsTaken, 1, "Shots taken count should increment");
    console.log("✔ Test 2: Cue strike mechanics passed");
}

// Test 3: Cushion Bounces
{
    const engine = new BilliardsEngine(null, mockAudio);
    const cb = engine.cueBall;
    cb.x = engine.table.right - 2;
    cb.y = engine.table.y + engine.table.h / 2;
    cb.vx = 400; // Moving right into cushion
    cb.vy = 0;

    engine.update(0.016);
    assert(cb.vx < 0, "Cushion should reflect velocity to negative X");
    console.log("✔ Test 3: Cushion collision & reflection passed");
}

// Test 4: Ball-to-Ball Elastic Collisions
{
    const engine = new BilliardsEngine(null, mockAudio);
    const cb = engine.cueBall;
    const b1 = engine.balls[1];
    cb.x = 300; cb.y = 300; cb.vx = 300; cb.vy = 0;
    b1.x = 318; b1.y = 300; b1.vx = 0; b1.vy = 0;

    engine.update(0.016);
    assert(b1.vx > 0, "Impacted object ball should gain positive velocity");
    assert(cb.vx < 300, "Cue ball should lose forward momentum");
    console.log("✔ Test 4: 2D ball elastic collision passed");
}

// Test 5: Scratch / Foul Handling
{
    const engine = new BilliardsEngine(null, mockAudio);
    engine.score = 100;
    engine.handlePocket(engine.cueBall);
    assert.strictEqual(engine.score, 50, "Scratch should penalize score by 50 pts");
    assert(engine.foulTimer > 0, "Foul alert should be displayed");
    console.log("✔ Test 5: Scratch & foul penalty passed");
}

// Test 6: 9-Ball Pocketed & Victory
{
    const engine = new BilliardsEngine(null, mockAudio);
    const nineBall = engine.balls.find(b => b.num === 9);
    engine.handlePocket(nineBall);
    assert.strictEqual(engine.victory, true, "Pocketing 9-ball should win the match");
    console.log("✔ Test 6: 9-ball victory logic passed");
}

console.log("All BilliardsEngine Unit Tests Passed Successfully!");
