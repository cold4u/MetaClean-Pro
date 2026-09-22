const assert = require('assert');
const { KartEngine } = require('../js/kart.js');

console.log("Running Cyber Drift: Neon Velocity Unit Tests...");

// Mock Audio
const mockAudio = {
    init: () => {},
    startEngine: () => {},
    updateEngine: () => {},
    driftScreech: () => {},
    boost: () => {},
    itemPickup: () => {},
    useItem: () => {},
    crash: () => {},
    countdown: () => {},
    victory: () => {}
};

// Test 1: Track initialization
{
    const engine = new KartEngine(null, mockAudio);
    assert(engine.segments.length > 100, "Track should have over 100 segments");
    assert(engine.trackLength > 20000, "Track length should be substantial");
    assert.strictEqual(engine.opponents.length, 5, "Should have 5 rival opponents");
    console.log("✔ Test 1: Track & Opponent initialization passed");
}

// Test 2: Drift charge & tier calculation
{
    const engine = new KartEngine(null, mockAudio);
    engine.driftCharge = 20;
    assert.strictEqual(engine.getDriftTier(), 0, "Charge < 50 should be tier 0");

    engine.driftCharge = 75;
    assert.strictEqual(engine.getDriftTier(), 1, "Charge 75 should be tier 1 (Mini Turbo)");

    engine.driftCharge = 120;
    assert.strictEqual(engine.getDriftTier(), 2, "Charge 120 should be tier 2 (Super Turbo)");

    engine.driftCharge = 200;
    assert.strictEqual(engine.getDriftTier(), 3, "Charge 200 should be tier 3 (Ultra Turbo)");
    console.log("✔ Test 2: Drift tier calculations passed");
}

// Test 3: Acceleration & Speed physics
{
    const engine = new KartEngine(null, mockAudio);
    engine.raceStarted = true;
    engine.countdown = 0;
    engine.keys.up = true;
    engine.update(0.1);
    assert(engine.speed > 0, "Kart should accelerate when forward key is pressed");
    const speed1 = engine.speed;
    engine.update(0.1);
    assert(engine.speed > speed1, "Speed should continue to increase with acceleration");
    console.log("✔ Test 3: Acceleration physics passed");
}

// Test 4: Drift Boost Release
{
    const engine = new KartEngine(null, mockAudio);
    engine.raceStarted = true;
    engine.countdown = 0;
    engine.speed = 8000;
    engine.driftCharge = 165; // Tier 3
    engine.releaseDriftBoost();
    assert.strictEqual(engine.boostStrength, 7500, "Tier 3 drift should grant 7500 boost power");
    assert(engine.boostTimer > 2.0, "Boost timer should be over 2 seconds");
    console.log("✔ Test 4: Drift boost release mechanics passed");
}

// Test 5: Off-road penalty
{
    const engine = new KartEngine(null, mockAudio);
    engine.raceStarted = true;
    engine.countdown = 0;
    engine.speed = 10000;
    engine.playerX = 1.8; // Far off track
    engine.update(0.1);
    assert(engine.speed < 10000, "Speed should be penalized off-road");
    console.log("✔ Test 5: Off-road friction penalty passed");
}

// Test 6: Lap completion & race finish
{
    const engine = new KartEngine(null, mockAudio);
    engine.raceStarted = true;
    engine.countdown = 0;
    engine.currentLap = 3;
    engine.playerZ = engine.trackLength - 50;
    engine.speed = 1000;
    engine.update(0.1); // Advances past trackLength
    assert.strictEqual(engine.raceFinished, true, "Race should finish when completing lap 3");
    console.log("✔ Test 6: Lap & Race finish logic passed");
}

console.log("All KartEngine Unit Tests Passed Successfully!");
