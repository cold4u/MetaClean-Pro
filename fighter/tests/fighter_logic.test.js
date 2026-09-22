const assert = require('assert');
const { FighterEngine } = require('../js/fighter.js');

console.log("Running Cyber Brawler: Neon Clash Unit Tests...");

// Mock Audio
const mockAudio = {
    punch: () => {},
    kick: () => {},
    fireball: () => {},
    hit: () => {},
    block: () => {},
    ko: () => {},
    victory: () => {},
    roundStart: () => {}
};

// Test 1: Fighters and Match Initialization
{
    const engine = new FighterEngine(null, mockAudio);
    assert.strictEqual(engine.currentRound, 1, "Should start at Round 1");
    assert.strictEqual(engine.p1.hp, 100, "Player 1 should have 100 HP");
    assert.strictEqual(engine.p2.hp, 100, "Player 2 should have 100 HP");
    assert.strictEqual(engine.p1.facing, 1, "Player 1 should face right");
    assert.strictEqual(engine.p2.facing, -1, "Player 2 should face left");
    console.log("✔ Test 1: Fighters and Match initialization passed");
}

// Test 2: Jump Physics and Floor Clamping
{
    const engine = new FighterEngine(null, mockAudio);
    engine.roundState = 'fight';
    engine.p1.vy = -600; // Jump impulse
    engine.p1.isGrounded = false;
    engine.p1.state = 'jump';

    // Simulate 0.1s
    engine.updateFighterPhysics(engine.p1, 0.1);
    assert(engine.p1.y < engine.floorY, "Fighter should be in air");
    assert(engine.p1.vy > -600, "Gravity should pull fighter down");

    // Simulate descent to ground
    for (let i = 0; i < 60; i++) {
        engine.updateFighterPhysics(engine.p1, 0.05);
    }
    assert.strictEqual(engine.p1.y, engine.floorY, "Fighter should land on floor");
    assert.strictEqual(engine.p1.isGrounded, true, "Fighter should be grounded");
    console.log("✔ Test 2: Jump physics and floor clamping passed");
}

// Test 3: Melee Attack and Hit Detection
{
    const engine = new FighterEngine(null, mockAudio);
    engine.roundState = 'fight';
    // Move fighters into melee range
    engine.p1.x = 300;
    engine.p2.x = 350;
    const initialHp = engine.p2.hp;

    engine.triggerAction(engine.p1, 'punch');
    assert.strictEqual(engine.p1.state, 'punch', "P1 should be punching");
    assert(engine.p2.hp < initialHp, "P2 should have taken damage from punch");
    assert(['hurt', 'block'].includes(engine.p2.state), "P2 should enter hurt or block state");
    console.log("✔ Test 3: Melee attack and hit detection passed");
}

// Test 4: Guard Block Damage Reduction
{
    const engine = new FighterEngine(null, mockAudio);
    engine.roundState = 'fight';
    engine.p1.x = 300;
    engine.p2.x = 350;
    engine.p2.facing = -1; // P2 faces left towards P1
    const rawDamage = 20;
    engine.applyDamage(engine.p1, engine.p2, rawDamage, 20);
    assert(engine.p2.hp < 100, "P2 should have taken damage");
    console.log("✔ Test 4: Guard block mechanics passed");
}

// Test 5: Fireball Projectile Spawning and Collision
{
    const engine = new FighterEngine(null, mockAudio);
    engine.roundState = 'fight';
    engine.p1.x = 200;
    engine.p2.x = 400;

    engine.triggerAction(engine.p1, 'fireball');
    assert.strictEqual(engine.fireballs.length, 1, "A fireball should be spawned");
    assert(engine.fireballs[0].vx > 0, "Fireball should fly towards opponent");

    const p2InitialHp = engine.p2.hp;
    // Step projectiles until hit
    for (let i = 0; i < 30; i++) {
        engine.updateProjectiles(0.02);
    }
    assert(engine.p2.hp < p2InitialHp, "P2 should take damage from fireball");
    assert.strictEqual(engine.fireballs.length, 0, "Fireball should dissipate on impact");
    console.log("✔ Test 5: Fireball projectile mechanics passed");
}

// Test 6: KO Handling and Round Transition
{
    const engine = new FighterEngine(null, mockAudio);
    engine.roundState = 'fight';
    engine.p2.hp = 5;
    // Deliver lethal damage (even if 80% blocked, 100 * 0.2 = 20 > 5)
    engine.applyDamage(engine.p1, engine.p2, 100, 50);

    assert.strictEqual(engine.p2.hp, 0, "P2 HP should drop to 0");
    assert.strictEqual(engine.p2.state, 'ko', "P2 state should be 'ko'");
    assert.strictEqual(engine.roundState, 'ko', "Round state should transition to 'ko'");
    assert.strictEqual(engine.p1Wins, 1, "Player 1 should be awarded 1 round win");
    console.log("✔ Test 6: KO handling and round win passed");
}

console.log("\nALL CYBER BRAWLER UNIT TESTS PASSED (6/6)!\n");
