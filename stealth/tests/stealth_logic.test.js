const assert = require('assert');
const { StealthEngine } = require('../js/stealth.js');

console.log("Running Ghost Protocol: Infiltrator Unit Tests...");

// Mock Audio
const mockAudio = {
    hackTick: () => {},
    hackComplete: () => {},
    suspicionPing: () => {},
    alert: () => {},
    takedown: () => {},
    extraction: () => {},
    laserBuzz: () => {}
};

// Test 1: Floor & Level Initialization
{
    const engine = new StealthEngine(null, mockAudio);
    assert.strictEqual(engine.level, 1, "Should start at Floor 1");
    assert.strictEqual(engine.gameState, 'playing', "Initial state should be playing");
    assert.strictEqual(engine.terminals.length, 2, "Floor 1 should have 2 terminals");
    assert.strictEqual(engine.extraction.unlocked, false, "Extraction should initially be locked");
    assert.strictEqual(engine.guards.length, 3, "Floor 1 should have 3 patrol guards");
    console.log("✔ Test 1: Level initialization passed");
}

// Test 2: Movement & Wall Collisions
{
    const engine = new StealthEngine(null, mockAudio);
    // Position player right next to wall (x: 160, y: 160, w: 20, h: 320)
    engine.player.x = 145;
    engine.player.y = 200;
    engine.keys.right = true; // Move into wall

    // Step physics
    for (let i = 0; i < 20; i++) {
        engine.updatePlayer(0.016);
    }
    // Player cannot cross x=160
    assert(engine.player.x <= 160, `Player x (${engine.player.x}) should not penetrate solid wall`);
    console.log("✔ Test 2: Movement & wall collision passed");
}

// Test 3: Line of Sight Calculation
{
    const engine = new StealthEngine(null, mockAudio);
    // Sublevel 1 has a wall at x: 160, y: 160, w: 20, h: 320
    // Sight across x: 100 to x: 200 at y: 200 should be BLOCKED
    const blockedSight = engine.hasLineOfSight(100, 200, 200, 200);
    assert.strictEqual(blockedSight, false, "Line of sight through wall must be false");

    // Sight along open corridor (y: 540 from x: 100 to x: 300) should be CLEAR
    const clearSight = engine.hasLineOfSight(100, 540, 300, 540);
    assert.strictEqual(clearSight, true, "Line of sight in open space must be true");
    console.log("✔ Test 3: Line of sight calculations passed");
}

// Test 4: Vision Cone Detection & Suspicion Buildup
{
    const engine = new StealthEngine(null, mockAudio);
    const guard = engine.guards[0];
    guard.x = 240;
    guard.y = 200;
    guard.angle = Math.PI / 2; // Guard facing DOWN (y increases)

    // Position player directly in guard's field of view
    engine.player.x = 240;
    engine.player.y = 280; // 80px down, in cone

    const initialSuspicion = guard.suspicion;
    engine.updateGuards(0.2);
    assert(guard.suspicion > initialSuspicion, "Guard should detect player and increase suspicion");
    console.log("✔ Test 4: Vision cone detection & suspicion buildup passed");
}

// Test 5: Stealth Takedown
{
    const engine = new StealthEngine(null, mockAudio);
    const guard = engine.guards[0];
    guard.x = 300;
    guard.y = 300;
    guard.angle = 0; // Guard facing RIGHT

    // Player sneak behind guard (to the left, at x: 275)
    engine.player.x = 275;
    engine.player.y = 300;
    engine.keys.action = true;

    engine.attemptTakedown();
    assert.strictEqual(guard.state, 'stunned', "Guard should be stunned by stealth takedown");
    assert(guard.stunTimer > 0, "Guard stun timer should be active");
    assert(engine.score > 0, "Score should be awarded for takedown");
    console.log("✔ Test 5: Stealth takedown mechanics passed");
}

// Test 6: Terminal Decryption and Extraction Unlock
{
    const engine = new StealthEngine(null, mockAudio);
    // Complete all terminals
    for (const t of engine.terminals) {
        t.hacked = true;
    }
    engine.updateExtraction();
    assert.strictEqual(engine.extraction.unlocked, true, "Extraction should unlock when all terminals hacked");

    // Move player into extraction zone
    engine.player.x = engine.extraction.x + 10;
    engine.player.y = engine.extraction.y + 10;
    engine.updateExtraction();
    assert.strictEqual(engine.level, 2, "Reaching extraction zone should advance to level 2");
    console.log("✔ Test 6: Terminal decryption and extraction progression passed");
}

console.log("\nALL GHOST PROTOCOL UNIT TESTS PASSED (6/6)!\n");
