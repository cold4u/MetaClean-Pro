const assert = require('assert');
const { PinballEngine } = require('../js/pinball.js');

console.log("Running Quantum Pinball Unit Tests...");

// Mock Audio
const mockAudio = {
    flipper: () => {},
    bumper: () => {},
    slingshot: () => {},
    target: () => {},
    rollover: () => {},
    multiball: () => {},
    drain: () => {},
    plungerRelease: () => {}
};

// Test 1: Table elements initialization
{
    const engine = new PinballEngine(null, mockAudio);
    assert.strictEqual(engine.bumpers.length, 3, "Should have 3 pop bumpers");
    assert.strictEqual(engine.dropTargets.length, 3, "Should have 3 drop targets");
    assert.strictEqual(engine.rolloverLanes.length, 3, "Should have 3 rollover lanes");
    assert.strictEqual(engine.balls.length, 1, "Should have 1 active ball initially");
    console.log("✔ Test 1: Table elements initialization passed");
}

// Test 2: Flipper Mechanics
{
    const engine = new PinballEngine(null, mockAudio);
    const startAngle = engine.leftFlipper.angle;
    engine.pressLeftFlipper();
    assert.strictEqual(engine.leftFlipper.isPressed, true, "Left flipper should be pressed");
    engine.update(0.05);
    assert(engine.leftFlipper.angle < startAngle, "Left flipper should rotate towards active angle");
    console.log("✔ Test 2: Flipper mechanics passed");
}

// Test 3: Pop Bumper Collision & Score
{
    const engine = new PinballEngine(null, mockAudio);
    const bmp = engine.bumpers[0];
    const ball = engine.balls[0];
    ball.x = bmp.x + bmp.r + ball.radius - 2; // overlapping
    ball.y = bmp.y;
    ball.vx = -100;
    ball.vy = 0;
    const scoreBefore = engine.score;

    engine.update(0.016);
    assert(engine.score > scoreBefore, "Score should increase on bumper collision");
    assert(ball.vx > 0, "Ball should rebound away from bumper");
    console.log("✔ Test 3: Pop bumper collision & rebound passed");
}

// Test 4: Drop Targets & Multiplier
{
    const engine = new PinballEngine(null, mockAudio);
    assert.strictEqual(engine.multiplier, 1, "Base multiplier should be 1");
    // Knock down all 3 drop targets
    engine.dropTargets[0].active = false;
    engine.dropTargets[1].active = false;
    engine.dropTargets[2].active = false;
    engine.checkDropTargets();

    assert.strictEqual(engine.multiplier, 2, "Multiplier should increase to 2");
    assert(engine.score >= 2000, "Should award 1000 * 2 = 2000 bonus");
    console.log("✔ Test 4: Drop targets completion and multiplier passed");
}

// Test 5: Rollover Lanes Completion
{
    const engine = new PinballEngine(null, mockAudio);
    engine.rolloverLanes[0].lit = true;
    engine.rolloverLanes[1].lit = true;
    engine.rolloverLanes[2].lit = true;
    const scoreBefore = engine.score;
    engine.checkRolloverLanes();

    assert(engine.score > scoreBefore, "Score should increase from clearing all rollover lanes");
    console.log("✔ Test 5: Rollover lanes completion passed");
}

// Test 6: Ball Saver & Drain Mechanics
{
    const engine = new PinballEngine(null, mockAudio);
    // Ball saver active
    engine.ballSaverTimer = 5.0;
    const ball = engine.balls[0];
    ball.y = 700; // Past drain threshold
    engine.update(0.016);
    assert.strictEqual(engine.ballsRemaining, 3, "Balls remaining should not decrease while Ball Saver is active");

    // Expire ball saver
    engine.ballSaverTimer = 0;
    ball.y = 700;
    engine.update(0.016);
    assert.strictEqual(engine.ballsRemaining, 2, "Balls remaining should decrease after drain without saver");
    console.log("✔ Test 6: Ball saver and drain logic passed");
}

console.log("All PinballEngine Unit Tests Passed Successfully!");
